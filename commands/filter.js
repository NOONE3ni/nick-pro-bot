import sharp from 'sharp';

export async function applyFilter(conn, sender, imgBuffer, filter = 'grayscale') {
  if(!imgBuffer) return await conn.sendMessage(sender, { text: 'Send an image first!' });
  let img = sharp(imgBuffer);
  if(filter === 'grayscale') img = img.grayscale();
  if(filter === 'invert') img = img.negate();
  if(filter === 'sepia') img = img.modulate({ saturation: 0.5, hue: 30 });
  const processed = await img.toBuffer();
  await conn.sendMessage(sender, { image: processed });
    }
