const RunspaceVariable = require("./Variable");
const { tokenify } = require("../evaluation/tokens");
const { createEvalObj } = require("../utils");
const { primitiveToValueClass, MapValue, Value, FunctionRefValue, UndefinedValue, ArrayValue, BoolValue } = require("../evaluation/values");
const { Block } = require("../evaluation/block");
const { errors } = require("../errors");

/**
 * For "normal" behaviour, run setup-io.js and runspace-createImport.js
 */
class Runspace {
  constructor(opts = {}) {
    this._procs = new Map(); // Processes (functions which are executing without async/awaiting on main process)
    this._cpid = 0; // Next process PID
    this._globals = new Map(); // GLobal vars which are inserted when a MAIN process stats (in exec)

    // Finish setup of opts -> headers
    opts.version = Runspace.VERSION;
    opts.name = Runspace.LANG_NAME;
    opts.time = Date.now();
    const map = new MapValue(this);
    Object.entries(opts).forEach(([k, v]) => map.value.set(k, primitiveToValueClass(this, v)));
    this.defineVar('headers', map, 'Config headers of current runspace [readonly]', undefined);
    this.opts = map;

    this.root = ""; // MUST BE SET EXTERNALLY

    this.stdin = null;
    this.stdout = null;

    this.onLineHandler = undefined;
    this.onDataHandler = undefined;

    this.defineVar('_isMain', true, 'Are we currently in a MAIN script (i.e. not an import) ?');
  }
  get UNDEFINED() { return new UndefinedValue(this); }
  get TRUE() { return new BoolValue(this, true); }
  get FALSE() { return new BoolValue(this, false); }

  /** Create ArrayValue */
  generateArray(items = undefined) {
    return new ArrayValue(this, items);
  }

  /** Create MapValue */
  generateMap(map = undefined) {
    return new MapValue(this, map);
  }

  /** Declare a new variable in the topmost scope. Return variable object */
  defineVar(name, value = undefined, desc = undefined, pid = undefined) {
    if (value === undefined) value = new UndefinedValue(this);
    if (!(value instanceof Value)) value = primitiveToValueClass(this, value);
    const obj = new RunspaceVariable(name, value, desc);

    if (pid === undefined) {
      this._globals.set(name, obj);
    } else {
      if (!this._procs.has(pid)) throw new Error(`[${errors.NAME}] Name Error: no process with PID=${pid} (whilst defining ${name})`);
      const vars = this._procs.get(pid).vars;
      vars[vars.length - 1].set(name, obj); // Insert into top-level scope
    }
    return obj;
  }

