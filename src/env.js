const { EnvUserFunction, EnvBuiltinFunction, EnvVariable } = require("./function");
const { TokenString } = require("./token");
const { peek, operators, parseFunction, parseVariable, parseOperator } = require("./utils");
const Complex = require("./Complex");

class Environment {
  constructor(storeAns = true) {
    this._vars = [{}]; // { variable: EnvVariable }[]
    this._funcs = {}; // { fn_name: EnvFunction }

    this.logical = false; // Changes behaviour of some operators to be logical
    this.storeAns(storeAns);
  }

  var(name, value = undefined, desc = undefined) {
    if (value === null) { // Delete variable
      for (let i = this._vars.length - 1; i >= 0; i--) {
        if (this._vars[i].hasOwnProperty(name)) {
          delete this._vars[i][name];
          return;
        }
      }
    } else if (value !== undefined) {
      let obj = value instanceof EnvVariable ? value.copy() : new EnvVariable(name, value, desc);
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
    if (string.startsWith('help(') && string[string.length - 1] === ')') {
      let query = string.substring('help('.length, string.length - 1);
      if (query == undefined || query === '') {
        return `help(?s) \t Get help on a specific symbol\nvars() \t List all variables\nfuncs() \t List all functions\nexit() \t Terminate the program\nvalue(s) \t Retrieve raw value of a symbol`;
      } else if (query === 'help') {
        return `Type: function\nDesc: Returns general help, or help on a provided symbol\nSyntax: help(?s)`;
      } else if (query === 'value') {
        return `Type: function\nDesc: Returns raw value of provided argument (argument is a symbol)\nSyntax: value(s)`;
      } else {
        if (operators.hasOwnProperty(query)) {
          let info = operators[query];
          return `Type: operator\nDesc: ${info.desc}\nPrecedence: ${info.precedence}\nSyntax: ${info.syntax}`;
        } else if (this.func(query) !== undefined) {
          let fn = this.func(query), type = fn instanceof EnvBuiltinFunction ? 'built-in' : 'user-defined'
          return `Type: function [${type}]\nDesc: ${fn.about()}\nSyntax: ${fn.defString()}`;
        } else if (this.var(query) !== undefined) {
          let v = this.var(query);
          return `Type: variable\nDesc: ${v.desc}\nValue: ${v.valueOf()}`;
        } else {
          throw new Error(`Argument Error: Cannot retrieve help on given argument`);
        }
      }
    } else if (string.startsWith('value(') && string[string.length - 1] === ')') {
      let query = string.substring('value('.length, string.length - 1);
      if (query == undefined) {
        return `value(s) \t Get value of a symbol`;
      } else if (query === 'help' || query === 'value') {
        return '[[internal]]';
      } else {
        if (operators.hasOwnProperty(query)) {
          let info = operators[query];
          return info.fn;
        } else if (this.func(query) !== undefined) {
          let fn = this.func(query);
          return `${fn.raw()}`;
        } else if (this.var(query) !== undefined) {
          let v = this.var(query);
          return v.valueOf();
        } else {
          let n = +query;
          if (!isNaN(n)) return n;
          throw new Error(`Argument Error: Unable to retrieve raw value`);
        }
      }
    }

    let parts = string.split(/\=(.+)/);
    if (parts[parts.length - 1] === '') parts.pop(); // Remove empty string '' from end
    if (parts.length === 0) return;
    if (parts[1] && parts[1][0] === '=') parts[0] += '=' + parts.pop();; // Preserve '=='
    parts = parts.map(x => x.trim()); // Now finished processing, remove trailing whitespace

    if (parts.length === 1) {
      const ts = new TokenString(this, parts[0]);
      const ans = ts.eval();
      if (this._storeAns) this._vars[0].ans = ans;
      return ans;
    } else {
      let fname = parseFunction(parts[0]);
      if (fname != null && parts[0][fname.length] === '(') { // FUNCTION DEFINITION
        if (this.var(fname) !== undefined) throw new Error(`Syntax Error: Invalid syntax - symbol '${fname}' is a variable but treated as a function`);
        if (this.func(fname) instanceof EnvBuiltinFunction) throw new Error(`Cannot redefine built-in function ${fname}`);

        let charEnd = parts[0][parts[0].length - 1];
        if (charEnd !== ')') throw new Error(`Syntax Error: expected closing parenthesis, got '${charEnd}'`);

        let fargStr = parts[0].substring(fname.length + 1, parts[0].length - 1);
        let fargsRaw = fargStr.split(','), fargs = [];
        for (let arg of fargsRaw) {
          let symbol = parseVariable(arg);
          if (symbol !== arg) throw new Error(`Syntax Error: Invalid syntax ('${symbol}' arg '${arg}')`);
          fargs.push(symbol);
        }
        const ts = new TokenString(this, parts[1]);
        const fn = new EnvUserFunction(this, fname, fargs, ts, ts.comment || undefined);
        this.define(fn);
      } else {
        let vname = parseVariable(parts[0]);
        let assigOp = parseOperator(parts[0].substr(fname.length).trimStart());
        if (assigOp) parts[0] = parts[0].substr(0, parts[0].length - assigOp.length).trimEnd();

        if (vname === parts[0]) { // VARIABLE DEFINITION
          if (this.func(vname) !== undefined) throw new Error(`Syntax Error: Invalid syntax - symbol '${vname}' is a function but treated as a variable`);
          const ts = new TokenString(this, assigOp === null ? parts[1] : `${vname} ${assigOp} ${parts[1]}`);
          const value = ts.eval(), varObj = this.var(vname, value);
          if (ts.comment.length !== 0) varObj.desc = ts.comment;
          return value;
        } else {
          throw new Error(`Syntax Error: Invalid syntax "${parts[0]}"`);
        }
      }
    }
  }
}

module.exports = Environment;