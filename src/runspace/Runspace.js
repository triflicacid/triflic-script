const readline = require("readline");
const process = require("process");
const RunspaceVariable = require("./Variable");
const { tokenify } = require("../evaluation/tokens");
const { createEvalObj } = require("../utils");
const { primitiveToValueClass, MapValue, Value, FunctionRefValue, UndefinedValue, ArrayValue, BoolValue } = require("../evaluation/values");
const path = require("path");
const fs = require("fs");
const { RunspaceFunction } = require("./Function");
const { errors } = require("../errors");
const { Block } = require("../evaluation/block");

class Runspace {
  constructor(opts = {}) {
    this._vars = [new Map()]; // Arrays represents different scopes

    this.opts = opts;
    opts.version = 0.889;
    opts.time = Date.now();
    this.storeAns(!!opts.ans);
    this.root = path.join(__dirname, '../../');
    opts.rootDir = this.root;

    this.importStack = [this.root];

    if (opts.revealHeaders) {
      const map = new MapValue(this);
      Object.entries(this.opts).forEach(([k, v]) => map.value.set(k, primitiveToValueClass(this, v)));
      this.defineVar('headers', map, 'Config headers of current runspace [readonly]', true);
    }

    this.stdin = process.stdin;
    this.stdout = process.stdout;
    this.io = readline.createInterface({
      input: this.stdin,
      output: this.stdout,
    });
    this.block = undefined; // Top-most Block object
    this._blocks = new Map(); // Map all blockIDs to the block

    this.onLineHandler = undefined;
    this.onDataHandler = undefined;

    this.io.on('line', line => this.onLineHandler?.(this.io, line));
    this.stdin.on('data', async key => {
      if (this.onDataHandler) await this.onDataHandler(this.io, key);
    });

    this.defineVar('_isMain', true, 'Are we currently in a MAIN script (i.e. not an import) ?');
  }

  get UNDEFINED() { return new UndefinedValue(this); }
  get TRUE() { return new BoolValue(this, true); }
  get FALSE() { return new BoolValue(this, false); }

  /** Create ArrayValue */
  generateArray(items) {
    return new ArrayValue(this, items);
  }

  /** Declare a new variable in the topmost scope. Return variable object */
  defineVar(name, value = undefined, desc = undefined, constant = false) {
    if (value === undefined) value = new UndefinedValue(this);
    let obj;
    if (value instanceof Value || value instanceof RunspaceFunction) obj = new RunspaceVariable(name, value, desc, constant);
    else if (value instanceof RunspaceVariable) obj = value.copy();
    else obj = new RunspaceVariable(name, primitiveToValueClass(this, value), desc, constant);

    this._vars[this._vars.length - 1].set(name, obj); // Insert into top-level scope
    return obj;
  }

  /** Set a variable to a value. Return Vara=iable object or false. */
  setVar(name, value) {
    for (let i = this._vars.length - 1; i >= 0; i--) {
      if (this._vars[i].has(name)) {
        const vo = this._vars[i].get(name);
        vo.value = value;
        return vo;
      }
    }
    return false;
  }

  /** Set a variable equivalent to another variable. Return Variable object or false. */
  setVarObj(name, variable) {
    for (let i = this._vars.length - 1; i >= 0; i--) {
      if (this._vars[i].has(name)) {
        this._vars[i].set(name, variable);
        return variable;
      }
    }
    return false;
  }

  /** Set a global variable to a value. Return Variable object. */
  setGlobalVar(name, value) {
    const vo = this._vars[0].get(name);
    vo.value = value;
    return vo;
  }

  /** Get a variable (or undefined) */
  getVar(name) {
    for (let i = this._vars.length - 1; i >= 0; i--) {
      if (this._vars[i].has(name)) {
        return this._vars[i].get(name);
      }
    }
    return undefined;
  }

  deleteVar(name) {
    for (let i = this._vars.length - 1; i >= 0; i--) {
      if (this._vars[i].has(name)) {
        this._vars[i].delete(name);
        return true;
      }
    }
    return false;
  }

  storeAns(v = undefined) {
    if (v === undefined) return this._storeAns;
    this._storeAns = !!v;
    if (this._storeAns) {
      this.defineVar('ans', this.UNDEFINED, 'Store result of last execution');
    } else {
      this.deleteVar('ans');
    }
    return this._storeAns;
  }

  /** Push new variable scope */
  pushScope() {
    this._vars.push(new Map());
  }

  /** Pop variable scope */
  popScope() {
    this._vars.pop();
  }

  /** Define a function - defines a variable with a reference to the function */
  defineFunc(fn) {
    return this.defineVar(fn.name, new FunctionRefValue(this, fn));
  }

  /** Execute source code */
  async execute(source, singleStatement = undefined, timingObj = {}) {
    this._blocks.clear();

    let start = Date.now(), value;
    let lines = tokenify(this, source, singleStatement);
    this.block = new Block(this, lines, lines[0]?.[0]?.pos ?? NaN, undefined);
    this.block.prepare();
    timingObj.parse = Date.now() - start;

    let obj = createEvalObj(null, null);
    start = Date.now();
    value = await this.block.eval(obj);
    timingObj.exec = Date.now() - start;

    this._blocks.clear();
    return value;
  }

  /** Attempt to import a file. Throws error of returns Value instance. */
  async import(file) {
    let fpath;
    let _isMain = this.getVar('_isMain').castTo('bool');
    this.setVar('_isMain', this.FALSE);
    const restore = () => {
      this.setVar('_isMain', _isMain);
      this.importStack.pop();
    };
    if (file[0] === '<' && file[file.length - 1] === '>') {
      fpath = path.join(this.root, "imports/", file.substring(1, file.length - 1) + '.js');
    } else {
      fpath = path.join(this.importStack[this.importStack.length - 1], file.toString());
    }
    this.importStack.push(path.dirname(fpath));
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
        return resp ?? new UndefinedValue(this);
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
          throw e;
          restore();
          throw new Error(`[${errors.BAD_IMPORT}] Import Error: ${ext}: Error whilst interpreting file (full path: ${fpath}):\n${e}`);
        }

        restore();
        return ret ?? new UndefinedValue(this);
      }
    } else {
      restore();
      throw new Error(`[${errors.BAD_ARG}] Argument Error: path is not a file (full path: ${fpath})`);
    }
  }
}

module.exports = Runspace;