const { EnvUserFunction } = require("./function");
const { TokenString } = require("./token");
const { peek, parseSymbol, getMatchingBracket, operators } = require("../utils");
const Complex = require("../Complex");

class Environment {
  constructor() {
    this._vars = [{}]; // { variable: value }[]
    this._funcs = {}; // { fn_name: EnvFunction }
  }

  var(name, value = undefined) {
    if (value !== undefined) {
      peek(this._vars)[name] = Complex.assert(value); // Insert into top-level scope
    }
    for (let i = this._vars.length - 1; i >= 0; i--) {
      if (this._vars[i].hasOwnProperty(name)) return this._vars[i][name];
    }
    return undefined;
  }

  /** Push new variable scope */
  pushScope() {
    this._vars.push({});
  }

  /** Pop variable scope */
  popScope() {
    if (this._vars.length > 1) this._vars.pop();
  }

  /** Get/Set a function */
  func(name, body = undefined) {
    if (body !== undefined) {
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
    string = string.replace(/\s+/g, '');
    if (string.startsWith('help(') && string[string.length - 1] === ')') {
      let query = string.substring('help('.length, string.length - 1);
      if (query == undefined) {
        return `help(?s) \t Get help on a specific symbol\nvars() \t List all variables\nfuncs() \t List all functions\nexit() \t Terminate the program`;
      } else if (query === 'help') {
        return `Type: function\nDesc: Returns general help, or help on a provided symbol\nSyntax: help(?s)`;
      } else {
        if (operators.hasOwnProperty(query)) {
          let info = operators[query];
          return `Type: operator\nDesc: ${info.desc}\nSyntax: ${info.syntax}`;
        } else if (this.func(query) !== undefined) {
          let fn = this.func(query);
          return `Type: function\nDesc: ${fn.about()}\nSyntax: ${fn.defString()}`;
        } else if (this.var(query) !== undefined) {
          let v = this.var(query);
          return `Type: variable\nDesc: ${query} is a variable with value ${v}\nSyntax: ${query}`;
        } else {
          throw new Error(`Argument Error: Cannot retrieve help on given argument`);
        }
      }
    }

    let parts = string.split(/\=(.+)/);
    if (parts[parts.length - 1] === '') parts.pop(); // Remove empty string '' from end
    if (parts.length === 0) return;

    if (parts.length === 1) {
      const ts = new TokenString(this, parts[0]);
      return ts.eval();
    } else {
      let symbol = parseSymbol(parts[0]);
      if (symbol == null) throw new Error(`Syntax Error: Invalid syntax`);
      if (parts[0][symbol.length] === '(') {
        let fargStr = parts[0].substring(symbol.length + 1, parts[0].length - 1);
        let fargsRaw = fargStr.split(','), fargs = [];
        for (let arg of fargsRaw) {
          let symbol = parseSymbol(arg);
          if (symbol !== arg) throw new Error(`Syntax Error: Invalid syntax ('${symbol}' arg '${arg}')`);
          fargs.push(symbol);
        }
        const ts = new TokenString(this, parts[1]);
        const fn = new EnvUserFunction(this, symbol, fargs, ts);
        this.func(symbol, fn);
      } else {
        const ts = new TokenString(this, parts[1]);
        let value = ts.eval();
        this.var(symbol, value);
      }
    }
  }
}

module.exports = Environment;