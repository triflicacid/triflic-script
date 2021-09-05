const process = require("process");
const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");
const { parseArgString } = require("./src/init/args");
const fs = require("fs");
const path = require("path");
const Complex = require("./src/maths/Complex");
const { define, defineVars, defineFuncs } = require("./src/init/def");
const Runspace = require("./src/runspace/Runspace");
const { RunspaceBuiltinFunction } = require("./src/runspace/Function");
const { printError, consoleColours } = require("./src/utils");
const { UndefinedValue } = require("./src/evaluation/values");

if (process.argv.includes("--help")) {
  console.log(`Syntax: 'node file.js <file> [args]'`);
} else {
  // Find file
  const argv = yargs(hideBin(process.argv)).argv, file = argv._[0];
  if (argv._.length !== 1) {
    console.log("One default argument required");
    process.exit();
  }

  // Does file exist?
  if (!fs.existsSync(file)) {
    console.log("File %s does not exist", file);
    process.exit();
  }
  const source = fs.readFileSync(file, { encoding: argv.encoding ?? 'utf8' });

  const opts = parseArgString(process.argv, true);
  if (opts.imag !== undefined) Complex.imagLetter = opts.imag; else opts.imag = Complex.imagLetter;
  opts.app = 'Interpreter';
  opts.dir = path.dirname(file);
  opts.file = path.basename(file);
  const rs = new Runspace(opts);
  define(rs);
  rs.import("io.js");
  if (opts.defineVars) defineVars(rs);
  if (opts.defineFuncs) defineFuncs(rs);

  let start = Date.now(), ret, error;
  try {
    ret = rs.execute(source);
  } catch (e) {
    error = e;
  }

  rs.io.output.write(`${'-'.repeat(25)}\nExecution terminated with code ${error ? 1 : 0} in ${Date.now() - start} ms\n`);
  if (error) {
    if (opts.niceErrors) {
      printError(error, x => rs.io.output.write(x));
    } else {
      console.trace(error);
    }
  } else {
    rs.io.output.write(`Value returned: ${ret}`);
  }

  rs.io.close(); // Close IO stream
}