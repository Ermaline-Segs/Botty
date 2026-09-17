import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { COUNTRY_COMMAND_NAME, handleCountry } from './src/commands/country.js';
import { registerCommands } from './src/register-commands.js';

const { DISCORD_TOKEN, GUILD_ID } = process.env;
if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  registerCommands(client.application.id, { guildId: GUILD_ID, token: DISCORD_TOKEN }).catch(
    (err) => console.error('Command registration failed:', err),
  );
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== COUNTRY_COMMAND_NAME) {
    return;
  }
  try {
    await handleCountry(interaction);
  } catch (err) {
    console.error('country command failed:', err);
    const content = 'Sorry, something went wrong while looking that up.';
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content });
      } else {
        await interaction.reply({ content, ephemeral: true });
      }
    } catch {
      // Interaction is no longer available (too late to reply); nothing to do.
    }
  }
});

client
  .login(DISCORD_TOKEN)
  .catch((err) => {
    console.error(`Login failed: ${err.message}. Check DISCORD_TOKEN in .env.`);
    process.exit(1);
  });