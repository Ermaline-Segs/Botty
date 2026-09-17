import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { registerCommands } from './register-commands.js';

const { DISCORD_TOKEN, GUILD_ID } = process.env;
if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
const app = await rest.get(Routes.currentApplication());

try {
  await registerCommands(app.id, { guildId: GUILD_ID, token: DISCORD_TOKEN });
  console.log('Done.');
} catch (err) {
  console.error('Failed to register commands:', err);
  process.exit(1);
}