const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const Environment = require("./src/env");
const { define } = require("./src/def");
const { input, print, getArgvBool } = require("./src/utils");
const { FgRed, Reset, Bright, } = require("./src/console-colours");
const { parseOperator } = require('./src/parse');

const argv = yargs(hideBin(process.argv)).argv;
const opts = {
  defineVars: getArgvBool(argv, "defineVars"),
  defineFuncs: getArgvBool(argv, "defineFuncs"),
  prompt: argv.prompt === undefined ? '>>> ' : argv.prompt.toString(),
  intro: getArgvBool(argv, "intro", false),
  niceErrors: getArgvBool(argv, "nice-errors", true),
  ans: getArgvBool(argv, "ans", true),
};
const env = new Environment(opts.ans);
define(env, opts.defineVars, opts.defineFuncs);

console.log(parseOperator("+"));

function attempt(fn) {
  try {
    return fn();
  } catch (e) {
    e.toString().split('\n').forEach(line => print(`${Bright}${FgRed}[!] ${Reset}${line}`));
  }
}

(async function () {
  if (opts.intro) print(`${__filename} - JS Maths CLI\nType help() for basic help\n`);
  let inp;
  while (true) {
    inp = await input(opts.prompt);
    let out = opts.niceErrors ? attempt(() => env.eval(inp)) : env.eval(inp);
    if (out !== undefined) print(out.toString());
  }
})();