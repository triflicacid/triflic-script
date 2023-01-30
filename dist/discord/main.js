require("dotenv").config();
const { Client, GatewayIntentBits, Events } = require("discord.js");
const { define, defineVars, defineFuncs } = require("../../src/init/def");
const Runspace = require("../../src/runspace/Runspace");
const { RunspaceBuiltinFunction } = require("../../src/runspace/Function");
const { parseArgString, argvBool } = require("../../src/init/args");
const Complex = require("../../src/maths/Complex");
const { UndefinedValue, ArrayValue, primitiveToValueClass, NumberValue } = require("../../src/evaluation/values");

// CHECK FOR REQUIRED ENV VARIABLES
if (!process.env.BOT_TOKEN) throw new Error(`Setup Error: missing BOT_TOKEN environment variable`);
if (!process.env.CHANNEL) throw new Error(`Setup Error: missing CHANNEL environment variable`);

const client = new Client({
  intents: [
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

/** Create new runspace. Returns { runspace, pid } */
async function createRunspace(argString = '') {
  const args = parseArgString(argString);
  if (args.imag !== undefined) Complex.imagLetter = args.imag;

  const rs = new Runspace({
    app: 'DISCORD',
    timeExec: argvBool(args, 'time', false),
    bidmas: argvBool(args, 'bidmas', true),
  });
  define(rs);
  defineVars(rs);
  defineFuncs(rs);
  const pid = rs.create_process(), mainProc = rs.get_process(pid);
  mainProc.imported_files.push('<discord>');
  const ret = { rs, pid };

  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'exit', { c: '?real_int' }, ({ c }) => {
    if (ret.discordLatestMsg) {
      setImmediate(() => {
        sessionEnd(ret.discordLatestMsg); // Declay session ending message
      });
      return c ?? new NumberValue(rs, 0);
    } else {
      throw new Error(`Fatal Error: could not end session. Try \`!exit\`.`);
    }
  }, 'End the discord maths session'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'print', { o: 'any' }, ({ o }) => {
    if (ret.discordLatestMsg) {
      ret.discordLatestMsg.reply(o.toString());
      return new UndefinedValue(rs);
    } else {
      throw new Error(`Fatal Error: unable to print`);
    }
  }, 'Print text in a new message'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'println', { o: 'any' }, ({ o }) => {
    if (ret.discordLatestMsg) {
      ret.discordLatestMsg.reply(o.toString() + "\n");
      return new UndefinedValue(rs);
    } else {
      throw new Error(`Fatal Error: unable to print`);
    }
  }, 'Print text in a new message'), pid);
  rs.defineVar('argv', new ArrayValue(rs, process.argv.slice(2).map(v => primitiveToValueClass(rs, v))), 'Arguments provided to the host program');
  return ret;
}

/* LOGGED IN */
client.on(Events.ClientReady, client => {
  console.log(`Client is ready... Logged in as ${client.user.tag}`);
  // const c = client.channels.cache.find(c => c.id === process.env.CHANNEL);
});

var envSessions = {}; // { author_id : Environment }

client.on(Events.MessageCreate, async msg => {
  // Listening on this channel? Not a bot?
  if (!msg.author.bot && msg.channelId === process.env.CHANNEL) {
    if (msg.content.startsWith('!start')) {
      await sessionStart(msg, msg.content.substring(6));
    } else if (msg.content.startsWith('!exit')) {
      await sessionEnd(msg);
    } else {
      if (envSessions[msg.author.id]) {
        const obj = envSessions[msg.author.id];
        obj.discordLatestMsg = msg;
        let time = Date.now();
        await obj.rs.exec(obj.pid, msg.content);
        time = Date.now() - time;

        const mainProc = obj.rs.get_process(obj.pid);
        if (mainProc.state === 0) {
          if (mainProc.stateValue.status < 0) {
            await msg.reply("Process exited with code " + mainProc.stateValue.statusValue + "\n");
            rs.terminate_process(mpid, 0, true);
          } else {
            let resp = mainProc.stateValue.ret.toString();
            if (resp.trim().length === 0) resp = "\"" + resp + "\"";
            resp = "`" + resp + "`";
            if (obj.rs.opts.value.get("timeExec")?.toPrimitive("bool"))
              resp += `\n** Took ${time} ms (${mainProc.stateValue.parse} ms parsing, ${mainProc.stateValue.exec} ms execution)`;
            await msg.reply(resp);
          }
        } else if (mainProc.state === 2) {
          let error = mainProc.stateValue.toString().split('\n').map(l => `\`⚠ ${l}\``).join('\n');
          await msg.reply(error);
          mainProc.state = 0;
        }
      }
    }
  }
});

async function sessionStart(msg, argString = '') {
  envSessions[msg.author.id] = await createRunspace(argString);
  console.log(`> Created session for ${msg.author.username} (#${msg.author.id})`);
  await msg.reply(`-- ${Runspace.LANG_NAME} v${Runspace.VERSION} --`);
}

async function sessionEnd(msg) {
  delete envSessions[msg.author.id];
  console.log(`< Discarded session for ${msg.author.username} (#${msg.author.id})`);
  await msg.reply(`Goodbye.`);
}

client.login(process.env.BOT_TOKEN);