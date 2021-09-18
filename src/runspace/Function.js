const { errors } = require("../errors");
const { types } = require("../evaluation/types");
const { v4 } = require("uuid");

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
    this.id = v4();
    this.rargs = args;
    this.args = {}; // Object of param:type
    this.argCount = 0; // Number of arguments
    this.optional = 0; // Number of OPTIONAL arguments
    this.name = name;
    this.desc = desc ?? '[no information]';
    this.processArgs = processArgs;
    this.constant = false;

    let metOptn = false;
    for (let arg in args) {
      if (args.hasOwnProperty(arg)) {
        let type = args[arg];

        // Is optional?
        let isOptional = type[0] === '?';
        if (isOptional) type = type.substr(1);

        if (!(type in types)) throw new Error(`[${errors.TYPE_ERROR}] Type Error: argument '${arg}: ${type}': invalid type '${type}' (function: ${name})`);
        if (isOptional) {
          metOptn = true;
          this.optional++;
        } else {
          if (metOptn) throw new Error(`[${errors.SYNTAX}] Syntax Error: required argument cannot follow optional argument : '${arg}' (function: ${name})`);
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
    if (args.length < req || args.length > this.argCount) throw new Error(`[${errors.ARG_COUNT}] Argument Error: function '${this.name}' expects ${expected} argument${expected == 1 ? '' : 's'}, got ${args.length}`);
  }

  /** Given Token[], extract to raw values following types */
  extractArgs(args) {
    let extracted = [], i = 0;
    for (let arg in this.args) {
      extracted.push(args[i] == undefined ? undefined : args[i].castTo(this.args[arg]));
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
   * @param {{[arg:string]:string}} args Map argument names to types
   * @param {TokenLine | BracketedTokenLines} body Body of function (basically, anything with eval() method)
   */
  constructor(rs, name, args, body, desc = 'user-defined', constant = false) {
    super(rs, name, args, desc);
    this.tstr = body;
    this.constant = constant;
  }

  clone() {
    return new RunspaceUserFunction(this.rs, this.name, this.rargs, this.tstr);
  }

  /** Evaluation object & array of Token arguments */
  async call(evalObj, args) {
    this.checkArgCount(args);
    this.rs.pushScope();
    // Set arguments to variables matching definition symbols
    let i = 0;
    for (let arg in this.args) {
      if (this.args.hasOwnProperty(arg)) {
        let casted;
        try {
          casted = args[i].castTo(this.args[arg]);
        } catch (e) {
          throw new Error(`[${errors.CAST_ERROR}] Type Error: while casting argument ${arg} from type ${args[i].type()} to ${this.args[arg]} (function ${this.name}):\n ${e}`);
        }
        this.rs.setVar(arg, casted);
        i++;
      }
    }

    let ret = await this.tstr.eval(evalObj);
    ret = ret.castTo('any'); // Cast to resolve variables
    this.rs.popScope();
    return ret;
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
   * @param {boolean} processArgs true: calls castTo(type) on each argument (eliminates variables) 
   */
  constructor(rs, name, args, fn, desc = '[built-in function]', processArgs = true) {
    super(rs, name, args, desc, processArgs);
    this.fn = fn;
    this.constant = true;
  }

  clone() {
    return new RunspaceBuiltinFunction(this.rs, this.name, this.rargs, this.fn, this.desc);
  }

  async call(evalObj, args) {
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
    return await this.fn(o, evalObj);
  }

  raw() {
    return this.fn;
  }
}

module.exports = { RunspaceFunction, RunspaceBuiltinFunction, RunspaceUserFunction };