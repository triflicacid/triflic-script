const { errors } = require("../errors");
const { types, isTypeOverlap } = require("../evaluation/types");

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
    this.name = name;
    this.desc = desc ?? '[no information]';
    this.returnType = returnType;
    this.argMin = 0;
    this.argMax = 0;

    for (let arg in args) {
      if (args.hasOwnProperty(arg)) {
        let data = {};
        if (typeof args[arg] === 'string') {
          let string = args[arg];
          // Is optional?
          let isOptional = string[0] === '?';
          if (isOptional) {
            string = string.substring(1);
            data.optional = true;
          }
          data.pass = 'val';
          data.type = string;
        } else {
          data.pass = args[arg].pass;
          data.type = args[arg].type;
          data.optional = !!args[arg].optional;
          data.default = args[arg].default;
          if (data.type && data.type[0] === '?') {
            data.optional = true;
            data.type = data.type.substring(1);
          }
          data.ellipse = !!args[arg].ellipse;
        }
        if (data.pass === undefined) data.pass = 'val';
        if (data.type === undefined) data.type = 'any';
        if (data.optional === undefined) data.optional = false;
        if (data.ellipse === undefined) data.ellipse = false;

        if (!types.has(data.type)) throw new Error(`[${errors.TYPE_ERROR}] Type Error: argument '${arg}: ${data.type}': invalid type '${data.type}' (function: ${name})`);

        this.args.set(arg, data);

        if (data.ellipse) this.argMax = Infinity;
        else if (data.optional) this.argMax++;
        else {
          this.argMax++;
          this.argMin++;
        }
      }
    }
  }

  /** Check arg count */
  checkArgCount(args, ignoreCount = 0) {
    let min = this.argMin - ignoreCount, max = this.argMax - ignoreCount;
    if (args.length < min) throw new Error(`[${errors.ARG_COUNT}] Argument Error: function '${this.name}' expects at least ${min} argument${min == 1 ? '' : 's'} {${Array.from(this.args.values()).filter(obj => !(obj.optional || obj.ellipse)).map(data => data.type).join(', ')}}, got ${args.length} {${args.map(a => `${a.type()}`).join(', ')}}`);
    if (args.length > max) throw new Error(`[${errors.ARG_COUNT}] Argument Error: function '${this.name}' expects at most ${max} argument${max == 1 ? '' : 's'} {${Array.from(this.args.values()).map(data => data.type).join(', ')}}, got ${args.length} {${args.map(a => `${a.type()}`).join(', ')}}`);
  }

  about() {
    return this.desc;
  }

  /** Get signature of function */
  signature() {
    return `${this.name}(${Array.from(this.args.keys()).map((name) => this.argumentSignature(name)).join(', ')})`;
  }

  /** Get signature of an argument */
  argumentSignature(arg) {
    let data = this.args.get(arg);
    if (!data) return '';
    return `${data.ellipse ? '...' : ''}${data.optional ? '?' : ''}${arg}: ${data.pass} ${data.type}`;
  }

  /** Return whether the given functions' signature matches this */
  signatureMatch(fn) {
    if (fn.argMax < this.argMin) return false; // Not enough arguments
    let targs = Array.from(this.args), fargs = Array.from(fn.args);
    for (let i = 0; i < targs.length; ++i) {
      if (targs[i][1].pass !== fargs[i][1].pass || !isTypeOverlap(targs[i][1].type, fargs[i][1].type)) return false;
    }
    return true;
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

  /** Evaluation object & array of Token arguments. Accepts Map() of keywords arguments */
  async call(evalObj, args = [], kwargs = undefined) {
    if (kwargs === undefined) kwargs = new Map();
    // console.log(`RUF: CALL ${this.name} IN PID=${evalObj.pid}`);
    const argsPos = Array.from(this.args.keys());
    // Insert kwargs into argument array if necessary
    for (let [k, v] of kwargs) {
      if (argsPos.includes(k)) args[argsPos.indexOf(k)] = v;
    }

    this.checkArgCount(args.filter(x => x));
    this.rs.pushScope(evalObj.pid);
    const vArgs = [], vKwargs = new Map();
    // Set arguments to variables matching definition symbols
    let i = 0;
    for (let [arg, data] of this.args) {
      if (data.pass === undefined || data.pass === 'val') {
        let casted;
        if (data.ellipse) { // '...' parameter
          let values = [], lim = args.length - (this.args.size - i);
          for (; i <= lim; i++) {
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
            vArgs.push(value); // ARGS
          }
          casted = this.rs.generateArray(values);
          --i;
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
          vArgs.push(casted); // ARGS
        }
        this.rs.defineVar(arg, casted, undefined, evalObj.pid);
      } else if (data.pass === 'ref') {
        if (typeof args[i].getVar === 'function') {
          let vobj = args[i].getVar();
          let varObj = this.rs.defineVar(arg, vobj, undefined, evalObj.pid);
          varObj.refFor = vobj;
          vArgs.push(args[i]); // ARGS
        } else if (args[i].value instanceof Map) {
          vArgs.push(args[i].value); // ARGS
          this.rs.defineVar(arg, undefined, undefined, evalObj.pid);
          this.rs.setVarObj(arg, args[i], undefined, evalObj.pid);
        } else {
          throw new Error(`[${errors.BAD_ARG}] Argument Error: Invalid pass-by-reference: type ${args[i]?.type()} ${args[i]}`);
        }
      } else {
        throw new Error(`Unknown pass-by value '${data.pass}' for '${args[i]}'`);
      }
      i++;
    }

    // Copy kwarg values
    for (let [k, v] of kwargs) {
      let copy = typeof v.getVar === "function" ? v : await (await v.castTo("any", evalObj)).__copy__();
      vKwargs.set(k, copy);
    }

    this.rs.defineVar("args", this.rs.generateArray(vArgs), 'Array of values passed to function', evalObj.pid);
    this.rs.defineVar("kwargs", this.rs.generateMap(vKwargs), 'Map of keyword arguments', evalObj.pid);
    let ret = await this.tstr.eval(evalObj);
    ret = ret.castTo(this.returnType);
    this.rs.popScope(evalObj.pid);
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
  }

  clone() {
    return new RunspaceBuiltinFunction(this.rs, this.name, this.rargs, this.fn, this.desc);
  }

  async call(evalObj, args = []) {
    // console.log(`RBF: CALL ${this.name} IN PID=${evalObj.pid}`);
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