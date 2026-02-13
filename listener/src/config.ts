import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  hendraJid: required('HENDRA_JID'),
  listenerId: process.env.LISTENER_ID || 'default',
  logLevel: (process.env.LOG_LEVEL || 'info') as 'silent' | 'info' | 'debug' | 'warn' | 'error',
  briefingRecipientJid: process.env.BRIEFING_RECIPIENT_JID || '',
} as const;
