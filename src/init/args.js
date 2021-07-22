const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { getArgvBool } = require('../utils');

function parseArgString(args, doHideBin = true) {
  const argv = yargs(doHideBin ? hideBin(args) : args).argv;
  return {
    strict: getArgvBool(argv, "strict", false),
    defineVars: getArgvBool(argv, "defineVars"),
    defineFuncs: getArgvBool(argv, "defineFuncs"),
    prompt: argv.prompt === undefined ? '>>> ' : argv.prompt.toString(),
    intro: getArgvBool(argv, "intro", true),
    niceErrors: getArgvBool(argv, "nice-errors", true),
    ans: getArgvBool(argv, "ans", true),
    imag: argv.imag,
    bidmas: getArgvBool(argv, "bidmas", true),
    gammaFactorial: getArgvBool(argv, "gamma-factorial", true),
    revealHeaders: getArgvBool(argv, "reveal-headers", true),
    defineAliases: getArgvBool(argv, "define-aliases", true),
  };
}

module.exports = { parseArgString };