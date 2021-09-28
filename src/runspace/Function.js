const { errors } = require("../errors");
const { types } = require("../evaluation/types");

class RunspaceFunction {
  /**
   * @param {Runspace} rs 
   * @param {{ [param: string]: string }} args - param:type or param:{ pass: "val"|"ref", type: string, optional: boolean, default: undefined | any }
   * @param {string} desc - optional description of function
   * @param {boolean} processArgs - process arguments in accordance to provided types, or leave as Token object?
   */
  constructor(rs, name, args, desc = undefined, processArgs = true) {
    if (typeof processArgs !== 'boolean') throw new Error(`Function ${name} - invalid <processArgs>: ${processArgs}`);

    this.rs = rs;
    this.rargs = args;
    this.args = new Map(); // { [arg: string]: { pass: "val"|"ref", type: string } }
    this.argCount = 0; // Number of arguments
    this.optional = 0; // Number of OPTIONAL arguments
    this.name = name;
    this.desc = desc ?? '[no information]';
    this.processArgs = processArgs;
    this.constant = false;

    let metOptn = false;
    for (let arg in args) {
      if (args.hasOwnProperty(arg)) {
        let data = {};
        if (typeof args[arg] === 'string') {
          let string = args[arg];
          // Is optional?
          let isOptional = string[0] === '?';
          if (isOptional) {
            string = string.substr(1);
            data.optional = true;
          }
          data.pass = 'val';
          data.type = string;
        } else {
          data.pass = args[arg].pass;
          data.type = args[arg].type ?? 'any';
          data.optional = !!args[arg].optional;
          data.default = args[arg].default;
          if (data.type[0] === '?') {
            data.optional = true;
            data.type = data.type.substr(1);
          }
        }

        if (!(data.type in types)) throw new Error(`[${errors.TYPE_ERROR}] Type Error: argument '${arg}: ${data.type}': invalid type '${data.type}' (function: ${name})`);
        if (data.optional) {
          metOptn = true;
          this.optional++;
        } else {
          if (metOptn) throw new Error(`[${errors.SYNTAX}] Syntax Error: required argument cannot follow optional argument : '${arg}' (function: ${name})`);
        }

        this.args.set(arg, data);
        this.argCount++;
      }
    }
  }

  /** Check arg count */
  checkArgCount(args) {
    let req = this.argCount - this.optional;
    let expected = this.optional === 0 ? req : `${req}-${this.argCount}`;
    if (args.length < req || args.length > this.argCount) throw new Error(`[${errors.ARG_COUNT}] Argument Error: function '${this.name}' expects ${expected} argument${expected == 1 ? '' : 's'} {${Array.from(this.args.values()).map(data => data.type).join(', ')}}, got ${args.length} {${args.map(a => `${a.type()} "${a}"`).join(', ')}}`);
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

  signature() {
    return `${this.name}(${Array.from(this.args.values()).map(data => `${data.type}`).join(', ')})`;
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
    this.args.forEach((data, arg) => {
      if (data.pass === undefined || data.pass === 'val') {
        let casted;
        if (data.optional && args[i] === undefined) {
          casted = data.default ?? this.rs.UNDEFINED;
        } else {
          try {
            casted = args[i].castTo(data.type);
          } catch (e) {
            throw new Error(`[${errors.CAST_ERROR}] Type Error: while casting argument ${arg} from type ${args[i].type()} to ${this.args[arg]} (function ${this.name}):\n ${e}`);
          }
        }
        this.rs.defineVar(arg, casted);
      } else if (data.pass === 'ref') {
        if (args[i].constructor.name !== 'VariableToken') {
          throw new Error(`[${errors.BAD_ARG}] Argument Error: Invalid pass-by-reference: expected variable, got ${args[i]?.type()} ${args[i]}`);
        }
        if (!args[i].exists()) {
          throw new Error(`[${errors.BAD_ARG}] Argument Error: Invalid pass-by-reference: passed value must be bound`);
        }
        this.rs.defineVar(arg, args[i].getVar());
      } else {
        throw new Error(`Unknown pass-by value '${data.pass}' for '${args[i]}'`);
      }
      i++;
    });

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
    this.args.forEach((data, arg) => {
      o[arg] = args[i];
      i++;
    });
    return await this.fn(o, evalObj);
  }

  raw() {
    return this.fn;
  }
}

module.exports = { RunspaceFunction, RunspaceBuiltinFunction, RunspaceUserFunction };