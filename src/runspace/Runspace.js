const RunspaceVariable = require("./Variable");
const { TokenString } = require("../evaluation/tokens");
const { peek } = require("../utils");
const { primitiveToValueClass, MapValue, NumberValue, Value, FunctionRefValue } = require("../evaluation/values");
const path = require("path");
const fs = require("fs");
const { RunspaceFunction } = require("./Function");
const { errors } = require("../errors");

class Runspace {
  constructor(opts) {
    this._vars = [{}]; // { variable: RunspaceVariable }[]
    this._funcs = [{}]; // { func: RunspaceFunction }[]
    this.dir = path.join(__dirname, "../../"); // Requires setting externally

    this.opts = opts;
    this.storeAns(opts.ans);

    if (opts.revealHeaders) {
      const map = new MapValue(this);
      Object.entries(this.opts).forEach(([k, v]) => map.value.set(k, primitiveToValueClass(this, v)));
      this.var('headers', map, 'Config headers of current runspace [readonly]', true);
    }
  }

  var(name, value = undefined, desc = undefined, constant = false) {
    if (value === null) { // Delete variable
      for (let i = this._vars.length - 1; i >= 0; i--) {
        if (this._vars[i].hasOwnProperty(name)) {
          return delete this._vars[i][name];
        }
      }
    } else if (value !== undefined) {
      let obj;
      if (value instanceof Value || value instanceof RunspaceFunction) obj = new RunspaceVariable(name, value, desc, constant);
      else if (value instanceof RunspaceVariable) obj = value.copy();
      else obj = new RunspaceVariable(name, primitiveToValueClass(this, value), desc, constant);

      peek(this._vars)[name] = obj; // Insert into top-level scope
    }
    for (let i = this._vars.length - 1; i >= 0; i--) {
      if (this._vars[i].hasOwnProperty(name)) return this._vars[i][name];
    }
  }

  storeAns(v = undefined) {
    if (v === undefined) return this._storeAns;
    this._storeAns = !!v;
    this.var('ans', this._storeAns ? 0 : null);
    return this._storeAns;
  }

  /** Push new variable scope */
  pushScope() {
    this._vars.push({});
    this._funcs.push({});
  }

  /** Pop variable scope */
  popScope() {
    if (this._vars.length > 1) this._vars.pop();
    if (this._funcs.length > 1) this._funcs.pop();
  }

  /** Get/Set/Delete a function */
  func(name, body = undefined) {
    if (body === null) {
      for (let i = this._funcs.length - 1; i >= 0; i--) {
        if (this._funcs[i].hasOwnProperty(name)) {
          return delete this._funcs[i][name];
        }
      }
    } else if (body !== undefined) {
      peek(this._funcs)[name] = body;
      this.var(name, new FunctionRefValue(this, name)); // Store reference to function as a variable
    }
    for (let i = this._funcs.length - 1; i >= 0; i--) {
      if (this._funcs[i].hasOwnProperty(name)) return this._funcs[i][name];
    }
  }

  /** Define a function */
  define(fn) {
    return this.func(fn.name, fn);
  }

  /** Return a new TokenString. Return rest of string which was not parsed. */
  parseString(string) {
    return new TokenString(this, string);
  }

  /** Evaluate a single string or a TokenString */
  eval(input) {
    let tokenString = input instanceof TokenString ? input : this.parseString(input);
    let obj = tokenString.eval().castTo('any');
    if (this._storeAns) this._vars[0].ans = new RunspaceVariable('ans', obj, 'value returned by previous statement');
    return obj;
  }

  /** Interpret a whole string of code, up to a statement limit. Return { string // What is left //, value // value of latest evaluation //  } */
  interpret(string, statementLimit = Infinity) {
    let statements = 0, value;
    while (string.length !== 0 && statements < statementLimit) {
      const ts = new TokenString(this, string);
      value = this.eval(ts);
      string = string.substring(ts.string.length);
      statements++;
    }
    return { string, value };
  }

  /** Attempt to import a file */
  import(file) {
    const fpath = path.join(this.dir, "imports/", file.toString());
    let stats;
    try {
      stats = fs.lstatSync(fpath);
    } catch (e) {
      throw new Error(`[${errors.BAD_ARG}] Argument Error: invalid path '${fpath}':\n${e}`);
    }

    if (stats.isFile()) {
      const ext = path.extname(fpath);
      if (ext === '.js') {
        let fn;
        try {
          fn = require(fpath);
        } catch (e) {
          throw new Error(`[${errors.BAD_IMPORT}] Import Error: .js: error whilst requiring ${fpath}:\n${e}`);
        }
        if (typeof fn !== 'function') throw new Error(`[${errors.BAD_IMPORT}] Import Error: .js: expected module.exports to be a function, got ${typeof fn} (full path: ${fpath})`);
        let resp;
        try {
          resp = fn(this);
        } catch (e) {
          console.error(e);
          throw new Error(`[${errors.BAD_IMPORT}] Import Error: .js: error whilst executing ${fpath}'s export function:\n${e}`);
        }
        return resp || new NumberValue(this.rs, 0);
      } else {
        let text;
        try {
          text = fs.readFileSync(fpath, 'utf8');
        } catch (e) {
          throw new Error(`[${errors.BAD_IMPORT}] Import Error: ${ext}: unable to read file (full path: ${fpath}):\n${e}`);
        }

        try {
          this.interpret(text);
        } catch (e) {
          throw new Error(`[${errors.BAD_IMPORT}] Import Error: ${ext}: Error whilst interpreting file (full path: ${fpath}):\n${e}`);
        }
      }
    } else {
      throw new Error(`[${errors.BAD_ARG}] Argument Error: path is not a file (full path: ${fpath})`);
    }
  }
}

module.exports = Runspace;