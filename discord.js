require("dotenv").config();
const Discord = require("discord.js");
const { define } = require("./src/def");
const Runspace = require("./src/runspace/Runspace");
const { RunspaceBuiltinFunction } = require("./src/runspace/Function");

const client = new Discord.Client();
client.login(process.env.BOT_TOKEN);

/** Create new runspace */
function createRunspace(defStd) {
  const rs = new Runspace();
  if (defStd) define(rs);
  rs.define(new RunspaceBuiltinFunction(rs, 'exit', { c: '?real_int' }, ({ c }) => {
    if (rs.discordLatestMsg) {
      if (c === undefined) c = 0;
      rs.discordLatestMsg.reply(`Terminating with exit code ${c}`);
      sessionEnd(rs.discordLatestMsg);
      return c;
    } else {
      throw new Error(`Fatal Error: could not end session. Please type '!close'.`);
    }
  }, 'End the discord maths session'));
  rs.func('clear', null);
  return rs;
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
      await sessionStart(msg);
    } else if (msg.content === '!close') {
      await sessionEnd(msg);
    } else {
      if (envSessions[msg.author.id]) {
        envSessions[msg.author.id].discordLatestMsg = msg;
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

async function sessionStart(msg) {
  envSessions[msg.author.id] = createRunspace(!msg.content.includes('blank'));
  console.log(`> Created session for ${msg.author.username} (#${msg.author.id})`);
  await msg.reply(`✅ Created new session`);
}

async function sessionEnd(msg) {
  delete envSessions[msg.author.id];
  console.log(`< Discarded session for ${msg.author.username} (#${msg.author.id})`);
  await msg.reply(`🚮 Destroyed session`);
}