import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import qrcode from 'qrcode-terminal';
import { handleMessage, setSocket } from './message-handler.js';
import { syncAllGroups, handleParticipantsUpdate } from './group-sync.js';
import { checkAndSendBriefings } from './briefing-sender.js';
import { logger } from './logger.js';
import { config } from './config.js';
import { supabase } from './supabase.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = join(__dirname, '..', 'auth_info', config.listenerId);

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20;
const RECONNECT_BASE_DELAY = 3000;

let syncTimer: ReturnType<typeof setInterval> | null = null;
let briefingTimer: ReturnType<typeof setInterval> | null = null;

async function startListener() {
  logger.info('Starting WA Intel Listener...');
  logger.info({ supabaseUrl: config.supabaseUrl, hendraJid: config.hendraJid }, 'Config loaded');

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  logger.info({ version }, 'Using Baileys version');

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger as any),
    },
    printQRInTerminal: false,
    logger: logger as any,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  setSocket(sock);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info('QR code received. Rendering in terminal...');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
      }
      if (briefingTimer) {
        clearInterval(briefingTimer);
        briefingTimer = null;
      }

      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn({ statusCode, shouldReconnect }, 'Connection closed');

      if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(1.5, reconnectAttempts - 1), 60000);
        logger.info({ attempt: reconnectAttempts, delayMs: delay }, 'Reconnecting...');
        setTimeout(startListener, delay);
      } else if (!shouldReconnect) {
        logger.error('Logged out. Delete auth_info/ folder and scan QR again.');
        process.exit(1);
      } else {
        logger.error({ attempts: reconnectAttempts }, 'Max reconnect attempts reached');
        process.exit(1);
      }
    }

    if (connection === 'open') {
      reconnectAttempts = 0;
      logger.info('Connected to WhatsApp - using lazy sync mode');

      syncTimer = setInterval(async () => {
        try {
          const { data: pendingRequests } = await supabase
            .from('sync_requests')
            .select('id')
            .eq('status', 'pending')
            .order('requested_at', { ascending: true })
            .limit(1);

          if (pendingRequests && pendingRequests.length > 0) {
            const request = pendingRequests[0];
            logger.info({ requestId: request.id }, 'Processing sync request');

            await supabase
              .from('sync_requests')
              .update({ status: 'processing', started_at: new Date().toISOString() })
              .eq('id', request.id);

            try {
              const groupsCount = await syncAllGroups(sock);
              await supabase
                .from('sync_requests')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                  groups_synced: groupsCount,
                })
                .eq('id', request.id);
              logger.info({ requestId: request.id, groupsCount }, 'Sync request completed');
            } catch (err) {
              await supabase
                .from('sync_requests')
                .update({
                  status: 'failed',
                  completed_at: new Date().toISOString(),
                  error: err instanceof Error ? err.message : 'Unknown error',
                })
                .eq('id', request.id);
              logger.error({ err, requestId: request.id }, 'Sync request failed');
            }
          }
        } catch (err) {
          logger.error({ err }, 'Error checking sync requests');
        }
      }, 10000);

      briefingTimer = setInterval(async () => {
        try {
          await checkAndSendBriefings(sock);
        } catch (err) {
          logger.error({ err }, 'Error checking/sending briefings');
        }
      }, 60000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        await handleMessage(msg);
      } catch (err) {
        logger.error({ err, msgId: msg.key?.id }, 'Unhandled error processing message');
      }
    }
  });

  sock.ev.on('group-participants.update', async (update) => {
    try {
      await handleParticipantsUpdate(update);
    } catch (err) {
      logger.error({ err, group: update.id }, 'Error handling participant update');
    }
  });
}

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
});

startListener().catch((err) => {
  logger.fatal({ err }, 'Fatal startup error');
  process.exit(1);
});
