export async function menu(conn, sender) {
  const msg = `
Available Commands:

Public:
.ping - Check bot is online
.menu - Show this menu
.tts <text> - Convert text to speech
.filter <name> - Apply image filter
.sticker - Convert image to sticker
.pairme - Get pairing code to activate bot

Owner only:
.stats - Bot uptime and user count
.users - List all users
.block <number> - Block a user
.unblock <number> - Unblock a user
.restart - Restart bot
  `;
  await conn.sendMessage(sender, { text: msg });
                         }
