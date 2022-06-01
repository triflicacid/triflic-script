const process = require("process");
const RunspaceVariable = require("./Variable");
const { tokenify } = require("../evaluation/tokens");
const { createEvalObj } = require("../utils");
const { primitiveToValueClass, MapValue, Value, FunctionRefValue, UndefinedValue, ArrayValue, BoolValue } = require("../evaluation/values");
const { RunspaceFunction } = require("./Function");
const { Block } = require("../evaluation/block");
const { errors } = require("../errors.js");

/**
 * For "normal" behaviour, run setup-io.js and runspace-createImport.js
 */
class Runspace {
  constructor(opts = {}) {
    this._procs = new Map(); // Processes (functions which are executing without async/awaiting on main process)
    this._cpid = 0; // Next process PID
    this._globals = new Map(); // GLobal vars which are inserted when a MAIN process stats (in exec)

    this.opts = opts;
    opts.version = Runspace.VERSION;
    this.opts.name = Runspace.LANG_NAME;
    opts.time = Date.now();
    this._storeAns = !!opts.ans;
    this.root = ""; // MUST BE SET EXTERNALLY

    this.importStack = [this.root]; // Stack of import directories

    if (opts.revealHeaders) this.defineHeaderVar();

    this.stdin = process.stdin;
    this.stdout = process.stdout;
    this._instances = new Map();
    this._cilvl = 0;

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
  defineVar(name, value = undefined, desc = undefined, pid = undefined) {
    if (value === undefined) value = new UndefinedValue(this);
    let obj;
    if (value instanceof Value || value instanceof RunspaceFunction) obj = new RunspaceVariable(name, value, desc);
    else if (value instanceof RunspaceVariable) obj = value.copy();
    else obj = new RunspaceVariable(name, primitiveToValueClass(this, value), desc);

    if (pid === undefined) {
      this._globals.set(name, obj);
    } else {
      if (!this._procs.has(pid)) throw new Error(`[${errors.NAME}] Name Error: no process with PID=${pid} (whilst defining ${name})`);
      const vars = this._procs.get(pid).vars;
      vars[vars.length - 1].set(name, obj); // Insert into top-level scope
    }
    return obj;
  }

  /** Define variable 'headers' from this.opts */
  defineHeaderVar() {
    const map = new MapValue(this);
    Object.entries(this.opts).forEach(([k, v]) => map.value.set(k, primitiveToValueClass(this, v)));
    return this.defineVar('headers', map, 'Config headers of current runspace [readonly]', undefined);
  }

  /** Set a variable to a value. Return Variable object or false. */
  setVar(name, value, startingScope = undefined, pid = undefined) {
    if (pid === undefined) {
      if (this._globals.has(name)) {
        const vo = this._globals.get(name);
        vo.value = value;
        return vo;
      }
    } else {
      if (!this._procs.has(pid)) throw new Error(`[${errors.NAME}] Name Error: no process with PID=${pid} (whilst setting ${name})`);
      const vars = this._procs.get(pid).vars;
      if (startingScope === undefined) startingScope = vars.length - 1;
      for (let i = startingScope; i >= 0; i--) {
        if (vars[i].has(name)) {
          const vo = vars[i].get(name);
          vo.value = value;
          return vo;
        }
      }
    }
    return false;
  }

  /** Set a variable equivalent to another variable. Return Variable object or false. */
  setVarObj(name, variable, startingScope = undefined, pid = undefined) {
    if (pid === undefined) {
      if (this._globals.has(name)) {
        this._globals.set(name, variable);
        return variable;
      }
    } else {
      const vars = this._procs.get(pid).vars;
      if (startingScope === undefined) startingScope = vars.length - 1;
      for (let i = startingScope; i >= 0; i--) {
        if (vars[i].has(name)) {
          vars[i].set(name, variable);
          return variable;
        }
      }
    }
    return false;
  }

  /** Set a global variable to a value (scope lvl = 0). Return Variable object. */
  setGlobalVar(name, value, pid = undefined) {
    const vo = pid === undefined ? this._globals.get(name) : this._procs.get(pid).vars[0].get(name);
    vo.value = value;
    return vo;
  }

  /** Get a variable (or undefined) of the current process. If none found, try global scope */
  getVar(name, pid = undefined) {
    if (pid !== undefined) {
      if (!this._procs.has(pid)) throw new Error(`[${errors.NAME}] Name Error: no process with PID=${pid} (whilst getting ${name})`);
      const vars = this._procs.get(pid).vars;
      for (let i = vars.length - 1; i >= 0; i--) {
        if (vars[i].has(name)) {
          return vars[i].get(name);
        }
      }
    }
    return this._globals.get(name);
  }

  deleteVar(name, pid = undefined) {
    if (pid === undefined) {
      if (this._globals.has(name)) {
        this._globals.delete(name);
        return true;
      }
    } else {
      const vars = this._procs.get(pid).vars;
      for (let i = vars.length - 1; i >= 0; i--) {
        if (vars[i].has(name)) {
          vars[i].delete(name);
          return true;
        }
      }
    }
    return false;
  }

  /** Store answer variable for given process? */
  storeAns(v = undefined, pid = 0) {
    const proc = this._procs.get(pid);
    if (v === undefined) return proc.ans;
    proc.ans = !!v;
    if (proc.ans) {
      this.defineVar('ans', this.UNDEFINED, 'Store result of last execution', pid);
    } else {
      this.deleteVar('ans', pid);
    }
    return proc.ans;
  }

  /** Create new execution instance, return object */
  create_instance() {
    let ilvl = this._cilvl++;
    const obj = {
      ilvl,
      global: undefined, // GLOBAL block
      blocks: new Map(), // Other blocks
    };
    this._instances.set(ilvl, obj);
    return obj;
  }

  get_instance(ilvl) {
    return this._instances.get(ilvl);
  }

  /** Remove instance */
  remove_instance(ilvl) {
    this._instances.delete(ilvl);
  }

  /** Push a new block to given execution instance */
  push_instance_block(block, ilvl) {
    this._instances.get(ilvl).blocks.set(block.id, block);
  }

  /** Push new variable scope */
  pushScope(pid = 0) {
    this._procs.get(pid).vars.push(new Map());
  }

  /** Pop variable scope */
  popScope(pid = 0) {
    this._procs.get(pid).vars.pop();
  }

  /** Define a function - defines a variable with a reference to the function */
  defineFunc(fn, pid = undefined) {
    return this.defineVar(fn.name, new FunctionRefValue(this, fn), undefined, pid);
  }

  /** Add process. Return process ID */
  create_process(evalObj, ilvl) {
    let pid = this._cpid++;
    this._procs.set(pid, {
      pid,
      evalObj,
      ilvl, // Instance level
      ans: this._storeAns,
      vars: [new Map()], // Arrays represents different scopes.
      children: [], // Array of child processes
      imported_files: [],
      import_stack: [],
    });
    return pid;
  }

  get_process(pid) {
    return this._procs.get(pid);
  }

  /** Terminate process and children (do not terminate if have children, unless sudo) */
  terminate_process(pid, sudo, exit_code = 0) {
    const proc = this._procs.get(pid);
    if (!proc || (!sudo && proc.children.length !== 0)) return false;
    let ok = true;
    for (let i = proc.children.length - 1; i >= 0; --i) {
      let child_ok = this.terminate_process(proc.chilren[i], sudo);
      if (child_ok) proc.children.splice(i, 1);
      ok = ok && child_ok;
    }
    if (ok) {
      proc.evalObj.action = -1;
      proc.evalObj.actionValue = exit_code;
    }
    return ok;
  }

  /** Create an execution instance */
  create_exec_instance() {
    const instance = this.create_instance();
    const obj = createEvalObj(null, null);
    const pid = this.create_process(obj, instance.ilvl);
    obj.pid = pid;

    return { ilvl: instance.ilvl, pid };
  }

  terminate_exec_instance(exec_instance, exit_code = undefined) {
    this.remove_instance(exec_instance.ilvl);
    this.terminate_process(exec_instance.pid, true, exit_code);
  }

  /** Execute source code inside of an instance. If there is an error, terminate the process */
  async exec(exec_instance, source, singleStatement = false, data = {}) {
    const instance = this._instances.get(exec_instance.ilvl);
    const mainProc = this._procs.get(exec_instance.pid);
    try {
      let start = Date.now(), value;
      let lines = tokenify(this, source, singleStatement);
      instance.global = new Block(this, lines, lines[0]?.[0]?.pos ?? NaN, exec_instance, undefined);
      instance.global.prepare();
      let obj = createEvalObj(null, null);
      obj.exec_instance = exec_instance; // Reference the current execution instance
      data.parse = Date.now() - start;

      start = Date.now();
      for (let [blockID, block] of instance.blocks) await block.preeval(obj); // Pre-evaluation
      value = await instance.global.eval(obj); // Evaluate program
      data.exec = Date.now() - start;

      data.status = obj.action;
      data.statusValue = obj.actionValue;

      value = value.castTo('any');
      return value;
    } catch (e) {
      throw new Error(`In file '${mainProc.imported_files}':\n${e}`);
    }
  }
}

Runspace.LANG_NAME = "TriflicScript";
Runspace.VERSION = 1.100;

module.exports = Runspace;