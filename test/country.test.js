import test from 'node:test';
import assert from 'node:assert/strict';
import { countryCommand, handleCountry } from '../src/commands/country.js';

// v5 JSON:API response shape
const FRANCE_RESPONSE = {
  data: {
    objects: [
      {
        names: {
          common: 'France',
          official: 'French Republic',
        },
        flag: { emoji: '🇫🇷' },
        population: 68170229,
        region: 'Europe',
      },
    ],
  },
};

function mockInteraction(query) {
  const calls = { deferred: false, edited: null, replied: null, followedUp: null };
  return {
    calls,
    isChatInputCommand: () => true,
    commandName: countryCommand.name,
    options: { getString: (name) => (name === 'country' ? query : null) },
    deferReply: async () => {
      calls.deferred = true;
    },
    editReply: async (payload) => {
      calls.edited = payload;
    },
    reply: async (payload) => {
      calls.replied = payload;
    },
    followUp: async (payload) => {
      calls.followedUp = payload;
    },
  };
}

function mockFetch(query, results, { status = 200 } = {}) {
  const expected = `api\\.restcountries\\.com/countries/v5/names\\.common/${encodeURIComponent(query)}`;
  return async (url, init) => {
    assert.match(String(url), new RegExp(expected));
    assert.ok(init?.headers?.Authorization, 'Expected Authorization header');
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => results,
    };
  };
}

test('command serializes with the required option', () => {
  const json = countryCommand.toJSON();
  assert.equal(json.name, 'country');
  assert.equal(json.options.length, 1);
  assert.equal(json.options[0].name, 'country');
  assert.equal(json.options[0].type, 3);
  assert.equal(json.options[0].required, true);
});

test('/country France replies with an embed containing France', async () => {
  const interaction = mockInteraction('France');
  await handleCountry(interaction, mockFetch('France', FRANCE_RESPONSE));
  assert.equal(interaction.calls.deferred, true);
  const embed = interaction.calls.edited.embeds[0];
  assert.match(embed.title, /France/);
  assert.match(embed.description, /French Republic/);
  assert.match(embed.description, /Europe/);
  assert.match(embed.description, /68,170,229/);
  assert.match(interaction.calls.edited.content ?? embed.title, /France/);
});

test('unknown country gets a not-found reply', async () => {
  const interaction = mockInteraction('Atlantis');
  await handleCountry(interaction, mockFetch('Atlantis', 'Not Found', { status: 404 }));
  assert.match(interaction.calls.edited.content, /No country found/);
});

test('malformed results payload gets a not-found reply', async () => {
  const interaction = mockInteraction('Nowhere');
  await handleCountry(interaction, mockFetch('Nowhere', null, { status: 200 }));
  assert.match(interaction.calls.edited.content, /No country found/);
});