import mongoose from 'mongoose';
import { getCommandArgs } from '#utils/command.js';
import redisClient from '#utils/redis.js';
import { renderTemplate } from '#utils/template.js';

const dukunSchema = new mongoose.Schema(
  {
    userID: Number,
    firstName: String,
    lastName: String,
    userName: String,
    points: Number,
    master: Boolean,
    createdAt: Date,
    updatedAt: Date,
  },
  { collection: 'dukun' },
);

/**
 *
 * @param {import('telegraf').Context<import('telegraf/typings/core/types/typegram').Update>} context
 * @param {import('mongoose').Connection} mongo
 * @param {import('redis').RedisClient} cache
 * @returns {Promise<void>}
 */
async function dukun(context, mongo, cache) {
  // Reject private and channels
  if (context.message.chat.type === 'private' || context.message.chat.type === 'channel') {
    await context.reply('Dukun is only available on groups.');
    return;
  }

  const redis = redisClient(cache);
  const argument = getCommandArgs('dukun', context);

  const Dukun = mongo.model('Dukun', dukunSchema, 'dukun');
  const dukunData = await redis.GET('dukun:all');
  /**  @type {Record<string, any>[]} */
  const dukunDataParsed = JSON.parse(dukunData);

  if (context.message.reply_to_message) {
    const replyMessage = context.message.reply_to_message;
    const isOwner = context.message.from.id === replyMessage.from.id;
    if (isOwner) {
      await context.reply('Poin dukun hanya bisa diberikan oleh orang lain. Najis banget dah self-claimed🙄');
      return;
    }

    let [dukunMasterID, dukunMasterPoints] = await redis.MGET('dukun:master:id', 'dukun:master:points');
    if (!dukunMasterID || !dukunMasterPoints) {
      const dukunMaster = await Dukun.findOne({ master: true });
      await redis.MSET('dukun:master:id', dukunMaster.userID, 'dukun:master:points', dukunMaster.points);
      dukunMasterID = dukunMaster.userID;
      dukunMasterPoints = dukunMaster.points;
    }

    /** @type {Number} point */
    let point;
    if (argument.startsWith('+')) {
      point = Math.abs(Number.parseInt(argument.replace('-', '')));
      // Maximum point addition is 10
      if (point > 10) {
        point = 10;
      }
    } else if (argument.startsWith('-')) {
      point = Math.abs(Number.parseInt(argument.replace('-', ''))) * -1;
      // Maximum point subtraction is 10
      if (point < -10) {
        point = -10;
      }
    } else {
      // No argument was given, +1 by default
      point = 1;
    }

    // yaelah ngapain sih bro
    if (Math.sign(point) === 0) {
      await context.reply('Om, seriusan?');
      return;
    }

    // Validate given point
    if (Number.isNaN(point) && !Number.isFinite(point)) {
      await context.reply('Poin dukun nggak valid. Nggak jadi ditambah.');
      return;
    }

    // Check if submitted dukun's a dukun master
    if (dukunMasterID === String(replyMessage.from.id)) {
      // Allow insertion
      const updatedData = await Dukun.findOneAndUpdate(
        { userID: replyMessage.from.id },
        {
          $inc: {
            points: point,
          },
          $set: {
            firstName: replyMessage.from?.first_name ?? '',
            lastName: replyMessage.from?.last_name ?? '',
            userName: replyMessage.from?.username ?? '',
            updatedAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );

      await context.telegram.sendMessage(
        context.chat.id,
        `Dukun master <a href="tg://user?id=${replyMessage.from.id}">${replyMessage.from.first_name} ${
          replyMessage.from?.last_name ?? ''
        }</a> points: ${updatedData.points}`,
        { parse_mode: 'HTML' },
      );

      await fetchUpstream(Dukun, redis, updatedData);
      return;
    }

    // Check submitted dukun's current point
    const submittedDukun = dukunDataParsed?.find((d) => d.userID === replyMessage.from.id)?.points ?? 0;
    if (submittedDukun + point >= dukunMasterPoints) {
      // Only may increment up to dukunMasterPoint - 1
      point = point - (submittedDukun + point - dukunMasterPoints) - 1;
    }

    // Add dukun point
    const updatedData = await Dukun.findOneAndUpdate(
      { userID: replyMessage.from.id },
      {
        $inc: {
          points: point,
        },
        $set: {
          firstName: replyMessage.from?.first_name ?? '',
          lastName: replyMessage.from?.last_name ?? '',
          userName: replyMessage.from?.username ?? '',
          updatedAt: new Date(),
        },
        $setOnInsert: {
          userID: replyMessage.from.id,
          master: false,
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    await context.telegram.sendMessage(
      context.chat.id,
      `Dukun <a href="tg://user?id=${replyMessage.from.id}">${replyMessage.from.first_name} ${
        replyMessage.from?.last_name ?? ''
      }</a> points: ${updatedData.points}`,
      { parse_mode: 'HTML' },
    );

    await fetchUpstream(Dukun, redis, updatedData);
    return;
  }

  // Dukun leaderboard LOL.
  if (!dukunData) {
    await context.reply(
      'No dukun data available. Try to ngedukun and ask someone to reply your message with /dukun +1. Jangan lupa dipasang sesajennya.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const leaderboard = dukunDataParsed.sort((a, b) => (a.points < b.points ? 1 : a.points > b.points ? -1 : 0));
  await context.telegram.sendMessage(
    context.chat.id,
    renderTemplate('dukun/dukun.template.hbs', { dukun: leaderboard.slice(0, 15), others: leaderboard.length - 15 }),
    { parse_mode: 'HTML' },
  );
}

/**
 * Fetch upstream data, thhen store to cache.
 * @param {import('mongoose').Model} dukunModel
 * @param {import('#utils/redis.js').default} redis - This type is wrong atm. Might fix this later.
 * @param {Record<string, any>} updatedData
 * @returns {Promise<void>}
 */
async function fetchUpstream(dukunModel, redis, updatedData) {
  const allDukun = await dukunModel.find({});
  await redis.MSET('dukun:all', JSON.stringify(allDukun));
  if (updatedData.master) {
    await redis.MSET('dukun:master:points', updatedData.points);
  }
}

/**
 *
 * @param {import('telegraf').Telegraf} bot
 * @param {import('mongoose').Connection} mongo
 * @param {import('redis').RedisClient} cache
 * @returns {{command: String, description: String}[]}
 */
export function register(bot, mongo, cache) {
  bot.command('dukun', (context) => dukun(context, mongo, cache));

  return [
    {
      command: 'dukun',
      description: 'Siapa yang paling dukun disini',
    },
  ];
}
