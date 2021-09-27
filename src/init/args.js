const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { getArgvBool } = require('../utils');

/** Populate argv object */
function parseArgString(args, doHideBin = true) {
  let argv = yargs(doHideBin ? hideBin(args) : args).argv;
  return {
    strict: getArgvBool(argv, "strict", false),
    defineVars: getArgvBool(argv, "defineVars"),
    defineFuncs: getArgvBool(argv, "defineFuncs"),
    prompt: argv.prompt === undefined ? '>> ' : argv.prompt.toString(),
    intro: getArgvBool(argv, "intro", true),
    niceErrors: getArgvBool(argv, "nice-errors", true),
    ans: getArgvBool(argv, "ans", true),
    imag: argv.imag,
    bidmas: getArgvBool(argv, "bidmas", true),
    revealHeaders: getArgvBool(argv, "reveal-headers", true),
    multiline: getArgvBool(argv, "multiline", false),
    timeExecution: getArgvBool(argv, "time", false),
    dir: argv.dir,
  };
}

module.exports = { parseArgString };