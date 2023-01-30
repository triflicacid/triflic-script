const Runspace = require("./src/runspace/Runspace");
const { define, defineVars, defineFuncs } = require("./src/init/def");
const defineNode = require("./src/init/def-node");
const { printError } = require("./src/utils");
const Complex = require('./src/maths/Complex');
const { parseArgString, argvBool } = require("./src/init/args");
const { ArrayValue, primitiveToValueClass } = require("./src/evaluation/values");
const { setupIO, destroyIO } = require("./src/runspace/setup-io");
const startEventLoop = require("./src/runspace/event-loop");
const process = require("process");

// PARSE ARGV, SETUP RUNSPACE
const args = parseArgString(process.argv.slice(2).join(" "));
if (args.imag !== undefined) Complex.imagLetter = args.imag;

const rs = new Runspace({
  app: "CLI",
  file: __filename,
  root: __dirname,
  timeExec: argvBool(args, 'time', false),
  bidmas: argvBool(args, 'bidmas', true),
  prompt: argvBool(args, 'prompt', '>> '),
});
rs.pwd = __dirname;
rs.stdin = process.stdin;
rs.stdout = process.stdout;
define(rs);
defineNode(rs);
defineVars(rs);
defineFuncs(rs);

const mpid = rs.create_process(), mainProc = rs.get_process(mpid);
mainProc.dieonerr = false;
mainProc.imported_files.push('<interpreter>');

process.on('SIGINT', () => {
  rs._procs.forEach(proc => rs.terminate_process(proc.pid, -1, true));
});

// Setup things
setupIO(rs);
require("./src/runspace/runspace-createImport");

rs.defineVar('argv', new ArrayValue(rs, process.argv.slice(2).map(v => primitiveToValueClass(rs, v))), 'Arguments provided to the program', mpid);

async function main() {
  if (!process.stdin.isTTY) {
    printError(`TTY Error: CLI requires a text terminal (TTY not available)`, str => process.stdout.write(str));
    process.exit(1);
  }
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.resume();

  // Import standard IO library
  await rs.import(mpid, "<io>");

  // Any other libraries?
  if (args.import) {
    const libs = args.import.split(",").map(x => x.trim());
    process.stdout.write(`--import: Importing ${libs.length} ${libs.length === 1 ? "module" : "modules"}...\n`);
    for (const lib of libs) {
      try {
        await rs.import(mpid, lib);
        process.stdout.write(`--import: Successfully imported lib '${lib}'\n`);
      } catch (e) {
        e = new Error(`Error importing lib '${lib}' from --import:\n${e.toString()}`);
        printError(e, str => process.stdout.write(str));
        process.stdout.write("\n");
      }
    }
  }

  // Set prompt
  rs.io.setPrompt(rs.opts.value.get("prompt"));

  // Print intro stuff to screen
  rs.io.output.write(`-- ${Runspace.LANG_NAME} v${Runspace.VERSION} --\nType help(), copyright() for more information.\n`);

  // Set input event handlers
  if (args.multiline) {
    const lines = []; // Line buffer
    rs.onLineHandler = async (io, line) => {
      const prompt = rs.opts.value.get("prompt").toString();
      if (line.length === 0) {
        const input = lines.join('\n');
        lines.length = 0;
        io.setPrompt(prompt);
        rs.exec(mpid, input);
      } else {
        lines.push(line);
        io.setPrompt('.'.repeat(prompt.length - 1) + ' ');
        rs.io.prompt();
      }
    };
  } else {
    rs.onLineHandler = (io, line) => rs.exec(mpid, line);
  }

  // Initialialise prompt
  rs.io.prompt();

  await startEventLoop(rs, handler);

  destroyIO(rs);
}

function handler(proc) {
  if (proc.pid !== mpid) return; // Only handle main process
  if (mainProc.state === 0) {
    if (mainProc.stateValue) {
      if (mainProc.stateValue.status < 0) {
        rs.io.output.write("Process exited with code " + mainProc.stateValue.statusValue + "\n");
        rs.terminate_process(mpid, 0, true);
      } else {
        rs.io.output.write(mainProc.stateValue.ret.toString() + "\n");
        if (rs.opts.value.get("timeExec")?.toPrimitive("bool")) {
          rs.io.output.write(`** Took ${mainProc.stateValue.parse + mainProc.stateValue.exec} ms (${mainProc.stateValue.parse} ms parsing, ${mainProc.stateValue.exec} ms execution)\n`);
        }
        rs.io.setPrompt(rs.opts.value.get("prompt") ?? rs.UNDEFINED);
        rs.io.prompt();
      }
    } else {
      rs.io.setPrompt(rs.opts.value.get("prompt") ?? rs.UNDEFINED);
      rs.io.prompt();
    }
  }
}

main();
