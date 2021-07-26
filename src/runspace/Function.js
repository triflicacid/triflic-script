const { types } = require("../evaluation/types");

class RunspaceFunction {
  /**
   * @param {Runspace} rs 
   * @param {{ [param: string]: string }} args - object mapping param name to the expected type. Prefix type with '?' to be marked as optional
   * @param {string} desc - optional description of function
   * @param {boolean} processArgs - process arguments in accordance to provided types, or leave as Token object?
   */
  constructor(rs, name, args, desc = undefined, processArgs = true) {
    if (typeof processArgs !== 'boolean') throw new Error(`Function ${name} - invalid <processArgs>: ${processArgs}`);

    this.rs = rs;
    this.rargs = args;
    this.args = {}; // Object of param:type
    this.argCount = 0; // Number of arguments
    this.optional = 0; // Number of OPTIONAL arguments
    this.name = name;
    this.desc = desc === undefined ? '[no information]' : desc;
    this.processArgs = processArgs;
    this.constant = false;

    let metOptn = false;
    for (let arg in args) {
      if (args.hasOwnProperty(arg)) {
        let type = args[arg];

        // Is optional?
        let isOptional = type[0] === '?';
        if (isOptional) type = type.substr(1);

        if (!(type in types)) throw new Error(`new RunspaceFunction(): argument '${arg}: ${type}': invalid type '${type}' (function: ${name})`);
        if (isOptional) {
          metOptn = true;
          this.optional++;
        } else {
          if (metOptn) throw new Error(`new RunspaceFunction(): argument cannot follow optional argument : '${arg}' (function: ${name})`);
        }
        this.args[arg] = type;
        this.argCount++;
      }
    }
  }

  /** Check arg count */
  checkArgCount(args) {
    let req = this.argCount - this.optional;
    let expected = this.optional === 0 ? req : `${req}-${this.argCount}`;
    if (args.length < req || args.length > this.argCount) throw new Error(`Argument Error: function '${this.name}' expects ${expected} argument${expected == 1 ? '' : 's'}, got ${args.length}`);
  }

  /** Given Token[], extract to raw values following types */
  extractArgs(args) {
    let extracted = [], i = 0;
    for (let arg in this.args) {
      extracted.push(args[i] == undefined ? undefined : args[i].eval(this.args[arg]));
      i++;
    }
    return extracted;
  }

  defString() {
    return `${this.name}(${Object.entries(this.rargs).map(([k, v]) => `${k}: ${v}`).join(', ')})`;
  }

  about() {
    return this.desc;
  }

  raw() {
    return '[internal]';
  }
}

/** User defined function using a TokenList */
class RunspaceUserFunction extends RunspaceFunction {
  /**
   * @param {string[]} args Array of string arguments
   * @param {TokenString} body 
   */
  constructor(rs, name, args, body, desc = 'user-defined', constant = false) {
    const argObj = args.reduce((o, k) => ({ ...o, [k]: 'any' }), {});
    super(rs, name, argObj, desc);
    this.tstr = body;
    this.constant = constant;
  }

  clone() {
    return new RunspaceUserFunction(this.rs, this.name, this.rargs, this.tstr);
  }

  /** Array of Token arguments */
  call(args) {
    this.checkArgCount(args);
    this.rs.pushScope();
    // Set arguments to variables matching definition symbols
    let i = 0;
    for (let arg in this.args) {
      if (this.args.hasOwnProperty(arg)) {
        this.rs.var(arg, args[i]);
        i++;
      }
    }
    const t = this.tstr.eval().eval('any'); // Return token and sort out any variables
    this.rs.popScope();
    return t;
  }

  raw() {
    return this.tstr.string;
  }
}

/** Built-in function using JS code */
class RunspaceBuiltinFunction extends RunspaceFunction {
  /**
   * @param {Runspace} rs Runspace object 
   * @param {string} name Name of the function 
   * @param {{ [param: string]: string }} args Object mapping parameter name to the type expected (param may be prefixes be '?' to show optionality) 
   * @param {Function} fn Anonymous JS function 
   * @param {string} desc Description of function. Used in help() 
   */
  constructor(rs, name, args, fn, desc = '[built-in function]', processArgs = true) {
    super(rs, name, args, desc, processArgs);
    this.fn = fn;
    this.constant = true;
  }

  clone() {
    return new RunspaceBuiltinFunction(this.rs, this.name, this.rargs, this.fn, this.desc);
  }

  call(args) {
    this.checkArgCount(args);
    const o = {};
    // Assign 'param: value' in o
    let i = 0;
    for (let arg in this.args) {
      if (this.args.hasOwnProperty(arg)) {
        o[arg] = args[i];
        i++;
      }
    }
    let ret = this.fn(o);
    return ret;
  }

  raw() {
    return this.fn;
  }
}

module.exports = { RunspaceFunction, RunspaceBuiltinFunction, RunspaceUserFunction };