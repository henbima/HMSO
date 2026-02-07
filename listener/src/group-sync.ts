import type { WASocket, GroupMetadata } from '@whiskeysockets/baileys';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './supabase.js';
import { resolveContact } from './contact-resolver.js';
import { logger } from './logger.js';
import { config } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYNC_STATE_FILE = join(__dirname, '..', 'auth_info', config.listenerId, '.last_group_sync');
const SYNC_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const PER_GROUP_DELAY_MS = 800;

const knownGroupJids = new Set<string>();
let lastFullSyncTime = 0;

function loadSyncState() {
  try {
    if (existsSync(SYNC_STATE_FILE)) {
      const raw = readFileSync(SYNC_STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      lastFullSyncTime = parsed.lastSync || 0;
      if (Array.isArray(parsed.knownGroups)) {
        parsed.knownGroups.forEach((jid: string) => knownGroupJids.add(jid));
      }
      logger.info(
        { lastSync: new Date(lastFullSyncTime).toISOString(), knownGroups: knownGroupJids.size },
        'Loaded sync state'
      );
    }
  } catch {
    logger.warn('Could not load sync state, will do full sync');
  }
}

function saveSyncState() {
  try {
    writeFileSync(
      SYNC_STATE_FILE,
      JSON.stringify({
        lastSync: lastFullSyncTime,
        knownGroups: Array.from(knownGroupJids),
      })
    );
  } catch (err) {
    logger.warn({ err }, 'Could not save sync state');
  }
}

export function shouldFullSync(): boolean {
  loadSyncState();
  if (lastFullSyncTime === 0) return true;
  const elapsed = Date.now() - lastFullSyncTime;
  return elapsed > SYNC_COOLDOWN_MS;
}

export function isGroupKnown(waGroupId: string): boolean {
  return knownGroupJids.has(waGroupId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function syncAllGroups(sock: WASocket) {
  logger.info('Starting full group sync (staggered)...');

  let groups: Record<string, GroupMetadata>;
  try {
    groups = await sock.groupFetchAllParticipating();
  } catch (err) {
    logger.error({ err }, 'Failed to fetch groups');
    return;
  }

  const entries = Object.values(groups);
  logger.info({ count: entries.length }, 'Fetched groups');

  for (let i = 0; i < entries.length; i++) {
    await upsertGroup(entries[i]);
    knownGroupJids.add(entries[i].id);

    if (i < entries.length - 1) {
      await sleep(PER_GROUP_DELAY_MS);
    }
  }

  lastFullSyncTime = Date.now();
  saveSyncState();
  logger.info('Full group sync complete');
}

export async function syncSingleGroup(sock: WASocket, waGroupId: string) {
  if (knownGroupJids.has(waGroupId)) return;

  logger.info({ waGroupId }, 'Lazy-syncing single group');

  try {
    const meta = await sock.groupMetadata(waGroupId);
    await upsertGroup(meta);
    knownGroupJids.add(waGroupId);
    saveSyncState();
  } catch (err) {
    logger.warn({ err, waGroupId }, 'Failed to lazy-sync group (non-fatal)');
    knownGroupJids.add(waGroupId);
  }
}

async function upsertGroup(meta: GroupMetadata) {
  const { error: groupError } = await supabase
    .from('groups')
    .upsert(
      {
        wa_group_id: meta.id,
        name: meta.subject || meta.id,
        description: meta.desc || null,
        participant_count: meta.participants?.length || 0,
        is_active: true,
        updated_at: new Date().toISOString(),
        listener_id: config.listenerId,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'wa_group_id' }
    );

  if (groupError) {
    logger.error({ groupError, groupId: meta.id }, 'Failed to upsert group');
    return;
  }

  const { data: groupRow } = await supabase
    .from('groups')
    .select('id')
    .eq('wa_group_id', meta.id)
    .maybeSingle();

  if (!groupRow || !meta.participants) return;

  for (const participant of meta.participants) {
    const contactId = await resolveContact(participant.id, null);
    if (!contactId) continue;

    const waRole =
      participant.admin === 'superadmin'
        ? 'superadmin'
        : participant.admin === 'admin'
          ? 'admin'
          : 'member';

    await supabase
      .from('group_members')
      .upsert(
        {
          group_id: groupRow.id,
          contact_id: contactId,
          wa_role: waRole,
          is_active: true,
          listener_id: config.listenerId,
        },
        { onConflict: 'group_id,contact_id' }
      );
  }
}

export async function handleParticipantsUpdate(update: {
  id: string;
  participants: string[];
  action: string;
}) {
  const { data: groupRow } = await supabase
    .from('groups')
    .select('id')
    .eq('wa_group_id', update.id)
    .maybeSingle();

  if (!groupRow) return;

  for (const jid of update.participants) {
    const contactId = await resolveContact(jid, null);
    if (!contactId) continue;

    switch (update.action) {
      case 'add': {
        await supabase.from('group_members').upsert(
          {
            group_id: groupRow.id,
            contact_id: contactId,
            wa_role: 'member',
            is_active: true,
            joined_at: new Date().toISOString(),
            listener_id: config.listenerId,
          },
          { onConflict: 'group_id,contact_id' }
        );
        logger.info({ jid, group: update.id }, 'Participant joined');
        break;
      }

      case 'remove': {
        await supabase
          .from('group_members')
          .update({ is_active: false })
          .eq('group_id', groupRow.id)
          .eq('contact_id', contactId);
        logger.info({ jid, group: update.id }, 'Participant left');
        break;
      }

      case 'promote': {
        await supabase
          .from('group_members')
          .update({ wa_role: 'admin' })
          .eq('group_id', groupRow.id)
          .eq('contact_id', contactId);
        break;
      }

      case 'demote': {
        await supabase
          .from('group_members')
          .update({ wa_role: 'member' })
          .eq('group_id', groupRow.id)
          .eq('contact_id', contactId);
        break;
      }
    }
  }
}
