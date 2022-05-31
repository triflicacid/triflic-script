const { errors } = require("../errors");
const { types } = require("../evaluation/types");

class RunspaceFunction {
  /**
   * @param {Runspace} rs 
   * @param {{ [param: string]: string }} args - param:type or param:{ pass: "val"|"ref", type: string, optional: boolean, default: undefined | any }
   * @param {string} desc - optional description of function
   */
  constructor(rs, name, args, desc = undefined, returnType = 'any') {
    this.rs = rs;
    this.rargs = args;
    this.args = new Map(); // { [arg: string]: { pass: "val"|"ref", type: string } }
    this.argCount = 0; // Number of arguments
    this.optional = 0; // Number of OPTIONAL arguments
    this.hasEllipse = false; // Has ellipse argument?
    this.name = name;
    this.desc = desc ?? '[no information]';
    this.constant = false;
    this.returnType = returnType;

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
          data.ellipse = !!args[arg].ellipse;
          this.hasEllipse = data.ellipse;
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
    if (!this.hasEllipse) {
      let req = this.argCount - this.optional;
      let expected = this.optional === 0 ? req : `${req}-${this.argCount}`;
      if (args.length < req || args.length > this.argCount) throw new Error(`[${errors.ARG_COUNT}] Argument Error: function '${this.name}' expects ${expected} argument${expected == 1 ? '' : 's'} {${Array.from(this.args.values()).map(data => data.type).join(', ')}}, got ${args.length} {${args.map(a => `${a.type()} "${a}"`).join(', ')}}`);
    }
  }

  about() {
    return this.desc;
  }

  signature() {
    return `${this.name}(${Array.from(this.args.entries()).map(([name, data]) => `${data.ellipse ? '...' : ''}${name}: ${data.pass ? (data.pass + ' ') : ''}${data.optional ? '?' : ''}${data.type}`).join(', ')})`;
  }
}

/** User defined function using a TokenList */
class RunspaceUserFunction extends RunspaceFunction {
  /**
   * @param {{[arg:string]:string}} args Map argument names to types
   * @param {TokenLine | BracketedTokenLines} body Body of function (basically, anything with eval() method)
   */
  constructor(rs, name, args, body, desc = 'user-defined', returnType = "any") {
    super(rs, name, args, desc, returnType);
    this.tstr = body;
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
    for (let [arg, data] of this.args) {
      if (data.pass === undefined || data.pass === 'val') {
        let casted;
        if (data.ellipse) { // '...' parameter
          let values = [];
          for (; i < args.length; i++) {
            let value = args[i];
            try {
              value = value.castTo(data.type);
            } catch (e) {
              throw new Error(`[${errors.CAST_ERROR}] Type Error: while casting '...' argument ${arg} from type ${value.type()} to ${data.type} (function ${this.name}):\n${e}`);
            }
            try {
              value = value.__copy__();
            } catch (e) {
              throw new Error(`[${errors.CANT_COPY}] Argument Error: Cannot copy value of type '${value.type()}' ('...' argument '${arg}')`);
            }
            values.push(value);
          }
          casted = this.rs.generateArray(values);
        } else {
          let castncopy = true;
          if (data.optional && args[i] === undefined) {
            if (data.default) {
              casted = typeof data.default.eval === 'function' ? await data.default.eval(evalObj) : data.default; // Evaluate default argument value
            } else {
              casted = this.rs.UNDEFINED; // No default provided
              castncopy = false;
            }
          } else {
            casted = args[i];
          }

          // Cast and copy value
          if (castncopy) {
            try {
              casted = casted.castTo(data.type);
            } catch (e) {
              throw new Error(`[${errors.CAST_ERROR}] Type Error: while casting argument ${arg} from type ${args[i].type()} to ${data.type} (function ${this.name}):\n${e}`);
            }
            try {
              casted = casted.__copy__();
            } catch (e) {
              throw new Error(`[${errors.CANT_COPY}] Argument Error: Cannot copy value of type '${casted.type()}' (argument '${arg}')`);
            }
          }
        }
        this.rs.defineVar(arg, casted);
      } else if (data.pass === 'ref') {
        if (typeof args[i].getVar !== 'function') {
          throw new Error(`[${errors.BAD_ARG}] Argument Error: Invalid pass-by-reference: expected variable, got ${args[i]?.type()} ${args[i]}`);
        }
        let vobj = args[i].getVar();
        let varObj = this.rs.defineVar(arg, vobj);
        varObj.refFor = vobj;
      } else {
        throw new Error(`Unknown pass-by value '${data.pass}' for '${args[i]}'`);
      }
      i++;
    }

    let ret = await this.tstr.eval(evalObj);
    ret = ret.castTo(this.returnType);
    this.rs.popScope();
    return ret;
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
  constructor(rs, name, args, fn, desc = '[built-in function]') {
    super(rs, name, args, desc);
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
      if (data.ellipse) {
        o[arg] = this.rs.generateArray(args.slice(i));
        i += o[arg].length;
      } else {
        o[arg] = args[i];
        i++;
      }
    });
    return await this.fn(o, evalObj);
  }
}

module.exports = { RunspaceFunction, RunspaceBuiltinFunction, RunspaceUserFunction };