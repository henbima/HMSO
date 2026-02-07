import { supabase } from './supabase.js';
import { logger } from './logger.js';

const contactCache = new Map<string, string>();
const updatedNames = new Set<string>();

function isPlaceholderName(name: string | null | undefined): boolean {
  if (!name) return true;
  return name.endsWith('@lid') || name.endsWith('@s.whatsapp.net') || /^\d+$/.test(name);
}

export async function resolveContact(
  senderJid: string,
  pushName: string | null | undefined
): Promise<string | null> {
  const cached = contactCache.get(senderJid);
  if (cached) {
    if (pushName && !updatedNames.has(senderJid)) {
      updateContactName(senderJid, pushName, cached);
    }
    return cached;
  }

  const { data: existing } = await supabase
    .from('contacts')
    .select('id, display_name')
    .eq('wa_jid', senderJid)
    .maybeSingle();

  if (existing) {
    contactCache.set(senderJid, existing.id);
    if (pushName && isPlaceholderName(existing.display_name)) {
      updateContactName(senderJid, pushName, existing.id);
    } else {
      updatedNames.add(senderJid);
    }
    return existing.id;
  }

  const phone = senderJid.replace('@s.whatsapp.net', '');
  const displayName = pushName || phone;

  const { data: created, error } = await supabase
    .from('contacts')
    .insert({
      wa_jid: senderJid,
      phone_number: phone,
      display_name: displayName,
      short_name: pushName || null,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      const { data: retry } = await supabase
        .from('contacts')
        .select('id')
        .eq('wa_jid', senderJid)
        .maybeSingle();

      if (retry) {
        contactCache.set(senderJid, retry.id);
        return retry.id;
      }
    }
    logger.error({ error, senderJid }, 'Failed to create contact');
    return null;
  }

  if (created) {
    contactCache.set(senderJid, created.id);
    logger.info({ senderJid, displayName }, 'Auto-created new contact');
    return created.id;
  }

  return null;
}

async function updateContactName(jid: string, pushName: string, contactId: string) {
  updatedNames.add(jid);
  const { error } = await supabase
    .from('contacts')
    .update({ display_name: pushName, short_name: pushName })
    .eq('id', contactId);

  if (!error) {
    logger.info({ jid, pushName }, 'Updated contact name');
  }
}

export function clearContactCache() {
  contactCache.clear();
  updatedNames.clear();
}
