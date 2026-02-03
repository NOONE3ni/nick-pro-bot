import sharp from 'sharp';
import fs from 'fs';

export async function sticker(conn, sender, imgBuffer) {
  if(!imgBuffer) return await conn.sendMessage(sender, { text: 'Send an image first!' });
  const outputPath = './media/sticker.webp';
  await sharp(imgBuffer).webp().toFile(outputPath);
  await conn.sendMessage(sender, { sticker: fs.readFileSync(outputPath) });
    }
