const RunspaceVariable = require("./Variable");
const { TokenString, Token } = require("../evaluation/tokens");
const { peek } = require("../utils");
const { primitiveToValueClass, MapValue } = require("../evaluation/values");
const { prepareOperators } = require("../evaluation/operators");
const path = require("path");
const fs = require("fs");

class Runspace {
  constructor(opts) {
    this._vars = [{}]; // { variable: EnvVariable }[]
    this._funcs = {}; // { fn_name: EnvFunction }
    this.operators = prepareOperators(this);
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
      if (value instanceof Token) obj = new RunspaceVariable(name, value, desc, constant);
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
  }

  /** Pop variable scope */
  popScope() {
    if (this._vars.length > 1) this._vars.pop();
  }

  /** Get/Set/Delete a function */
  func(name, body = undefined) {
    if (body === null) {
      return delete this._funcs[name];
    } else if (body !== undefined) {
      this._funcs[name] = body;
    }
    return this._funcs[name];
  }

  /** Define a function */
  define(fn) {
    return this.func(fn.name, fn);
  }

  /** Define a function alias */
  funcAlias(name, aliasName) {
    let original = this.func(name);
    if (original === undefined) throw new Error(`Cannot create alias for '${name}' as it is not a function`);
    let copy = original.clone();
    copy.name = aliasName; // Change name
    this.func(aliasName, copy);
  }

  /** Return a new TokenString */
  parseString(string) {
    return new TokenString(this, string);
  }

  eval(string) {
    const ts = new TokenString(this, string);
    let obj = ts.eval(); // Intermediate value
    if (this._storeAns) this._vars[0].ans = new RunspaceVariable('ans', obj.eval('any'), 'value returned by previous statement');
    return obj.toString();
  }

  /** Attempt to import a file */
  import(file) {
    const fpath = path.join(this.dir, "imports/", file.toString());
    let stats;
    try {
      stats = fs.lstatSync(fpath);
    } catch (e) {
      throw new Error(`Argument Error: invalid path '${fpath}':\n${e}`);
    }

    if (stats.isFile()) {
      const ext = path.extname(fpath);
      if (ext === '.js') {
        let fn;
        try {
          fn = require(fpath);
        } catch (e) {
          throw new Error(`Import Error: .js: error whilst requiring ${fpath}:\n${e}`);
        }
        if (typeof fn !== 'function') throw new Error(`Import Error: .js: expected module.exports to be a function, got ${typeof fn} (full path: ${fpath})`);
        try {
          fn(this);
        } catch (e) {
          console.error(e);
          throw new Error(`Import Error: .js: error whilst executing ${fpath}'s export function:\n${e}`);
        }
      } else {
        let text;
        try {
          text = fs.readFileSync(fpath, 'utf8');
        } catch (e) {
          throw new Error(`Import Error: ${ext}: unable to read file (full path: ${fpath}):\n${e}`);
        }

        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          try {
            this.eval(lines[i]);
          } catch (e) {
            throw new Error(`Import Error: ${ext}: Error whilst interpreting file (full path: ${fpath}), line ${i + 1}:\n${e}`);
          }
        }
      }
    } else {
      throw new Error(`Argument Error: path is not a file (full path: ${fpath})`);
    }
  }
}

module.exports = Runspace;