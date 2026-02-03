import makeWASocket, { useSingleFileAuthState } from '@whiskeysockets/baileys';
import { ping } from './commands/ping.js';
import { menu } from './commands/menu.js';
import { tts } from './commands/tts.js';
import { applyFilter } from './commands/filter.js';
import { sticker } from './commands/sticker.js';
import { readJSON, writeJSON } from './utils/helpers.js';

const { state, saveState } = useSingleFileAuthState('./data/auth_info.json');

const conn = makeWASocket({ auth: state, printQRInTerminal: false });
conn.ev.on('creds.update', saveState);

console.log('NOONE Bot started — pairing system active.');

const users = readJSON('./data/users.json');
const pairing = readJSON('./data/pairing.json');

conn.ev.on('messages.upsert', async (m) => {
  const msg = m.messages[0];
  if(!msg.message) return;

  const sender = msg.key.remoteJid;
  const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
  if(!text) return;

  // Handle pairing system
  if(text.startsWith('.pairme')) {
    if(pairing[sender]) {
      await conn.sendMessage(sender, { text: `Your pairing code is: ${pairing[sender].pairingCode}` });
    } else {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      pairing[sender] = { pairingCode: code, status: 'pending', role: 'user' };
      writeJSON('./data/pairing.json', pairing);
      await conn.sendMessage(sender, { text: `Your pairing code is: ${code}. Use .activate <code> to activate.` });
    }
    return;
  }

  if(text.startsWith('.activate ')) {
    const code = text.replace('.activate ', '').trim();
    const entry = Object.entries(pairing).find(([num, obj]) => obj.pairingCode === code);
    if(entry) {
      const [num, obj] = entry;
      pairing[num].status = 'active';
      writeJSON('./data/pairing.json', pairing);
      users[num] = { joined: new Date().toISOString() };
      writeJSON('./data/users.json', users);
      await conn.sendMessage(sender, { text: `Bot activated! You can now use commands.` });
    } else {
      await conn.sendMessage(sender, { text: `Invalid pairing code.` });
    }
    return;
  }

  // Owner commands
  const ownerNumber = Object.keys(pairing).find(n => pairing[n].role === 'owner');
  if(sender === ownerNumber + '@s.whatsapp.net') {
    if(text.startsWith('.stats')) {
      await conn.sendMessage(sender, { text: `Bot online. Users count: ${Object.keys(users).length}` });
    }
    if(text.startsWith('.users')) {
      await conn.sendMessage(sender, { text: `Users:\n${Object.keys(users).join('\n')}` });
    }
    if(text.startsWith('.block ')) {
      const num = text.replace('.block ', '').trim();
      if(users[num]) users[num].blocked = true;
      writeJSON('./data/users.json', users);
      await conn.sendMessage(sender, { text: `${num} blocked.` });
    }
    if(text.startsWith('.unblock ')) {
      const num = text.replace('.unblock ', '').trim();
      if(users[num]) users[num].blocked = false;
      writeJSON('./data/users.json', users);
      await conn.sendMessage(sender, { text: `${num} unblocked.` });
    }
    if(text.startsWith('.restart')) process.exit(0);
  }

  // Public commands (for active users)
  if(!users[sender] || users[sender].blocked) return;
  if(text.startsWith('.ping')) await ping(conn, sender);
  if(text.startsWith('.menu')) await menu(conn, sender);
  if(text.startsWith('.tts ')) await tts(conn, sender, text.replace('.tts ', ''));
  if(text.startsWith('.filter ')) {
    const imgBuffer = msg.message.imageMessage?.image?.data;
    await applyFilter(conn, sender, imgBuffer, text.replace('.filter ', ''));
  }
  if(text.startsWith('.sticker')) {
    const imgBuffer = msg.message.imageMessage?.image?.data;
    await sticker(conn, sender, imgBuffer);
  }
});
