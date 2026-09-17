import 'dotenv/config';
import http from 'node:http';
import { Client, GatewayIntentBits } from 'discord.js';
import { COUNTRY_COMMAND_NAME, handleCountry } from './src/commands/country.js';
import { registerCommands } from './src/register-commands.js';

// Show up as "Botty" in ps/pid listings so operators can find the process.
process.title = 'Botty';

const { DISCORD_TOKEN, GUILD_ID, PORT } = process.env;

// Without a real bot token the gateway login always fails, so detect
// missing/placeholder tokens up front and run the command layer headless
// against a local HTTP endpoint instead (useful for CI and smoke tests).
function tokenLooksValid(token) {
  if (typeof token !== 'string' || token.trim() === '') return false;
  const upper = token.trim().toUpperCase();
  return !upper.startsWith('PLACE') && !upper.startsWith('YOUR') && !upper.includes('XXXX');
}

const PORT_NUM = Number.parseInt(PORT, 10) || 3000;

if (tokenLooksValid(DISCORD_TOKEN)) {
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
} else {
  console.log(
    'No valid DISCORD_TOKEN found — starting Botty in offline mode ' +
      '(command dispatch only, no Discord gateway connection).',
  );
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/interactions') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'POST /interactions { command, args: [] }' }));
      return;
    }
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      const interaction = makeOfflineInteraction(body);
      if (interaction === null) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ error: 'Body must be { "command": "country", "args": ["France"] }' }),
        );
        return;
      }
      let reply;
      try {
        reply = await handleCountry(interaction);
      } catch (err) {
        console.error('offline dispatch failed:', err);
        reply = { content: 'Sorry, something went wrong while looking that up.' };
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply }));
    });
  });
  server.listen(PORT_NUM, () => {
    console.log(`Botty is ready (offline mode) — listening on port ${PORT_NUM}`);
  });
}

// Minimal stand-in for a Discord slash-command interaction: editReply returns
// the payload so the offline endpoint can return it as JSON.
function makeOfflineInteraction(body) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || parsed.command !== COUNTRY_COMMAND_NAME) return null;
  const args = Array.isArray(parsed.args) ? parsed.args : [];
  return {
    deferred: true,
    options: {
      getString: (name) => (name === 'country' ? args[0] : null),
    },
    deferReply: async () => true,
    editReply: async (payload) => payload,
  };
}