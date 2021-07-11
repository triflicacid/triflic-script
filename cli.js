const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const Runspace = require("./src/runspace/Runspace");
const { define } = require("./src/def");
const { input, print, getArgvBool, consoleColours } = require("./src/utils");

// PARSE ARGV
const argv = yargs(hideBin(process.argv)).argv;
const opts = {
  defineVars: getArgvBool(argv, "defineVars"),
  defineFuncs: getArgvBool(argv, "defineFuncs"),
  prompt: argv.prompt === undefined ? '>>> ' : argv.prompt.toString(),
  intro: getArgvBool(argv, "intro", false),
  niceErrors: getArgvBool(argv, "nice-errors", true),
  ans: getArgvBool(argv, "ans", true),
};
const env = new Runspace(opts.ans);
define(env, opts.defineVars, opts.defineFuncs);

function attempt(fn) {
  try {
    return fn();
  } catch (e) {
    e.toString().split('\n').forEach(line => print(`${consoleColours.Bright}${consoleColours.FgRed}[!] ${consoleColours.Reset}${line}`));
  }
}

// env.eval('f(x) = log(log(x, 2x), 3x)');

(async function () {
  if (opts.intro) print(`${__filename} - JS Maths CLI\nType help() for basic help\n`);
  let inp;
  while (true) {
    inp = await input(opts.prompt);
    let out = opts.niceErrors ? attempt(() => env.eval(inp)) : env.eval(inp);
    if (out !== undefined) print(out.toString());
  }
})();