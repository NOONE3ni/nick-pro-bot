import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import fs from 'fs';
import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== CONFIG ======
const BOT_NAME = process.env.BOT_NAME || 'NOONE Bot';
const OWNER_NUMBER = (process.env.BOT_OWNER_NUMBER || '254728107967').replace(/\D/g, '');
const SESSION_DIR = path.join(__dirname, 'session');

// ensure session dir exists
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

// ====== START BOT ======
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false, // we use pairing code, not QR
    auth: state,
    browser: ['NOONE Bot', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  // ====== PAIRING CODE LOGIN (NO QR) ======
  if (!sock.authState.creds.registered) {
    const number = OWNER_NUMBER;
    console.log('Requesting pairing code for owner:', number);

    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(number);
        console.log(`\n==============================`);
        console.log(`PAIRING CODE (ENTER IN WHATSAPP): ${code}`);
        console.log(`Open WhatsApp → Linked devices → Link with phone number`);
        console.log(`==============================\n`);
      } catch (e) {
        console.error('Failed to get pairing code:', e);
      }
    }, 3000);
  }

  // ====== CONNECTION UPDATES ======
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log('Connection closed. Reason:', reason);

      if (reason !== DisconnectReason.loggedOut) {
        startBot();
      } else {
        console.log('Logged out. Delete session folder and redeploy.');
      }
    }

    if (connection === 'open') {
      console.log(`${BOT_NAME} is now ONLINE ✅`);
    }
  });

  // ====== MESSAGE HANDLER ======
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');

    const sender =
      isGroup
        ? msg.key.participant?.split('@')[0]
        : from.split('@')[0];

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    const isOwner = sender === OWNER_NUMBER;

    // ====== BASIC COMMANDS ======
    if (text === '.ping') {
      await sock.sendMessage(from, { text: 'Pong ✅ Bot is online.' });
    }

    if (text === '.menu') {
      const menu = `
🤖 *${BOT_NAME} Menu*

Public:
- .ping
- .menu

Owner:
- .stats
- .restart
`;
      await sock.sendMessage(from, { text: menu });
    }

    // ====== OWNER COMMANDS ======
    if (isOwner && text === '.stats') {
      await sock.sendMessage(from, {
        text: `👑 Owner: ${OWNER_NUMBER}\n🤖 Bot: ${BOT_NAME}\n✅ Status: Online`
      });
    }

    if (isOwner && text === '.restart') {
      await sock.sendMessage(from, { text: '♻️ Restarting bot...' });
      process.exit(0);
    }
  });
}

startBot().catch((err) => console.error('Bot crashed:', err));