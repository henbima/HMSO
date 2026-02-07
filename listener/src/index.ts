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
import { syncAllGroups, shouldFullSync, handleParticipantsUpdate } from './group-sync.js';
import { logger } from './logger.js';
import { config } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = join(__dirname, '..', 'auth_info', config.listenerId);

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20;
const RECONNECT_BASE_DELAY = 3000;

let syncTimer: ReturnType<typeof setInterval> | null = null;

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
      logger.info('Connected to WhatsApp');

      const needsSync = shouldFullSync();

      if (needsSync) {
        logger.info('Full group sync needed (first run or stale data)');
        try {
          await syncAllGroups(sock);
        } catch (err) {
          logger.error({ err }, 'Initial group sync failed (non-fatal)');
        }
      } else {
        logger.info('Skipping full group sync (recent data exists). Using lazy per-group sync.');
      }

      syncTimer = setInterval(async () => {
        if (shouldFullSync()) {
          logger.info('Scheduled full group sync triggered');
          try {
            await syncAllGroups(sock);
          } catch (err) {
            logger.error({ err }, 'Scheduled group sync failed (non-fatal)');
          }
        }
      }, 60 * 60 * 1000);
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
