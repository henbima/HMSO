import { supabase } from './supabase.js';
import { logger } from './logger.js';

const contactCache = new Map<string, string>();

export async function resolveContact(
  senderJid: string,
  pushName: string | null | undefined
): Promise<string | null> {
  const cached = contactCache.get(senderJid);
  if (cached) return cached;

  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('wa_jid', senderJid)
    .maybeSingle();

  if (existing) {
    contactCache.set(senderJid, existing.id);
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

export function clearContactCache() {
  contactCache.clear();
}
