import cheerio from "cheerio";
import got from "got";
import { getCommandArgs } from "#utils/command.js";
import { cleanURL, fetchDDG } from "#utils/http.js";
import { sanitize } from "#utils/sanitize.js";
import { trimHTML } from "#utils/trimHTML.js";
import { logger } from "#utils/logger/index.js";
import { generateImage } from "#services/snap/utils.js";
import {
  stackoverflow,
  gist,
  wikipedia,
  wikihow,
  stackexchange,
  foodnetwork,
  knowyourmeme,
  urbandictionary,
  bonappetit,
  cookingNytimes,
  caniuse,
  zeroclick,
  manpage
} from "./handlers/index.js";

// list of handlers, also used to filter valid sites
const VALID_SOURCES = {
  "stackoverflow.com": stackoverflow,
  "gist.github.com": gist,
  "en.wikipedia.org": wikipedia,
  "id.wikipedia.org": wikipedia,
  "simple.wikipedia.org": wikipedia,
  "wikihow.com": wikihow,
  "foodnetwork.com": foodnetwork,
  "serverfault.com": stackexchange,
  "superuser.com": stackexchange,
  "askubuntu.com": stackexchange,
  "mathoverflow.net": stackexchange,
  "gamedev.stackexchange.com": stackexchange,
  "gaming.stackexchange.com": stackexchange,
  "webapps.stackexchange.com": stackexchange,
  "photo.stackexchange.com": stackexchange,
  "stats.stackexchange.com": stackexchange,
  // For weebs out there
  "anime.stackexchange.com": stackexchange,
  "japanese.stackexchange.com": stackexchange,
  // Ok lets get back to normal people
  "cooking.stackexchange.com": stackexchange,
  "webmasters.stackexchange.com": stackexchange,
  "english.stackexchange.com": stackexchange,
  "math.stackexchange.com": stackexchange,
  "apple.stackexchange.com": stackexchange,
  "diy.stackexchange.com": stackexchange,
  "ux.stackexchange.com": stackexchange,
  "cstheory.stackexchange.com": stackexchange,
  "money.stackexchange.com": stackexchange,
  "softwareengineering.stackexchange.com": stackexchange,
  "scifi.stackexchange.com": stackexchange,
  "workplace.stackexchange.com": stackexchange,
  "security.stackexchange.com": stackexchange,
  "worldbuilding.stackexchange.com": stackexchange,
  "literature.stackexchange.com": stackexchange,
  "rpg.stackexchange.com": stackexchange,
  "academia.stackexchange.com": stackexchange,
  "electronics.stackexchange.com": stackexchange,
  "retrocomputing.stackexchange.com": stackexchange,
  "puzzling.stackexchange.com": stackexchange,
  "travel.stackexchange.com": stackexchange,
  "graphicdesign.stackexchange.com": stackexchange,
  "networkengineering.stackexchange.com": stackexchange,
  "islam.stackexchange.com": stackexchange,
  "dba.stackexchange.com": stackexchange,
  "chemistry.stackexchange.com": stackexchange,
  "law.stackexchange.com": stackexchange,
  "history.stackexchange.com": stackexchange,
  "knowyourmeme.com": knowyourmeme,
  "urbandictionary.com": urbandictionary,
  "bonappetit.com": bonappetit,
  "cooking.nytimes.com": cookingNytimes,
  "caniuse.com": caniuse,
  "man7.org": manpage
};
const CONTENT_MAX_LENGTH = 800;

/**
 * @param {{ url: string, type: 'image' | 'text' | 'error', content: string }} result
 * @param {import('telegraf').Telegraf} context
 * @returns
 */
async function sendImage(result, context) {
  const tooLong =
    result.content.length > 3000 || result.content.split("\n").length > 190;
  const image = await generateImage(result.content.substring(0, 3000), "");

  // no await, see https://eslint.org/docs/rules/no-return-await
  return context.telegram.sendPhoto(
    context.message.chat.id,
    { source: image },
    { caption: tooLong ? `Read more on: ${result.url}` : "" }
  );
}

