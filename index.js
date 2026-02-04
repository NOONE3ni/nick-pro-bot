import makeWASocket from '@whiskeysockets/baileys';
import { useSingleFileAuthState } from '@whiskeysockets/baileys/lib/Utils.js';
import fs from 'fs-extra';
import path from 'path';
import ytdl from 'ytdl-core';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ------------------
// Folders & Files
// ------------------
const SESSION_FOLDER = path.join(__dirname, 'session');
const PAIRING_FILE = path.join(__dirname, 'data', 'pairing.json');
const MESSAGES_FILE = path.join(__dirname, 'data', 'messages.json');
const MEDIA_FILE = path.join(__dirname, 'data', 'media.json');
const DOWNLOADS_FOLDER = path.join(__dirname, 'downloads');

await fs.ensureDir(SESSION_FOLDER);
await fs.ensureDir(DOWNLOADS_FOLDER);

// ------------------
// Load JSON data
// ------------------
let pairingData = await fs.readJson(PAIRING_FILE);
let messages = await fs.readJson(MESSAGES_FILE);
let media = await fs.readJson(MEDIA_FILE);

// ------------------
// Owner number
// ------------------
const ownerNumber = Object.keys(pairingData).find(num => pairingData[num].role === 'owner');

// ------------------
// Auth state
// ------------------
const { state, saveState } = useSingleFileAuthState(path.join(SESSION_FOLDER, 'owner.json'));

// ------------------
// Generate pairing code
// ------------------
function generatePairingCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ------------------
// Start bot
// ------------------
async function startBot() {
    const sock = makeWASocket({ printQRInTerminal: true, auth: state });

    sock.ev.on('creds.update', saveState);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if(connection === 'open') {
            console.log(`Owner number ${ownerNumber} is pre-linked ✅`);
            console.log('NOONE Bot is now ONLINE ✅');
        } else if(connection === 'close') {
            if(lastDisconnect?.error && lastDisconnect.error.output?.statusCode !== 401){
                startBot();
            } else {
                console.log('Logged out. Delete session folder and redeploy.');
            }
        }
    });

    // ------------------
    // Message handler
    // ------------------
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if(!msg.message) return;

        const text = msg.message.conversation || msg.message?.extendedTextMessage?.text;
        const from = msg.key.remoteJid;
        if(!text) return;

        const isOwner = from.includes(ownerNumber);

        // ------------------
        // Owner commands
        // ------------------
        if(isOwner){
            switch(true){
                case text.startsWith('.stats'):
                    await sock.sendMessage(from, { text: `Owner: ${ownerNumber}\nLinked users: ${Object.keys(pairingData).length}` });
                    break;
                case text.startsWith('.restart'):
                    await sock.sendMessage(from, { text: 'Restarting bot...' });
                    process.exit(0);
                    break;
                case text.startsWith('.edittext'):
                    const [, key, ...newMsg] = text.split(' ');
                    if(messages[key]){
                        messages[key] = newMsg.join(' ');
                        await fs.writeJson(MESSAGES_FILE, messages, { spaces: 2 });
                        await sock.sendMessage(from, { text: `Updated message for ${key}` });
                    }
                    break;
                case text.startsWith('.editimage'):
                    const [, imgKey, url] = text.split(' ');
                    if(media[imgKey]){
                        media[imgKey] = url;
                        await fs.writeJson(MEDIA_FILE, media, { spaces: 2 });
                        await sock.sendMessage(from, { text: `Updated image for ${imgKey}` });
                    }
                    break;
                case text.startsWith('.menu'):
                    await sock.sendMessage(from, { text: messages.menu });
                    break;
            }
        }

        // ------------------
        // Public commands
        // ------------------
        if(text === '.ping') await sock.sendMessage(from, { text: messages.ping });
        if(text === '.menu') await sock.sendMessage(from, { text: messages.menu });

        // ------------------
        // Media download
        // ------------------
        if(text.startsWith('.music')){
            const ytLink = text.split(' ')[1];
            if(!ytLink) return sock.sendMessage(from, { text: 'Provide a YouTube link.' });
            try{
                const filePath = path.join(DOWNLOADS_FOLDER, `audio_${Date.now()}.mp3`);
                ytdl(ytLink, { filter: 'audioonly' }).pipe(fs.createWriteStream(filePath));
                await sock.sendMessage(from, { text: 'Downloading audio...' });
                setTimeout(async () => {
                    await sock.sendMessage(from, { audio: fs.readFileSync(filePath), mimetype: 'audio/mpeg' });
                    fs.unlinkSync(filePath);
                }, 5000);
            } catch(e){
                await sock.sendMessage(from, { text: 'Failed to download audio.' });
            }
        }

        if(text.startsWith('.video')){
            const ytLink = text.split(' ')[1];
            if(!ytLink) return sock.sendMessage(from, { text: 'Provide a YouTube link.' });
            try{
                const filePath = path.join(DOWNLOADS_FOLDER, `video_${Date.now()}.mp4`);
                ytdl(ytLink, { quality: 'highestvideo' }).pipe(fs.createWriteStream(filePath));
                await sock.sendMessage(from, { text: 'Downloading video...' });
                setTimeout(async () => {
                    await sock.sendMessage(from, { video: fs.readFileSync(filePath), mimetype: 'video/mp4' });
                    fs.unlinkSync(filePath);
                }, 10000);
            } catch(e){
                await sock.sendMessage(from, { text: 'Failed to download video.' });
            }
        }

        // ------------------
        // New user pairing
        // ------------------
        if(!pairingData[from]){
            const code = generatePairingCode();
            pairingData[from] = { pairingCode: code, status: 'pending', role: 'user' };
            await fs.writeJson(PAIRING_FILE, pairingData, { spaces: 2 });

            await sock.sendMessage(from, { text: `Your pairing code: ${code}\nSend this to link your account.` });
            await sock.sendMessage(ownerNumber + '@s.whatsapp.net', { text: `New user pairing:\nNumber: ${from}\nCode: ${code}` });
        }
    });
}

startBot();