import cheerio from 'cheerio';
import got from 'got';
import { getCommandArgs } from '../../utils/command.js';
import { cleanURL, fetchDDG } from '../../utils/http.js';
import { generateImage } from '../snap/utils.js';
import { stackoverflow } from './stackoverflow.js';
import { gist } from './gist.js';
import { wikipedia } from './wikipedia.js';
import { wikihow } from './wikihow.js';
import { stackexchange } from './stackexchange.js';
import { sanitize } from '../../utils/sanitize.js';
import { foodnetwork } from './foodnetwork.js';

// list of handlers, also used to filter valid sites
const VALID_SOURCES = {
  'stackoverflow.com': stackoverflow,
  'gist.github.com': gist,
  'en.wikipedia.org': wikipedia,
  'wikihow.com': wikihow,
  'foodnetwork.com': foodnetwork,
  'serverfault.com': stackexchange,
  'superuser.com': stackexchange,
  'askubuntu.com': stackexchange,
  // I know this is kind of dumb, so..
  // FIXME: Use regexp! Or not, I don't know which is better
  'gamedev.stackexchange.com': stackexchange,
  'gaming.stackexchange.com': stackexchange,
  'webapps.stackexchange.com': stackexchange,
  'photo.stackexchange.com': stackexchange,
  'stats.stackexchange.com': stackexchange,
  // For weebs out there
  'anime.stackexchange.com': stackexchange,
  'japanese.stackexchange.com': stackexchange,
  // Ok lets get back to normal people
  'cooking.stackexchange.com': stackexchange,
  'webmasters.stackexchange.com': stackexchange,
  'english.stackexchange.com': stackexchange,
  'math.stackexchange.com': stackexchange,
  'apple.stackexchange.com': stackexchange,
  'diy.stackexchange.com': stackexchange,
  'ux.stackexchange.com': stackexchange,
  'cstheory.stackexchange.com': stackexchange,
  'money.stackexchange.com': stackexchange,
  'softwareengineering.stackexchange.com': stackexchange,
  'scifi.stackexchange.com': stackexchange,
  'workplace.stackexchange.com': stackexchange,
};

/**
 * @param {import('telegraf').Telegraf} context
 * @returns {Promise<void>}
 */
async function laodeai(context) {
  const query = getCommandArgs('laodeai', context);
  if (!query) return;

  const { body: ddgBody, statusCode: ddgStatusCode } = await fetchDDG(got, query);

  if (ddgStatusCode !== 200) {
    await context.reply('Error getting search result.');
    return;
  }

  const $ = cheerio.load(ddgBody);
  const validSources = $('.web-result')
    .map((_, el) => {
      const href = cleanURL($(el).find('.result__title > a').first().attr('href'));
      return new URL(decodeURIComponent(href));
    })
    .get()
    .filter((url) => VALID_SOURCES[url.hostname.replace('www.', '')]);

  if (validSources.length < 1) {
    await context.reply("Uhh, I don't have an answer for that, sorry.");
    return;
  }

  const results = await Promise.all(
    validSources.map(async (url) => {
      const { body, statusCode } = await got.get(url.href, {
        headers: {
          Accept: 'text/html',
        },
        responseType: 'text',
      });
      if (statusCode !== 200) return null;

      return { url: url.href, ...VALID_SOURCES[url.hostname.replace('www.', '')](cheerio.load(body)) };
    }),
  );

  // TODO(elianiva): ideally we should send all of them instead of picking the
  //                 first one
  const result = results[0];

  switch (result.type) {
    case 'image': {
      await context.telegram.sendPhoto(context.message.chat.id, {
        source: await generateImage(result.content, context.message.from.username),
      });
      break;
    }
    case 'text': {
      let content = result.content;
      if (content.length > 500) {
        content = `${sanitize(content.substring(0, 500))}...\n\nSee more on: ${result.url}`;
      }

      await context.telegram.sendMessage(context.message.chat.id, content, { parse_mode: 'HTML' });
      break;
    }
    case 'error': {
      throw new Error('LaodeAI handler error');
    }
  }
}

/**
 * Find code from stackoverflow
 * @param {import('telegraf').Telegraf} bot
 * @param {import('mongoose').Connection} mongo
 * @returns {{ command: String, description: String}[]}
 */
export function register(bot) {
  bot.command('laodeai', (context) => laodeai(context));

  return [
    {
      command: 'laodeai',
      description: 'Cari di StackOverFlow',
    },
  ];
}
