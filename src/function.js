const { TokenString } = require("./token");

class EnvFunction {
  /**
   * @param {Environment} env 
   * @param {string[]} args - array of arg variables e.g. ["x", "y", "z"] for f(x, y, z). Prefix with '?' if optional
   */
  constructor(env, name, args) {
    this.env = env;
    this.rargs = args;
    this.optional = 0;
    this.args = [];
    this.name = name;

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
    return 'n/a';
  }
}

/** User defined function using a TokenList */
class EnvUserFunction extends EnvFunction {
  /**
   * @param {TokenString} body 
   */
  constructor(env, name, args, body) {
    super(env, name, args);
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
    let x = this.tstr.eval();
    this.env.popScope();
    return x;
  }

  about() {
    return 'user-defined function';
  }
}

/** Built-in function using JS code */
class EnvBuiltinFunction extends EnvFunction {
  constructor(env, name, args, fn, description = 'n/a') {
    super(env, name, args);
    this.fn = fn;
    this.desc = description;
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
    let x = this.fn(o);
    return x;
  }

  about() {
    return this.desc;
  }
}

module.exports = { EnvUserFunction, EnvBuiltinFunction };