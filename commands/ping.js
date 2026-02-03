export async function ping(conn, sender) {
  await conn.sendMessage(sender, { text: 'Pong 🏓' });
}
