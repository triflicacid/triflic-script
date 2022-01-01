const process = require("process");
const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");
const { parseArgString } = require("./src/init/args");
const fs = require("fs");
const path = require("path");
const Complex = require("./src/maths/Complex");
const { define, defineVars, defineFuncs } = require("./src/init/def");
const defineNode = require("./src/init/def-node");
const Runspace = require("./src/runspace/Runspace");
const { printError } = require("./src/utils");
const { ArrayValue, primitiveToValueClass, NumberValue } = require("./src/evaluation/values");
const setupIo = require("./src/runspace/setup-io");

async function main() {
  if (process.argv.includes("--help")) {
    console.log(`Syntax: 'node file.js <file> [args]'`);
    return 1;
  } else {
    // Find file
    let argv = yargs(hideBin(process.argv)).argv, file = argv._[0];
    let exitCode = 0;

    // Does file exist?
    if (!fs.existsSync(file)) {
      console.log("File %s does not exist", file);
      return 1;
    }
    const source = fs.readFileSync(file, 'utf8');

    const opts = parseArgString(process.argv, true);
    if (opts.imag !== undefined) Complex.imagLetter = opts.imag; else opts.imag = Complex.imagLetter;
    opts.app = 'FILE';
    opts.file = file;
    opts.root = __dirname;
    const rs = new Runspace(opts);
    define(rs);
    defineNode(rs);
    if (opts.defineVars) defineVars(rs);
    if (opts.defineFuncs) defineFuncs(rs);
    rs.importFiles.push(file);
    // Setup things
    setupIo(rs);
    require("./src/runspace/runspace-createImport");
    rs.root = __dirname;

    await rs.import("<io>");


    rs.defineVar('argv', new ArrayValue(rs, process.argv.slice(3).map(v => primitiveToValueClass(rs, v))), 'Arguments provided to the program');
    rs.defineVar('VERSION', new NumberValue(rs, Runspace.VERSION), 'Current version of ' + Runspace.LANG_NAME);

    let start = Date.now(), ret, error, time, evalObj = {};
    try {
      rs.importStack.push(path.dirname(file));
      ret = await rs.execute(source, undefined, evalObj);
      exitCode = evalObj.statusValue?.toString() ?? 0;
      time = Date.now() - start;
      rs.importStack.pop();
    } catch (e) {
      error = e;
    }

    rs.io.output.write(`${'-'.repeat(25)}\nExecution terminated with code ${exitCode} in ${time} ms\n`);
    if (opts.timeExecution) rs.io.output.write(`Timings: Took ${time} ms (${evalObj.parse} ms parsing, ${evalObj.exec} ms execution)\n`);
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
    rs.io.removeAllListeners();

    return exitCode;
  }

  return 0;
}

(async function () {
  let start = Date.now();
  let code = await main();
  console.log("\nProcess exited with code %i after %i ms", code, Date.now() - start);
})();