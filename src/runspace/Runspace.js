const process = require("process");
const RunspaceVariable = require("./Variable");
const { tokenify } = require("../evaluation/tokens");
const { createEvalObj } = require("../utils");
const { primitiveToValueClass, MapValue, Value, FunctionRefValue, UndefinedValue, ArrayValue, BoolValue } = require("../evaluation/values");
const { RunspaceFunction } = require("./Function");
const { Block } = require("../evaluation/block");

/**
 * For "normal" behaviour, run setup-io.js and runspace-createImport.js
 */
class Runspace {
  constructor(opts = {}) {
    this._vars = [new Map()]; // Arrays represents different scopes

    this.opts = opts;
    opts.version = Runspace.VERSION;
    this.opts.name = Runspace.LANG_NAME;
    opts.time = Date.now();
    this.storeAns(!!opts.ans);
    this.root = ""; // MUST BE SET EXTERNALLY

    this.importStack = [this.root]; // Stack of import directories
    this.importFiles = []; // Stack of imported files - stops circular imports

    if (opts.revealHeaders) this.defineHeaderVar();

    this.stdin = process.stdin;
    this.stdout = process.stdout;
    this._instances = [];

    this.onLineHandler = undefined;
    this.onDataHandler = undefined;

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
  defineVar(name, value = undefined, desc = undefined) {
    if (value === undefined) value = new UndefinedValue(this);
    let obj;
    if (value instanceof Value || value instanceof RunspaceFunction) obj = new RunspaceVariable(name, value, desc);
    else if (value instanceof RunspaceVariable) obj = value.copy();
    else obj = new RunspaceVariable(name, primitiveToValueClass(this, value), desc);

    this._vars[this._vars.length - 1].set(name, obj); // Insert into top-level scope
    return obj;
  }

  /** Define variable 'headers' from this.opts */
  defineHeaderVar() {
    const map = new MapValue(this);
    Object.entries(this.opts).forEach(([k, v]) => map.value.set(k, primitiveToValueClass(this, v)));
    return this.defineVar('headers', map, 'Config headers of current runspace [readonly]', true);
  }

  /** Set a variable to a value. Return Vara=iable object or false. */
  setVar(name, value, startingScope = undefined) {
    if (startingScope === undefined) startingScope = this._vars.length - 1;
    for (let i = startingScope; i >= 0; i--) {
      if (this._vars[i].has(name)) {
        const vo = this._vars[i].get(name);
        vo.value = value;
        return vo;
      }
    }
    return false;
  }

  /** Set a variable equivalent to another variable. Return Variable object or false. */
  setVarObj(name, variable, startingScope = undefined) {
    if (startingScope === undefined) startingScope = this._vars.length - 1;
    for (let i = startingScope; i >= 0; i--) {
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

  /** Create 'me' varianle */
  createMeVar() {
    return new RunspaceVariable('me', new MapValue(this), 'Object stored in current block', true);
  }

  /** Push new execution instance */
  pushInstance() {
    const obj = {
      global: undefined, // GLOBAL block
      blocks: new Map(), // Other blocks
    };
    this._instances.push(obj);
    return obj;
  }

  /** Pop instance */
  popInstance() {
    this._instances.pop();
  }

  /** Push a new block to current instance */
  pushInstanceBlock(block) {
    this._instances[this._instances.length - 1].blocks.set(block.id, block);
  }

  /** Get current instance */
  getCurrentInstance() { return this._instances[this._instances.length - 1]; }

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
  async execute(source, singleStatement = undefined, data = {}) {
    const lvl = this._instances.length;
    const instance = this.pushInstance();

    try {
      let start = Date.now(), value;
      let lines = tokenify(this, source, singleStatement);
      instance.global = new Block(this, lines, lines[0]?.[0]?.pos ?? NaN, undefined);
      instance.global.prepare();
      data.parse = Date.now() - start;

      let obj = createEvalObj(null, null);
      start = Date.now();
      for (let [blockID, block] of instance.blocks) await block.preeval(obj); // Pre-evaluation
      value = await instance.global.eval(obj); // Evaluate program
      data.exec = Date.now() - start;

      data.status = obj.action;
      data.statusValue = obj.actionValue;

      this.popInstance();
      value = value.castTo('any');
      return value;
    } catch (e) {
      this.popInstance();
      throw new Error(`In file '${this.importFiles[lvl]}':\n${e}`);
    }
  }
}

Runspace.LANG_NAME = "TriflicScript";
Runspace.VERSION = 1.005;

module.exports = Runspace;