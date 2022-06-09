require("dotenv").config();
const Discord = require("discord.js");
const { define, defineVars, defineFuncs } = require("./src/init/def");
const Runspace = require("./src/runspace/Runspace");
const { RunspaceBuiltinFunction } = require("./src/runspace/Function");
const { parseArgString } = require("./src/init/args");
const Complex = require("./src/maths/Complex");
const { UndefinedValue, ArrayValue, primitiveToValueClass, NumberValue } = require("./src/evaluation/values");
const startEventLoop = require("./src/runspace/event-loop");

// CHECK FOR REQUIRED ENV VARIABLES
if (!process.env.BOT_TOKEN) throw new Error(`Setup Error: missing BOT_TOKEN environment variable`);
if (!process.env.CHANNEL) throw new Error(`Setup Error: missing CHANNEL environment variable`);

const client = new Discord.Client();
client.login(process.env.BOT_TOKEN);

/** Create new runspace */
async function createRunspace(argString = '') {
  const opts = parseArgString(argString, false);
  if (opts.imag !== undefined) Complex.imagLetter = opts.imag; else opts.imag = Complex.imagLetter; // Change imaginary unit
  opts.app = 'DISCORD';
  const rs = new Runspace(opts); // Create object
  rs.root = __dirname;
  define(rs);
  defineVars(rs);
  if (opts.defineFuncs) defineFuncs(rs);
  const pid = rs.create_process(), mainProc = rs.get_process(pid);
  mainProc.imported_files.push('<discord>');

  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'exit', { c: '?real_int' }, ({ c }) => {
    if (rs.discordLatestMsg) {
      sessionEnd(rs.discordLatestMsg); // Declay session ending message
      return c ?? new NumberValue(rs, 0);
    } else {
      throw new Error(`Fatal Error: could not end session. Please type '!close'.`);
    }
  }, 'End the discord maths session'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'print', { o: 'any' }, ({ o }) => {
    if (rs.discordLatestMsg) {
      rs.discordLatestMsg.reply(o.toString());
      return new UndefinedValue(rs);
    } else {
      throw new Error(`Fatal Error: unable to print`);
    }
  }, 'End the discord maths session'));
  rs.defineVar('argv', new ArrayValue(rs, process.argv.slice(2).map(v => primitiveToValueClass(rs, v))), 'Arguments provided to the host program');

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
    try {
      if (msg.content.startsWith('!start')) {
        await sessionStart(msg, msg.content.substring(6));
      } else {
        if (envSessions[msg.author.id]) {
          envSessions[msg.author.id].discordLatestMsg = msg;
          await envSessions[msg.author.id].exec(pid, msg.content);

          try {
            let timeObj = {};
            if (out !== undefined) await msg.reply('`' + out.toString() + '`');
            if (envSessions[msg.author.id]?.opts.timeExecution) await msg.reply(`Timings: ${timeObj.parse} ms parsing, ${timeObj.exec} ms execution`);
          } catch (e) {
            let error = e.toString().split('\n').map(l => `\`⚠ ${l}\``).join('\n');
            await msg.reply(error);
          }

          if (mainProc.state === 0) {
            if (mainProc.stateValue.status < 0) {
              await msg.reply("Process exited with code " + mainProc.stateValue.statusValue + "\n");
              rs.terminate_process(mpid, 0, true);
            } else {
              await msg.reply(mainProc.stateValue.ret.toString() + "\n");
              if (opts.timeExecution) {
                msg.reply(`** Took ${time} ms (${mainProc.stateValue.parse} ms parsing, ${mainProc.stateValue.exec} ms execution)\n`);
              }
            }
          } else if (mainProc.state === 2) {
            let error = mainProc.stateValue.toString().split('\n').map(l => `\`⚠ ${l}\``).join('\n');
            await msg.reply(error);
            mainProc.state = 0;
          }
        }
      }
    } catch (e) {
      await msg.reply(`Internal Fatal Error: ${e.name}. See dev console.`);
      throw e;
    }
  }
});

async function sessionStart(msg, argString = '') {
  envSessions[msg.author.id] = await createRunspace(argString);
  console.log(`> Created session for ${msg.author.username} (#${msg.author.id})`);
  await msg.reply(`✅ Created new session`);
}

async function sessionEnd(msg) {
  delete envSessions[msg.author.id];
  console.log(`< Discarded session for ${msg.author.username} (#${msg.author.id})`);
  await msg.reply(`🚮 Destroyed session`);
}