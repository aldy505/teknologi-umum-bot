import got from "got";
import { randomNumber } from "carret";
import { defaultHeaders } from "#utils/http.js";
import redisClient from "#utils/redis.js";
import { isBigGroup, isHomeGroup } from "#utils/home.js";
import { logger } from "#utils/logger/logtail.js";
import { RateLimiterMemory } from "rate-limiter-flexible";

const rateLimiter = new RateLimiterMemory({ points: 6, duration: 60 });

/**
 * Send memes..
 * @param {import('telegraf').Telegraf} bot
 * @param {import('redis').RedisClient} cache
 * @returns {{command: String, description: String}[]}
 */
export function register(bot, cache) {
  const redis = redisClient(cache);

  bot.command("hilih", async (context) => {
    const bigGroup = await isBigGroup(context);
    if (bigGroup) return;
    await context.telegram.sendPhoto(
      context.message.chat.id,
      "https://i.ibb.co/dMbd6dF/short.jpg"
    );
    await logger.fromContext(context, "hilih", {
      sendText: "https://i.ibb.co/dMbd6dF/short.jpg"
    });
  });

  bot.command("kktbsys", async (context) => {
    const bigGroup = await isBigGroup(context);
    if (bigGroup) return;
    await context.telegram.sendPhoto(
      context.message.chat.id,
      "https://i.ibb.co/XtSbXBT/image.png"
    );
    await logger.fromContext(context, "kktbsys", {
      sendText: "https://i.ibb.co/XtSbXBT/image.png"
    });
  });

  bot.command("illuminati", async (context) => {
    const bigGroup = await isBigGroup(context);
    if (bigGroup) return;
    await context.telegram.sendAnimation(
      context.message.chat.id,
      "https://media.giphy.com/media/uFOW5cbNaoTaU/giphy.gif"
    );
    await logger.fromContext(context, "illuminati", {
      sendText: "https://media.giphy.com/media/uFOW5cbNaoTaU/giphy.gif"
    });
  });

  bot.command("yntkts", async (context) => {
    const bigGroup = await isBigGroup(context);
    if (bigGroup) return;
    await context.telegram.sendPhoto(
      context.message.chat.id,
      "https://i.ibb.co/P1Q0650/yntkts.jpg"
    );
    await logger.fromContext(context, "yntkts", {
      sendText: "https://i.ibb.co/P1Q0650/yntkts.jpg"
    });
  });

  bot.command("homework", async (context) => {
    const bigGroup = await isBigGroup(context);
    if (bigGroup) return;
    await context.telegram.sendPhoto(
      context.message.chat.id,
      "https://i.ibb.co/541knqp/photo-2021-08-21-02-54-24.jpg"
    );
    await logger.fromContext(context, "homework", {
      sendText: "https://i.ibb.co/541knqp/photo-2021-08-21-02-54-24.jpg"
    });
  });

  bot.command("joke", async (context) => {
    try {
      const bigGroup = await isBigGroup(context);
      if (bigGroup) return;
      if (isHomeGroup(context)) return;

      await rateLimiter.consume(context.from.id, 1);
      let total = await redis.GET("jokes:total");

      if (!total) {
        const { body } = await got.get(
          "https://jokesbapak2.herokuapp.com/total",
          {
            headers: defaultHeaders,
            responseType: "json",
            timeout: {
              request: 5_000
            },
            retry: {
              limit: 1
            }
          }
        );

        await redis.SETEX(
          "jokes:total",
          60 * 60 * 12,
          Number.parseInt(body.message)
        );
        total = Number.parseInt(body.message);
      }

      const id = randomNumber(0, total);

      await context.telegram.sendPhoto(
        context.message.chat.id,
        `https://jokesbapak2.herokuapp.com/id/${id}`
      );
      await logger.fromContext(context, "joke", {
        sendText: `https://jokesbapak2.herokuapp.com/id/${id}`
      });
    } catch (error) {
      if (error?.msBeforeNext) {
        await context.telegram.sendMessage(
          context.message.chat.id,
          `You have been rate limited. Try again in ${Math.round(error.msBeforeNext / 1000)} seconds.`,
          { parse_mode: "HTML" }
        );
      }

      throw error;
    }
  });

  return [
    {
      command: "hilih",
      description: "Arnold Poernomo ngomong hilih"
    },
    {
      command: "joke",
      description: "Get random jokes bapack2."
    },
    {
      command: "kktbsys",
      description: "Kenapa kamu tanya begitu, siapa yang suruh?"
    },
    {
      command: "yntkts",
      description: "Yo ndak tahu! Kok tanya saya."
    },
    {
      command: "homework",
      description: "Ini PR ya ngab?"
    },
    {
      command: "illuminati",
      description: "Please don't."
    }
  ];
}
