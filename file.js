const process = require("process");
const { parseArgString } = require("./src/init/args");
const fs = require("fs");
const path = require("path");
const Complex = require("./src/maths/Complex");
const { define, defineVars, defineFuncs } = require("./src/init/def");
const defineNode = require("./src/init/def-node");
const Runspace = require("./src/runspace/Runspace");
const { ArrayValue, primitiveToValueClass } = require("./src/evaluation/values");
const { setupIO, destroyIO } = require("./src/runspace/setup-io");
const startEventLoop = require("./src/runspace/event-loop");

async function main() {
  if (process.argv.length < 3 || process.argv.includes("--help")) {
    console.log(`Usage: 'node file.js <file> [args]`);
    return 0;
  } else {
    // Find file
    let argv = parseArgString(process.argv.slice(2).join(" "));
    let file = argv._[0];
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

    const mpid = rs.create_process(), mainProc = rs.get_process(mpid);
    mainProc.imported_files.push(file);
    // Setup things
    setupIO(rs);
    require("./src/runspace/runspace-createImport");
    await rs.import(mpid, "<io>");

    rs.defineVar('argv', new ArrayValue(rs, process.argv.slice(3).map(v => primitiveToValueClass(rs, v))), 'Arguments provided to the program');

    mainProc.import_stack.push(path.dirname(file));

    rs.exec(mpid, source);

    await startEventLoop(rs, proc => {
      if (proc.pid === mpid && rs.process_isfinished(proc.pid)) {
        proc.import_stack.pop();
        exitCode = proc.state === 0 ? proc.stateValue.status : -1;
        rs.io.output.write(`${'-'.repeat(24)}\nExecution terminated with code ${exitCode} in ${proc.stateValue.parse + proc.stateValue.exec} ms (${proc.stateValue.parse} ms parsing, ${proc.stateValue.exec} ms execution)\n`);
        if (proc.state === 0) {
          rs.io.output.write(`Value returned: ${proc.stateValue.ret.toString()}`);
        }

        rs.terminate_process(proc.pid, -1, true);
      }
    });
    destroyIO(rs);

    return exitCode;
  }
}

(async function () {
  let start = Date.now();
  let code = await main();
  console.log("\nProcess exited with code %i after %i ms", code, Date.now() - start);
})();