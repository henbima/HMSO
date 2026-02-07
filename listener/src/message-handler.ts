import type { proto } from '@whiskeysockets/baileys';
import { supabase } from './supabase.js';
import { resolveContact } from './contact-resolver.js';
import { config } from './config.js';
import { logger } from './logger.js';

type WAMessage = proto.IWebMessageInfo;

export async function handleMessage(msg: WAMessage) {
  const remoteJid = msg.key?.remoteJid;
  if (!remoteJid) return;

  const isGroup = remoteJid.endsWith('@g.us');
  if (!isGroup) return;

  const senderJid = msg.key?.participant || msg.key?.remoteJid;
  if (!senderJid) return;

  const text = extractText(msg);
  const messageType = detectMessageType(msg);
  const timestamp = normalizeTimestamp(msg.messageTimestamp);

  const contactId = await resolveContact(senderJid, msg.pushName);
  const isFromHendra = senderJid === config.hendraJid;

  const { error } = await supabase.from('messages').insert({
    wa_message_id: msg.key?.id || null,
    wa_group_id: remoteJid,
    sender_jid: senderJid,
    sender_name: msg.pushName || null,
    contact_id: contactId,
    message_text: text || null,
    message_type: messageType,
    is_from_hendra: isFromHendra,
    quoted_message_id: extractQuotedId(msg) || null,
    timestamp: timestamp.toISOString(),
    raw_data: stripBuffers(msg) as Record<string, unknown>,
  });

  if (error) {
    if (error.code === '23505') return;
    logger.error({ error, msgId: msg.key?.id }, 'Failed to insert message');
    return;
  }

  logger.info(
    {
      group: remoteJid,
      sender: msg.pushName || senderJid,
      type: messageType,
      hendra: isFromHendra,
      len: text?.length || 0,
    },
    'Message saved'
  );
}

function extractText(msg: WAMessage): string | null {
  const m = msg.message;
  if (!m) return null;

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    null
  );
}

function detectMessageType(msg: WAMessage): string {
  const m = msg.message;
  if (!m) return 'unknown';

  if (m.conversation || m.extendedTextMessage) return 'text';
  if (m.imageMessage) return 'image';
  if (m.videoMessage) return 'video';
  if (m.audioMessage) return 'audio';
  if (m.documentMessage) return 'document';
  if (m.stickerMessage) return 'sticker';
  if (m.contactMessage || m.contactsArrayMessage) return 'contact';
  if (m.locationMessage || m.liveLocationMessage) return 'location';
  if (m.reactionMessage) return 'reaction';
  if (m.pollCreationMessage || m.pollCreationMessageV3) return 'poll';

  return 'other';
}

function extractQuotedId(msg: WAMessage): string | null {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  return ctx?.stanzaId || null;
}

function normalizeTimestamp(ts: proto.IWebMessageInfo['messageTimestamp']): Date {
  if (!ts) return new Date();

  const num = typeof ts === 'number' ? ts : typeof ts === 'object' && 'low' in ts ? ts.low : Number(ts);

  if (num > 1e12) return new Date(num);
  return new Date(num * 1000);
}

function stripBuffers(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Uint8Array || Buffer.isBuffer(obj)) return '<binary>';
  if (Array.isArray(obj)) return obj.map(stripBuffers);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = stripBuffers(value);
    }
    return result;
  }
  return obj;
}
