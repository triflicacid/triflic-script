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
const { ArrayValue, primitiveToValueClass } = require("./src/evaluation/values");
const setupIo = require("./src/runspace/setup-io");

async function main() {
  if (process.argv.length < 3 || process.argv.includes("--help")) {
    console.log(`Usage: 'node file.js <file> [args]`);
    return 0;
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
    rs.root = __dirname;
    define(rs);
    defineNode(rs);
    defineVars(rs);
    if (opts.defineFuncs) defineFuncs(rs);

    const exec_instance = rs.create_exec_instance(), mainProc = rs.get_process(exec_instance.pid);

    mainProc.imported_files.push(file);
    // Setup things
    setupIo(rs);
    require("./src/runspace/runspace-createImport");

    await rs.import(exec_instance, "<io>");

    rs.defineVar('argv', new ArrayValue(rs, process.argv.slice(3).map(v => primitiveToValueClass(rs, v))), 'Arguments provided to the program');

    let start = Date.now(), ret, error, time, evalObj = {};
    try {
      mainProc.import_stack.push(path.dirname(file));
      ret = await rs.exec(exec_instance, source, undefined, evalObj);
      exitCode = evalObj.statusValue?.toString() ?? 0;
      time = Date.now() - start;
      mainProc.import_stack.pop();
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
    rs.terminate_exec_instance(exec_instance, exitCode);

    return exitCode;
  }
}

(async function () {
  let start = Date.now();
  let code = await main();
  console.log("\nProcess exited with code %i after %i ms", code, Date.now() - start);
})();