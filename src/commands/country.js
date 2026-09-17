import { SlashCommandBuilder } from 'discord.js';

// REST Countries v5 (the legacy /v3.1 endpoints are deprecated and no longer
// return data). Real data requires a free API key from
// https://restcountries.com/sign-up; the public demo key keeps the bot
// running out of the box but returns a fixed sample object (Canada).
const COUNTRIES_BASE = 'https://api.restcountries.com/countries/v5';
export const DEFAULT_DEMO_API_KEY = 'rc_live_demo';

export const countryCommand = new SlashCommandBuilder()
  .setName('country')
  .setDescription('Look up a country: flag, region, and population')
  .addStringOption((option) =>
    option
      .setName('country')
      .setDescription('Country name, e.g. France')
      .setRequired(true),
  );

export const COUNTRY_COMMAND_NAME = countryCommand.name;

export function countriesUrl(query) {
  return `${COUNTRIES_BASE}/names.common/${encodeURIComponent(query)}`;
}

export function countryHeaders(apiKey = process.env.REST_COUNTRIES_API_KEY) {
  return { Authorization: `Bearer ${apiKey || DEFAULT_DEMO_API_KEY}` };
}

// Accepts both the v5 JSON:API shape ({ data: { objects: [...] } }) and the
// legacy shape (a bare array of countries).
export function normalizeCountries(payload) {
  if (Array.isArray(payload)) return payload;
  const objects = payload?.data?.objects;
  if (Array.isArray(objects)) return objects;
  if (objects && typeof objects === 'object') return [objects];
  return [];
}

export async function handleCountry(interaction, fetchImpl = fetch) {
  const query = interaction.options.getString('country', true).trim();
  if (!query) {
    return interaction.editReply({ content: 'Please provide a country name.' });
  }

  // Defer so we never hit the 3-second interaction timeout while fetching.
  if (!interaction.deferred) {
    await interaction.deferReply();
  }

  let countries;
  try {
    const res = await fetchImpl(countriesUrl(query), {
      headers: countryHeaders(),
    });
    if (!res.ok) {
      return interaction.editReply({
        content: `No country found for **${query}**.`,
      });
    }
    countries = normalizeCountries(await res.json());
  } catch (err) {
    console.error('restcountries request failed:', err);
    return interaction.editReply({
      content: 'Could not reach the country lookup service. Please try again later.',
    });
  }

  if (countries.length === 0) {
    return interaction.editReply({
      content: `No country found for **${query}**.`,
    });
  }

  const country = countries[0];
  const extraMatches = countries.length > 1 ? ` *(+${countries.length - 1} other matches)*` : '';
  const embed = {
    title: `${country.flag?.emoji ?? ''} ${country.names?.common ?? query}${extraMatches}`.trim(),
    description: [
      `**Name:** ${country.names?.official ?? country.names?.common ?? 'Unknown'}`,
      `**Region:** ${country.region ?? 'Unknown'}`,
      `**Population:** ${
        country.population != null ? country.population.toLocaleString('en-US') : 'Unknown'
      }`,
    ].join('\n'),
    color: 0x5865f2,
  };
  return interaction.editReply({ embeds: [embed] });
}