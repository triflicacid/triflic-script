const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { getArgvBool } = require('../utils');

/** Populate argv object */
function parseArgString(args, doHideBin = true) {
  let argv = yargs(doHideBin ? hideBin(args) : args).argv;
  return {
    defineFuncs: getArgvBool(argv, "defineFuncs"),
    prompt: argv.prompt === undefined ? '>> ' : argv.prompt.toString(),
    intro: getArgvBool(argv, "intro", true),
    imag: argv.imag,
    bidmas: getArgvBool(argv, "bidmas", true),
    multiline: getArgvBool(argv, "multiline", false),
    timeExecution: getArgvBool(argv, "time", false),
  };
}

module.exports = { parseArgString };