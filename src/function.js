const Complex = require("./Complex");
const { TokenString } = require("./token");

class EnvFunction {
  /**
   * @param {Environment} env 
   * @param {string[]} args - array of arg variables e.g. ["x", "y", "z"] for f(x, y, z). Prefix with '?' if optional
   * @param {string} desc - optional description of function
   * @param {number} evalStage - how much to evaluate args (how many times to call .eval())
   */
  constructor(env, name, args, desc = undefined, evalState = 2) {
    this.env = env;
    this.rargs = args;
    this.optional = 0;
    this.args = [];
    this.name = name;
    this.desc = desc === undefined ? '[no information]' : desc;
    this.evalState = evalState;

    let metOptn = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i][0] === '?') {
        metOptn = true;
        this.optional++;
        this.args.push(args[i].substr(1));
      } else {
        if (metOptn) throw new Error(`new EnvFunction(): argument cannot follow optional argument : '${args[i]}'`);
        this.args.push(args[i]);
      }
    }
  }

  eval(args) {
    let req = this.args.length - this.optional;
    let expected = this.optional === 0 ? req : `${req}-${this.args.length}`;
    if (args.length < req || args.length > this.args.length) throw new Error(`Argument Error: function '${this.name}' expects ${expected} argument${req == 1 ? '' : 's'}, got ${args.length}`);
  }

  defString() {
    return `${this.name}(${this.rargs.join(', ')})`;
  }

  about() {
    return this.desc;
  }

  raw() {
    return '[internal]';
  }
}

/** User defined function using a TokenList */
class EnvUserFunction extends EnvFunction {
  /**
   * @param {TokenString} body 
   */
  constructor(env, name, args, body, desc = 'user-defined') {
    super(env, name, args, desc);
    this.tstr = body;
  }

  clone() {
    return new EnvUserFunction(this.env, this.name, this.rargs, this.tstr);
  }

  eval(args) {
    super.eval(args);
    this.env.pushScope();
    for (let i = 0; i < args.length; i++) {
      this.env.var(this.args[i], args[i]);
    }
    const t = this.tstr.eval(); // Return token
    let x = t.eval(); // Reduce Token to raw value
    this.env.popScope();
    return x;
  }

  raw() {
    return this.tstr.string;
  }
}

/** Built-in function using JS code */
class EnvBuiltinFunction extends EnvFunction {
  constructor(env, name, args, fn, desc = '[built-in function]', evalState = undefined) {
    super(env, name, args, desc, evalState, evalState);
    this.fn = fn;
  }

  clone() {
    return new EnvBuiltinFunction(this.env, this.name, this.rargs, this.fn, this.desc);
  }

  eval(args) {
    super.eval(args);
    let o = {};
    for (let i = 0; i < args.length; i++) {
      o[this.args[i]] = args[i];
    }
    let x = this.fn(o); // Returns primitive value
    return x;
  }

  raw() {
    return this.fn;
  }
}

class EnvVariable {
  constructor(name, value, desc = undefined) {
    this.name = name;
    this.value = Complex.assert(value);
    this.desc = desc ?? '[no information]';
  }

  eval() { return this.value; }
  copy() { return new EnvVariable(this.name, this.value, this.desc); }
}

module.exports = { EnvUserFunction, EnvBuiltinFunction, EnvVariable };