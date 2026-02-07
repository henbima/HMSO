import type { WASocket, GroupMetadata } from '@whiskeysockets/baileys';
import { supabase } from './supabase.js';
import { resolveContact } from './contact-resolver.js';
import { logger } from './logger.js';

export async function syncAllGroups(sock: WASocket) {
  logger.info('Syncing all group metadata...');

  let groups: Record<string, GroupMetadata>;
  try {
    groups = await sock.groupFetchAllParticipating();
  } catch (err) {
    logger.error({ err }, 'Failed to fetch groups');
    return;
  }

  const entries = Object.values(groups);
  logger.info({ count: entries.length }, 'Fetched groups');

  for (const group of entries) {
    await upsertGroup(group);
  }

  logger.info('Group sync complete');
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
