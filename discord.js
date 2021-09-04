require("dotenv").config();
const Discord = require("discord.js");
const { define, defineVars, defineFuncs } = require("./src/init/def");
const Runspace = require("./src/runspace/Runspace");
const { RunspaceBuiltinFunction } = require("./src/runspace/Function");
const { parseArgString } = require("./src/init/args");
const Complex = require("./src/maths/Complex");
const { UndefinedValue } = require("./src/evaluation/values");

// CHECK FOR REQUIRED ENV VARIABLES
if (!process.env.BOT_TOKEN) throw new Error(`Setup Error: missing BOT_TOKEN environment variable`);
if (!process.env.CHANNEL) throw new Error(`Setup Error: missing CHANNEL environment variable`);

const client = new Discord.Client();
client.login(process.env.BOT_TOKEN);

/** Create new runspace */
function createRunspace(argString = '') {
  const opts = parseArgString(argString, false);
  if (opts.imag !== undefined) Complex.imagLetter = opts.imag; else opts.imag = Complex.imagLetter; // Change imaginary unit
  opts.app = 'Discord';
  const rs = new Runspace(opts); // Create object
  define(rs);
  if (opts.defineVars) defineVars(rs);
  if (opts.defineFuncs) defineFuncs(rs);
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
  rs.define(new RunspaceBuiltinFunction(rs, 'print', { o: 'any' }, ({ o }) => {
    if (rs.discordLatestMsg) {
      rs.discordLatestMsg.reply(o.toString());
      return new UndefinedValue(rs);
    } else {
      throw new Error(`Fatal Error: cunable to print`);
    }
  }, 'End the discord maths session'));
  rs.func('import', null); // Remove function 'import'
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
      await sessionStart(msg, msg.content.substr(6));
    } else if (msg.content === '!close') {
      await sessionEnd(msg);
    } else {
      if (envSessions[msg.author.id]) {
        envSessions[msg.author.id].discordLatestMsg = msg;
        try {
          let out = envSessions[msg.author.id].execute(msg.content);
          if (out !== undefined) await msg.reply('`' + out.toString() + '`');
        } catch (e) {
          let error = e.toString().split('\n').map(l => `\`⚠ ${l}\``).join('\n');
          await msg.reply(error);
        }
      }
    }
  }
});

async function sessionStart(msg, argString = '') {
  envSessions[msg.author.id] = createRunspace(argString);
  console.log(`> Created session for ${msg.author.username} (#${msg.author.id})`);
  await msg.reply(`✅ Created new session`);
}

async function sessionEnd(msg) {
  delete envSessions[msg.author.id];
  console.log(`< Discarded session for ${msg.author.username} (#${msg.author.id})`);
  await msg.reply(`🚮 Destroyed session`);
}