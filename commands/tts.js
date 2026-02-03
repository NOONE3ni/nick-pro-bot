import fs from 'fs';
import gTTS from 'gtts';

export async function tts(conn, sender, text) {
  const filePath = './media/tts.mp3';
  const speech = new gTTS(text, 'en');
  await new Promise((resolve, reject) => {
    speech.save(filePath, err => err ? reject(err) : resolve());
  });
  await conn.sendMessage(sender, { audio: fs.readFileSync(filePath), mimetype: 'audio/mpeg' });
                }