/**
 *
 * @param {{ url: string, type: 'image' | 'text' | 'error', content: string }} result
 * @param {import('telegraf').Telegraf} context
 * @param {Boolean} trim
 * @returns
 */
function sendText(result, context, trim) {
  let content = sanitize(result.content);
  if (trim && content.length > CONTENT_MAX_LENGTH) {
    content = `${trimHTML(CONTENT_MAX_LENGTH, content)}...\n}`;
  }

  // no await, see https://eslint.org/docs/rules/no-return-await
  return context.telegram.sendMessage(context.message.chat.id, content, {
    parse_mode: "HTML",
    disable_web_page_preview: true
  });
}

/**
 *
 * @param {import('telegraf').Telegraf} context
 * @returns
 */
async function sendError(context) {
  const MESSAGE = "Uhh, I don't have an answer for that, sorry.";
  await context.reply(MESSAGE);
  await logger.fromContext(context, "laodeai", {
    sendText: MESSAGE
  });
}

/**
 * Literally will go through URLs
 * @param {URL[]} validSources
 * @returns {Promise<{ url: string, type: 'image' | 'text', content: string } | { type: 'error' }>}
 */
async function goThroughURLs(validSources) {
  for (let i = 0; i < validSources.length; i++) {
    const url = validSources[i];
    /* eslint-disable-next-line no-await-in-loop */
    const { body, statusCode } = await got.get(url.href, {
      headers: {
        Accept: "text/html"
      },
      responseType: "text",
      throwHttpErrors: false,
      timeout: {
        request: 15_000
      }
    });

    if (statusCode !== 200) {
      continue;
    }

    const cleanHostname = url.hostname.replace("www.", "");
    const urlDOM = cheerio.load(body);
    const parsedDOM = VALID_SOURCES[cleanHostname](urlDOM);
    const urlResult = {
      url: url.href,
      ...parsedDOM
    };

    if (urlResult.type === "error") {
      if (i === validSources.length - 1) {
        // Just give up man
        return { type: "error" };
      }

      continue;
    } else {
      return urlResult;
    }
  }

  return { type: "error" };
}

/**
 * @param {import('telegraf').Telegraf} context
 * @returns {Promise<void>}
 */
async function laodeai(context) {
  const query = getCommandArgs("laodeai", context);
  if (!query) return;

  const { body: ddgBody, statusCode: ddgStatusCode } = await fetchDDG(query);

  if (ddgStatusCode !== 200) {
    await context.reply("Error getting search result.");
    await logger.fromContext(context, "laodeai", {
      sendText: "Error getting search result."
    });
    return;
  }

  const $ = cheerio.load(ddgBody);
  const sources = $(".web-result").get();
  if (
    sources.length <= 1 &&
    $(sources[0]).find(".no-results").get().length !== 0
  ) {
    await sendError(context);
    return;
  }

  const validSources = sources
    .map((el) => {
      const href = cleanURL(
        $(el).find(".result__title > a").first().attr("href")
      );
      return new URL(decodeURIComponent(href));
    })
    .filter((url) => VALID_SOURCES[url.hostname.replace("www.", "")]);
  if (!validSources) {
    await sendError(context);
    return;
  }

  const result = await goThroughURLs(validSources);
  if (!result) {
    // fallback to zeroclick
    const zcResult = zeroclick($);
    if (zcResult.content) {
      await sendText(zcResult, context, false);
      return;
    }

    await sendError(context);
    return;
  }

  switch (result.type) {
  case "image": {
    const sentMessage = await sendImage(result, context);
    await logger.fromContext(context, "laodeai", {
      sendText: sentMessage.caption ?? "",
      actions: `Sent a photo with id ${sentMessage.message_id}`
    });
    break;
  }
  case "text": {
    const sentMessage = await sendText(result, context, true);
    await logger.fromContext(context, "laodeai", {
      sendText: sentMessage.text
    });
    break;
  }
  case "error": {
    await sendError(context);
    break;
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
  bot.command("laodeai", (context) => laodeai(context));

  return [
    {
      command: "laodeai",
      description: "Cari di StackOverFlow"
    }
  ];
}