  /** Set a variable to a value. Return Variable object or false. */
  setVar(name, value, startingScope = undefined, pid = undefined) {
    if (pid !== undefined) {
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
    if (this._globals.has(name)) {
      const vo = this._globals.get(name);
      vo.value = value;
      return vo;
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

  /** Push new variable scope */
  pushScope(pid = 0, map = undefined) {
    this._procs.get(pid).vars.push(map || (new Map()));
  }

  /** Return topmost scope */
  peekScope(pid = 0) {
    if (this._procs.has(pid)) {
      let scopes = this._procs.get(pid).vars;
      return scopes.length === 0 ? undefined : scopes[scopes.length - 1];
    }
  }

  /** Pop variable scope */
  popScope(pid = 0) {
    if (this._procs.has(pid)) this._procs.get(pid).vars.pop();
  }

  /** Define a function - defines a variable with a reference to the function */
  defineFunc(fn, pid = undefined) {
    return this.defineVar(fn.name, new FunctionRefValue(this, fn), undefined, pid);
  }

  /** Add process. Return process ID */
  create_process() {
    let pid = this._cpid++;
    this._procs.set(pid, {
      pid,
      dieonerr: true,
      state: 0, // 0 -> dormant. 1 -> running. 2 -> error. 3 -> killed
      stateValue: undefined, // state: =0 -> state of last execution. =1 -> {started,Promise}. =2 -> Error object. =3 -> exit code
      vars: [new Map()], // Arrays represents different scopes.

      // Hierarchy
      parent: null, // PID of parent
      children: [], // Array of child processes

      // Handle imports
      imported_files: [],
      import_stack: [this.root],

      // Handle code blocks
      blocks: new Map(), // Other blocks

      elhandled: null, // For eventloop; records for which state this was handled for
    });
    this.defineVar('ans', this.UNDEFINED, 'Store result of last execution', pid); // Define ans
    return pid;
  }

  /** Process: create parent-child relationship */
  process_adopt(parentPID, childPID) {
    let parent = this._procs.get(parentPID), child = this._procs.get(childPID);
    if (parent === undefined) throw new Error(`[${errors.NAME}] Name Error: no process with PID=${parentPID}`);
    if (child === undefined) throw new Error(`[${errors.NAME}] Name Error: no process with PID=${childPID}`);
    if (child.parent !== null) return false; // Already has a parent
    if (parent.children.indexOf(childPID) === -1) {
      parent.children.push(childPID);
      child.parent = parentPID;

      // Clone variable stack of parent into child
      let vmap = new Map();
      for (let i = parent.vars.length - 1; i >= 0; i--) {
        for (let [name, obj] of parent.vars[i]) {
          vmap.set(name, obj.deepCopy());
        }
      }
      if (child.vars.length === 0) child.vars.push(vmap);
      else child.vars[0] = new Map([...vmap, ...child.vars[0]]);
    }
    return true;
  }

  /** Process: remove child */
  process_unadopt(parentPID, childPID) {
    let parent = this._procs.get(parentPID), child = this._procs.get(childPID);
    if (parent === undefined) throw new Error(`[${errors.NAME}] Name Error: no process with PID=${parentPID}`);
    if (child === undefined) throw new Error(`[${errors.NAME}] Name Error: no process with PID=${childPID}`);
    if (child.parent !== parentPID) return false; // Not our child
    let i = parent.children.indexOf(childPID);
    if (i !== -1) parent.children.splice(i, 1);
    child.parent = null;
    return true;
  }

  get_process(pid) {
    return this._procs.get(pid);
  }

  /** NB also destroys children (CALL terminate_process first!) */
  destroy_process(pid) {
    let proc = this._procs.get(pid);
    for (let cpid of proc.children) this.destroy_process(cpid);
    return this._procs.delete(pid);
  }

  /** Terminate process and children (do not terminate if have children, unless sudo. Does not actually remove the process) */
  terminate_process(pid, exit_code = 0, sudo = false) {
    const proc = this._procs.get(pid);
    if (!proc || (!sudo && proc.children.length !== 0)) return false;
    let ok = true;
    for (let i = proc.children.length - 1; i >= 0; --i) {
      let child_ok = this.terminate_process(proc.children[i], sudo);
      if (child_ok) proc.children.splice(i, 1);
      ok = ok && child_ok;
    }
    if (ok) {
      proc.stateValue?.promise?.reject?.();
      proc.state = 3;
      proc.stateValue = exit_code;
    }
    return ok;
  }

  /** Execute source code inside of an instance. If there is an error, terminate the process */
  async exec(pid, source, singleStatement = false) {
    if (!this._procs.has(pid)) throw new Error(`FATAL: cannot execute code in an unexistant process (PID=${pid})`);
    const mainProc = this._procs.get(pid);
    if (mainProc.state === 0 || mainProc.state === 1) {
      try {
        mainProc.elhandled = null;
        mainProc.state = 1; // RUNNING
        let data = {}, value, started = Date.now();
        mainProc.stateValue = { started };

        let lines = tokenify(this, source, singleStatement);
        const globalBlock = new Block(this, lines, lines[0]?.[0]?.pos ?? NaN, pid, undefined);
        globalBlock.prepare();
        let obj = createEvalObj(null, null, pid);
        data.parse = Date.now() - mainProc.stateValue.started;

        started = Date.now();
        for (let [blockID, block] of mainProc.blocks) await block.preeval(obj); // Pre-evaluation
        mainProc.stateValue.promise = globalBlock.eval(obj); // Evaluate program
        value = await mainProc.stateValue.promise;
        data.exec = Date.now() - started;

        value = value ? value.castTo('any') : this.UNDEFINED;
        data.ret = value;
        data.status = obj.action;
        data.statusValue = obj.actionValue;

        // Artificial error?
        if (mainProc.state === 1) {
          mainProc.state = 0;
          mainProc.stateValue = data;
        }
      } catch (e) {
        const err = new Error(`Process ${pid} in '${mainProc.imported_files[mainProc.imported_files.length - 1]}':\n${e}`);
        mainProc.state = 2;
        mainProc.stateValue = err;
      }
    } else {
      throw new Error(`FATAL: cannot execute code on process PID=${pid} as it is not dormant (STATE=${mainProc.state})`);
    }
  }

  /** Check if process is COMPLETELY finished (check children aswell) */
  process_isfinished(pid) {
    let proc = this._procs.get(pid);
    if (proc.state === 1) {
      return false;
    } else { // Awesome! Check if any children are still running though...
      if (proc.children.length === 0) return true;
      let fin = true;
      for (let i = 0; i < proc.children.length; ++i) fin = fin && this.process_isfinished(proc.children[i]);
      if (fin) proc.elhandled = null; // Update again
      return fin;
    }
  }
}

Runspace.LANG_NAME = "TriflicScript";
Runspace.VERSION = 1.163;

module.exports = Runspace;