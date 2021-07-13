const Complex = require("../maths/Complex");
const { RunspaceUserFunction, RunspaceBuiltinFunction } = require("./Function");
const RunspaceVariable = require("./Variable");
const operators = require("../evaluation/operators");
const { TokenString, VariableToken, NumberToken, Token, primitiveToTypeToken } = require("../evaluation/tokens");
const { peek } = require("../utils");
const { parseFunction, parseVariable, parseOperator } = require("../evaluation/parse");

class Runspace {
  constructor(strict = false, storeAns = true, doBidmas = true) {
    this._vars = [{}]; // { variable: EnvVariable }[]
    this._funcs = {}; // { fn_name: EnvFunction }

    this.logical = false; // Changes behaviour of some operators to be logical
    this.strict = !!strict;
    this.bidmas = !!doBidmas;
    this.storeAns(storeAns);
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
      else obj = new RunspaceVariable(name, primitiveToTypeToken(value), desc, constant);

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

  /** Create a new EnvVariable; get object to provide as value of Variable from <obj> */
  _assignVarGetObjValue(tstr, obj) {
    let value;
    if (obj instanceof VariableToken) {
      value = primitiveToTypeToken(obj.eval("any"));
      value.tstr = tstr;
    } else {
      value = obj;
    }
    return value;
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
    if (this._storeAns && ts.setAns) this._vars[0].ans = new RunspaceVariable('ans', this._assignVarGetObjValue(ts, obj), 'value returned by previous statement');
    return obj.eval('string');
  }
}

module.exports = Runspace;