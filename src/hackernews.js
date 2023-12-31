import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import * as Sentry from "@sentry/node";
import { pathTo } from "#utils/path.js";
import { run } from "#services/hackernews/index.js";

dotenv.config({ path: pathTo(import.meta.url, "../.env") });

const bot = new Telegraf(process.env.BOT_TOKEN);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

for (;;) {
  if (new Date().getUTCHours() === 0 || new Date().getUTCHours() === 11) {
    let done = false;
  
    // eslint-disable-next-line no-await-in-loop
    await run(bot)
      .catch((error) => {
        Sentry.captureException(error);
      })
      .finally(() => {
        done = true;
      });
  
    while (!done) {
      // wait
      await sleep(1000);
    }
  }

  // How long until the next time we have to send message?
  const now = new Date();
  let nextTime;

  if (now.getUTCHours() >= 11) {
    // The next time is 00:00 AM
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    now.setUTCDate(now.getUTCDate() + 1);
    nextTime = now;
  } else if (now.getUTCHours() < 11) {
    // The next time is 11:00 AM
    const now = new Date();
    now.setUTCHours(11, 0, 0, 0);
    nextTime = now;
  }

  // eslint-disable-next-line no-await-in-loop
  await sleep(nextTime.getTime() - now.getTime());
}
