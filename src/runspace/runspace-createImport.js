const Runspace = require("./Runspace");
const fs = require("fs");
const path = require("path");
const { errors } = require("../errors");

/** Attempt to import a file. Throws error of returns Value instance. */
Runspace.prototype.import = async function (file) {
  let fpath;
  if (file[0] === '<' && file[file.length - 1] === '>') {
    fpath = path.join(this.root, "imports/", file.substring(1, file.length - 1) + '.js');
  } else {
    fpath = path.join(this.importStack[this.importStack.length - 1], file.toString());
  }
  if (this.importFiles.includes(fpath)) { // Circular import?
    throw new Error(`[${errors.BAD_IMPORT}] Import Error: circular import '${fpath}'`);
  }

  // Setup history
  let _isMain = this.getVar('_isMain').castTo('bool');
  this.setVar('_isMain', this.FALSE);
  const restore = () => {
    this.setVar('_isMain', _isMain);
    this.importStack.pop();
    this.importFiles.pop();
  };

  this.importStack.push(path.dirname(fpath));
  this.importFiles.push(fpath);
  let stats;
  try {
    stats = fs.lstatSync(fpath);
  } catch (e) {
    restore();
    throw new Error(`[${errors.BAD_ARG}] Argument Error: cannot locate file '${file}' (path '${fpath}'):\n${e}`);
  }

  if (stats.isFile()) {
    const ext = path.extname(fpath);
    if (ext === '.js') {
      let fn;
      try {
        fn = require(fpath);
      } catch (e) {
        restore();
        throw new Error(`[${errors.BAD_IMPORT}] Import Error: .js: error whilst requiring ${fpath}:\n${e}`);
      }
      if (typeof fn !== 'function') throw new Error(`[${errors.BAD_IMPORT}] Import Error: .js: expected module.exports to be a function, got ${typeof fn} (full path: ${fpath})`);
      let resp;
      try {
        resp = await fn(this);
      } catch (e) {
        restore();
        console.error(e);
        throw new Error(`[${errors.BAD_IMPORT}] Import Error: .js: error whilst executing ${fpath}'s export function:\n${e}`);
      }

      restore();
      return resp ?? this.UNDEFINED;
    } else {
      let text;
      try {
        text = fs.readFileSync(fpath, 'utf8');
      } catch (e) {
        restore();
        throw new Error(`[${errors.BAD_IMPORT}] Import Error: ${ext}: unable to read file (full path: ${fpath}):\n${e}`);
      }

      let ret;
      try {
        ret = await this.execute(text);
      } catch (e) {
        restore();
        throw new Error(`[${errors.BAD_IMPORT}] Import Error: ${ext}: Error whilst interpreting file (full path: ${fpath}):\n${e}`);
      }

      restore();
      return ret ?? this.UNDEFINED;
    }
  } else {
    restore();
    throw new Error(`[${errors.BAD_ARG}] Argument Error: path is not a file (full path: ${fpath})`);
  }
};