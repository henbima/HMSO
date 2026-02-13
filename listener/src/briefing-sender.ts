import { createClient } from '@supabase/supabase-js';
import type { WASocket } from '@whiskeysockets/baileys';
import { config } from './config.js';
import { logger } from './logger.js';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  db: { schema: 'wa_intel' },
});

export async function checkAndSendBriefings(sock: WASocket): Promise<void> {
  const recipientJid = config.briefingRecipientJid;
  if (!recipientJid) {
    return;
  }

  try {
    const { data: unsent, error } = await supabase
      .from('daily_briefings')
      .select('id, briefing_date, summary_text')
      .eq('sent_via', 'pending')
      .order('briefing_date', { ascending: true })
      .limit(1);

    if (error) {
      logger.error({ err: error }, 'Failed to query unsent briefings');
      return;
    }

    if (!unsent || unsent.length === 0) {
      return;
    }

    const briefing = unsent[0];

    try {
      await sock.sendMessage(recipientJid, { text: briefing.summary_text });
      logger.info(
        { briefing_id: briefing.id, date: briefing.briefing_date },
        'Briefing sent via WhatsApp'
      );

      const { error: updateError } = await supabase
        .from('daily_briefings')
        .update({
          sent_via: 'whatsapp',
          sent_at: new Date().toISOString(),
        })
        .eq('id', briefing.id);

      if (updateError) {
        logger.error(
          { err: updateError, briefing_id: briefing.id },
          'Failed to update briefing status after sending'
        );
      }
    } catch (sendErr) {
      logger.error(
        { err: sendErr, briefing_id: briefing.id },
        'Failed to send briefing via WhatsApp'
      );
    }
  } catch (err) {
    logger.error({ err }, 'Error in checkAndSendBriefings');
  }
}
