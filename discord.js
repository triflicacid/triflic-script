require("dotenv").config();
const Discord = require("discord.js");
const { define } = require("./src/def");
const Environment = require("./src/env");
const { EnvBuiltinFunction } = require("./src/function");

const client = new Discord.Client();
client.login(process.env.BOT_TOKEN);

/** Create new environment */
function createEnvironment(defStd) {
  const env = new Environment();
  if (defStd) define(env);
  env.define(new EnvBuiltinFunction(env, 'exit', [], () => 'Discord: type !close to end session', 'exit maths session'));
  return env;
}

/* LOGGED IN */
client.on('ready', async () => {
  console.log('👍 Connected');
  const c = client.channels.cache.find(c => c.id === process.env.CHANNEL);
  await c.send('👋 Ready to do some maths? 😀');
});

var envSessions = {}; // { author_id : Environment }

client.on('message', async msg => {
  // Listening on this channel? Not a bot?
  if (!msg.author.bot && msg.channel.id === process.env.CHANNEL) {
    if (msg.content.startsWith('!start')) {
      envSessions[msg.author.id] = createEnvironment(!msg.content.includes('blank'));
      await msg.reply(`✅ Created new session`);
    } else if (msg.content === '!close') {
      delete envSessions[msg.author.id];
      await msg.reply(`🚮 Destroyed session`);
    } else {
      if (envSessions[msg.author.id]) {
        try {
          let out = envSessions[msg.author.id].eval(msg.content);
          if (out !== undefined) await msg.reply('`' + out.toString() + '`');
        } catch (e) {
          let error = e.toString().split('\n').map(l => `\`⚠ ${l}\``).join('\n');
          await msg.reply(error);
        }
      }
    }
  }
});