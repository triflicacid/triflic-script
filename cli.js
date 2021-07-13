const Runspace = require("./src/runspace/Runspace");
const { define } = require("./src/init/def");
const { input, print, consoleColours } = require("./src/utils");
const Complex = require('./src/maths/Complex');
const { parseArgString } = require("./src/init/args");

// PARSE ARGV
const opts = parseArgString(process.argv, true);
const rs = new Runspace(opts.strict, opts.ans, opts.bidmas);
if (opts.imag !== undefined) Complex.imagLetter = opts.imag;
define(rs, opts.defineVars, opts.defineFuncs);

function attempt(fn) {
  try {
    return fn();
  } catch (e) {
    e.toString().split('\n').forEach(line => print(`${consoleColours.Bright}${consoleColours.FgRed}[!] ${consoleColours.Reset}${line}`));
  }
}

(async function () {
  if (opts.intro) {
    print(`${__filename} - JS Maths CLI\nType help() for basic help`);
    let notes = [];
    if (opts.strict) notes.push("strict mode is enabled");
    if (!opts.bidmas) notes.push("BIDMAS is being ignored");
    if (!opts.niceErrors) notes.push("fatal errors are enabled");
    if (!opts.defineVars) notes.push("pre-defined variables were not defined");
    if (!opts.defineFuncs) notes.push("pre-defined functions were not defined");
    if (!opts.ans) notes.push("variable ans is not defined");
    notes.forEach(note => print(`${consoleColours.Bright}${consoleColours.FgWhite}${consoleColours.Reverse}Note${consoleColours.Reset} ${note}`));
    print();
  }
  let inp;
  while (true) {
    inp = await input(opts.prompt);
    let out = opts.niceErrors ? attempt(() => rs.eval(inp)) : rs.eval(inp);
    if (out !== undefined) print(out.toString());
  }
})();