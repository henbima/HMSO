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
  logLevel: (process.env.LOG_LEVEL || 'info') as 'silent' | 'info' | 'debug' | 'warn' | 'error',
} as const;
