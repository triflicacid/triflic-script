const fs = require('fs');
const path = require('path');
const { ArrayValue, primitiveToValueClass } = require('../../src/evaluation/values');
const { parseArgString } = require('../../src/init/args');
const { defineVars, defineFuncs, define } = require('../../src/init/def');
const Complex = require('../../src/maths/Complex');
const setupIo = require("../../src/runspace/setup-io");
const Runspace = require('../../src/runspace/Runspace');

/** Execute each file in ./ */
async function main() {
  // GET ALL FILES IN DIRECTORY
  const files = fs.readdirSync(__dirname).filter(f => f !== 'test.js' && f !== 'README.md');

  // CREATE EXECUTION INSTANCE
  const opts = parseArgString(process.argv, true);
  if (opts.imag !== undefined) Complex.imagLetter = opts.imag; else opts.imag = Complex.imagLetter;
  opts.app = 'FILE';
  const rs = new Runspace(opts);
  define(rs);
  defineVars(rs);
  if (opts.defineFuncs) defineFuncs(rs);
  setupIo(rs);
  require("../../src/runspace/runspace-createImport");
  await rs.import("<io>");

  rs.defineVar('argv', new ArrayValue(rs, process.argv.slice(3).map(v => primitiveToValueClass(rs, v))), 'Arguments provided to the program');
  let errors = [];
  for (const file of files) {
    let source, fpath = path.join(__dirname, file);
    rs.opts.file = file;
    rs.opts.time = Date.now();
    rs.importFiles.length = 0;
    rs.importFiles.push(fpath);
    rs.defineHeaderVar();
    try {
      source = fs.readFileSync(fpath, { encoding: 'utf8' });
    } catch (e) {
      console.log(`[${file}] ERR : Unable to read file`);
      errors.push(file);
      continue;
    }
    try {
      await rs.execute(source);
    } catch (e) {
      console.log(`[${file}] ERR : Error whilst executing script`);
      errors.push(file);
      continue;
    }
    console.log(`[${file}] OK`);
  }
  console.log(`----- [ DONE ] -----`);
  if (errors.length === 0) {
    console.log(`Completed with 0 errors`);
  } else {
    console.log(`Completed with ${errors.length} errors: ${errors.join(', ')}`);
  }

  rs.io.removeAllListeners();
  rs.io.close();
  console.log("Process exited with code " + (errors.length === 0 ? 0 : 1));
}

main();