import { REST, Routes } from 'discord.js';
import { countryCommand } from './commands/country.js';

export async function registerCommands(applicationId, { guildId, token } = {}) {
  const rest = new REST({ version: '10' }).setToken(token ?? process.env.DISCORD_TOKEN);
  const body = [countryCommand.toJSON()];
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body });
    console.log(`Registered /country in guild ${guildId}`);
  } else {
    await rest.put(Routes.applicationCommands(applicationId), { body });
    console.log('Registered /country globally (may take up to an hour to propagate)');
  }
}