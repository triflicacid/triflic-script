const Complex = require("../maths/Complex");
const operators = require("../evaluation/operators");
const { peek, str, createTokenStringParseObj, bool } = require("../utils");
const { bracketValues, bracketMap, parseNumber, parseOperator, parseFunction, parseVariable } = require("./parse");
const { isNumericType, isIntType, castingError } = require("./types");
const { RunspaceUserFunction, RunspaceBuiltinFunction } = require("../runspace/Function");

class Token {
  constructor(tstring, v, pos = NaN) {
    this.tstr = tstring;
    this.value = v;
    this.pos = pos; // Definition position
  }
  type() {
    throw new Error(`Overload Required`);
  }
  eval(type) {
    throw new Error(`Overload Required (type provided: ${type})`);
  }
  is(klass, val = undefined) {
    return (this instanceof klass && (val != undefined && this.value === val));
  }
  adjacentMultiply(obj) {
    return false;
  }
  toString() {
    return this.value.toString();
  }
}

/** For numerical values e.g. '3.1519' */
class NumberToken extends Token {
  constructor(tstring, n, pos) {
    super(tstring, Complex.assert(n), pos);
  }
  type() { return this.value.isReal() ? "real" : "complex"; }
  eval(type) {
    if (type === 'any' || type === 'complex') return this.value;
    if (type === 'complex_int') return Complex.floor(this.value);
    if (type === 'real') return this.value.a;
    if (type === 'real_int') return Math.floor(this.value.a);
    if (type === 'string') return this.value.toString();
    if (type === 'bool') {
      if (this.value.b === 0) return !!this.value.a;
      if (this.value.a === 0) return !!this.value.b;
      return true;
    }
    castingError(this, type);
  }
  adjacentMultiply(obj) {
    return obj instanceof FunctionToken || obj instanceof VariableToken || (obj instanceof BracketToken && obj.facing() === 1);
  }
}

class StringToken extends Token {
  constructor(tstring, string, pos) {
    super(tstring, str(string), pos);
  }
  type() { return "string"; }
  len() { return this.value.length; }
  eval(type) {
    if (type === 'any' || type === 'string') return this.value;
    if (type === 'bool') return bool(this.value);
    if (isNumericType(type)) {
      let n = +this.value;
      if (isIntType(type)) n = Math.floor(n);
      return Complex.assert(n);
    }
    castingError(this, type);
  }
}

class BoolToken extends Token {
  constructor(tstring, bool, pos) {
    super(tstring, !!bool, pos);
  }
  type() { return "bool"; }
  eval(type) {
    if (type === "any" || type === "bool") return this.value;
    if (isNumericType(type)) return Complex.assert(+this.value);
    if (type === 'string') return this.value.toString();
    castingError(this, type);
  }
}

class ArrayToken extends Token {
  constructor(tstring, items, pos) {
    super(tstring, items, pos);
  }
  type() { return "array"; }
  len() { return this.value.length; }
  eval(type) {
    if (type === 'any' || type === 'array') return this.value;
    if (type === 'string') return "[" + this.value.map(t => t.eval("string")).join(',') + "]";
    if (isNumericType(type)) return Complex.NaN();
    castingError(this, type);
  }
}

/** For brackets */
class BracketToken extends Token {
  constructor(tstring, x, pos) {
    super(tstring, x, pos);
    if (bracketValues[x] === undefined) throw new Error(`new BracketToken() : '${x}' is not a bracket`);
  }
  type() { return "string"; }
  priority() { return 0; }
  /** 1 : opening, -1 : closing */
  facing() {
    return bracketValues[this.value];
  }
  len() { return this.value.length; }
  eval(type) {
    if (type === 'any' || type === 'string') return this.value;
    if (type === 'bool') return false;
    if (isNumericType(type)) return Complex.NaN();
    castingError(this, type);
  }
  adjacentMultiply(obj) {
    if (this.facing() === -1) {
      if (obj instanceof BracketToken && bracketMap[this.value] === obj.value) return true; // Matching brackets e.g. ')(' or ']['
      return obj instanceof FunctionToken || obj instanceof VariableToken || obj instanceof NumberToken;
    }
    return false;
  }
  static isGrammar(x) {
    const array = ["(", ")", "[", "]", "{", "}"];
    return array.includes(x);
  }
}

/** For operators e.g. '+' */
class OperatorToken extends Token {
  constructor(tstring, op, pos) {
    super(tstring, op, pos);
    if (operators[op] === undefined) throw new Error(`new OperatorToken() : '${op}' is not an operator`);
  }
  type() { return "string"; }
  /** Eval as operators */
  eval(...args) {
    const r = operators[this.value].fn(...args);
    if (r === undefined) throw new Error(`Type Error: Operator ${this.value} does not support arguments { ${args.map(a => a.type()).join(', ')} }`);
    return r;
  }
  priority() {
    return +operators[this.value].precedence;
  }
  info() {
    return operators[this.value];
  }
}

/** For symbols e.g. 'hello' */
class VariableToken extends Token {
  constructor(tstring, vname, pos) {
    super(tstring, vname, pos);
    this.isDeclaration = false; // Is this token on the RHS of assignment?
  }
  type() {
    return str(this.getVar()?.value.type());
  }
  len() {
    return str(this.getVar()?.value.len());
  }
  eval(type) {
    return this.tstr.env.var(this.value)?.eval(type);
  }
  exists() {
    return this.tstr.env.var(this.value) !== undefined;
  }
  getVar() {
    return this.tstr.env.var(this.value);
  }
  adjacentMultiply(obj) {
    return obj instanceof FunctionToken || obj instanceof VariableToken || (obj instanceof BracketToken && obj.facing() === 1);
  }
}

/** For functions e.g. 'f(...)' (non-definitions) */
class FunctionToken extends Token {
  /**
   * @param {string} fname Name of function
   * @param {string} argStr Raw string of function definition
   * @param {TokenString[]} argTokens Array of token strings representing the function parameters 
   */
  constructor(tstring, fname, argStr, argTokens, pos) {
    super(tstring, fname, pos);
    this.raw = argStr;
    this.args = argTokens;
    this.isDeclaration = false; // Is this token on the RHS of assignment?
  }
  type() { return "func"; }
  /** Evaluate as a function (non-casting) */
  eval() {
    const fn = this.tstr.env.func(this.value);
    if (fn === undefined) throw new Error(`Name Error: name '${this.value}' is not a function`);
    // Check arg count
    fn.checkArgCount(this.args);
    // Args are given as TokenString[], so reduce to Token[]
    let args = this.args.map(a => a == undefined ? undefined : a.eval());
    // Reduce from Token[] to object[]?
    if (fn.processArgs) args = fn.extractArgs(args);
    const ret = fn.eval(args);
    return ret;
  }
  exists() {
    return this.tstr.env.func(this.value) === undefined;
  }
  adjacentMultiply(obj) {
    return obj instanceof FunctionToken || obj instanceof VariableToken || (obj instanceof BracketToken && obj.facing() === 1);
  }
  toString() {
    return `${this.value}(${this.raw})`;
  }
}

/** Reference to function without calling */
class FunctionRefToken extends Token {
  constructor(tstring, fname, pos) {
    super(tstring, fname, pos);
  }
  type() { return "func"; }
  exists() {
    return this.tstr.env.func(this.value) !== undefined;
  }
  getFn() {
    return this.tstr.env.func(this.value);
  }
  eval(type) {
    if (type === 'any' || type === 'string') return this.toString();
    if (type === 'func') return this.value;
    if (isNumericType(type)) return Complex.NaN();
    castingError(this, type);
  }

  toString() {
    return `<function ${this.value}>`;
  }
}

/** Convert primitive value to type token */
function primitiveToTypeToken(primitive) {
  if (typeof primitive === 'boolean') return new BoolToken(undefined, primitive);
  const c = Complex.is(primitive);
  if (c !== false) return new NumberToken(undefined, c);
  if (Array.isArray(primitive)) return new ArrayToken(undefined, primitive.map(x => primitiveToTypeToken(x)));
  return new StringToken(undefined, primitive);
}


/** Take input as a string. Use TokenString#parse() to transform into array of tokens */
class TokenString {
  constructor(env, string) {
    this.env = env;
    this.string = string;
    this.tokens = []; // Array of token objects
    this.comment = '';
    this.setAns = true; // Used by Runspace; use value produced as 'ans' variable?
    if (string) this.parse();
  }

  parse() {
    const obj = createTokenStringParseObj(this.string, 0, 0);
    this._parse(obj);
    this.tokens = obj.tokens;
    this.comment = obj.comment;
  }

  /** Parse a raw input string. Populate tokens array. */
  _parse(obj) {
    let string = obj.string, inString = false, strPos, str = '', isDeclaration = 0; // isDeclaration: are we declaring a function? (alters behaviour of lexer - 0:no, 1:yes, 2:yes,constant)
    const brackets = [];

    for (let i = 0; i < string.length;) {
      // Start/End string?
      if (string[i] === '"') {
        if (inString) {
          const t = new StringToken(this, str, obj.pos);
          obj.tokens.push(t);
          str = '';
        } else {
          strPos = obj.pos;
        }
        inString = !inString;
        i++;
        obj.pos++;
        continue;
      }

      // Add to string?
      if (inString) {
        str += string[i];
        i++;
        obj.pos++;
        continue;
      }

      if (string[i] === ' ') {
        i++;
        obj.pos++;
        continue; // WHITESPACE - IGNORE
      }

      // Comment? (only recognise in depth=0)
      if (obj.depth === 0 && string[i] === '#') {
        obj.comment = string.substr(i + 2).trim();
        break;
      }

      // Comma? (only in depth>0)
      if (string[i] === ',' && obj.depth > 0) {
        break;
      }

      // Bracket Group?
      if (string[i] === '(' || string[i] === ')') {
        const t = new BracketToken(this, string[i], obj.pos);

        if (string[i] === '(') {
          brackets.push(t);
        } else if (string[i] === ')') {
          const lastOpened = peek(brackets);
          if (lastOpened === undefined) {
            if (string[i] === obj.terminateClosing) {
              obj.terminateClosing = true; // Signify that it was met
              break;
            }
            throw new Error(`Syntax Error: unexpected token '${string[i]}' (position ${obj.pos}); no matching '${bracketMap[string[i]]}' found.`);
          } else {
            if (bracketMap[lastOpened.value] === string[i]) {
              brackets.pop(); // Matches, so remove
            } else {
              throw new Error(`Syntax Error: unexpected token '${string[i]}'. Expected '${bracketMap[lastOpened.value]}' following '${lastOpened.value}' at position ${lastOpened.pos}.`);
            }
          }
        }

        obj.tokens.push(t);
        i++;
        obj.pos++;
        continue;
      }

      // Operator?
      let op = parseOperator(string.substr(i));
      if (op !== null) {
        let top = peek(obj.tokens);
        if ((op === '-' || op === '+') && (obj.tokens.length === 0 || top instanceof OperatorToken || top instanceof BracketToken)) {
          // Negative sign for a number, then
        } else {
          const t = new OperatorToken(this, op, obj.pos);
          obj.tokens.push(t);
          i += op.length;
          obj.pos += op.length;
          continue;
        }
      }

      // Number?
      let o = parseNumber(string.substr(i));
      if (o.nStr.length !== 0) {
        const t = new NumberToken(this, o.n, obj.pos);
        obj.tokens.push(t);
        i += o.pos;
        obj.pos += o.pos;
        continue;
      }

      // Function?
      let fname = parseFunction(string.substr(i));
      functionParseBlock: if (fname !== null && (isDeclaration || this.env.func(fname) !== undefined)) {
        const declPos = obj.pos; // Position where function name was enountered
        i += fname.length;
        obj.pos += fname.length;
        while (string[i] === ' ') { i++; obj.pos++; } // Remove whitespace
        let t;
        if (string[i] === '(') {
          const openingBracket = new BracketToken(this, string[i], obj.pos);
          i++;
          obj.pos++;

          let argStrStart = i, done = false, argTokens = []; // Array of array of tokens for function args
          while (!done && i < string.length) { // Keep parsing args until ending ")" is found
            const pobj = createTokenStringParseObj(string.substr(i), obj.pos, obj.depth + 1, bracketMap[openingBracket.value]);
            try {
              this._parse(pobj); // Parse
              if (pobj.tokens.length !== 0) { // Not Empty
                const ts = new TokenString(this.env, string.substr(i, pobj.pos - obj.pos));
                ts.tokens = pobj.tokens;
                argTokens.push(ts);
              }

              // Increment position
              i += (pobj.pos - obj.pos) + 1;
              obj.pos = pobj.pos + 1;

              // Was terminating bracket met?
              if (pobj.terminateClosing === true) {
                done = true;
              }
            } catch (e) {
              throw new Error(`${string}:\n${e}`);
            }
          }
          if (!done) throw new Error(`Syntax Error: expected '${bracketMap[openingBracket.value]}' after <function ${fname}> invocation following '${openingBracket.value}' (position ${openingBracket.pos})`);
          const argStr = string.substr(argStrStart, i - 1);

          t = new FunctionToken(this, fname, argStr, argTokens, declPos);
          t.isDeclaration = isDeclaration;
          if (isDeclaration) isDeclaration = 0; // End of declaration
        } else {
          if (isDeclaration) { // Now a variable declaration; go back to before fname
            i -= obj.pos - declPos;
            obj.pos = declPos;
            break functionParseBlock;
          }
          t = new FunctionRefToken(this, fname, obj.pos);
        }
        obj.tokens.push(t);
        continue;
      }

      // Variable?
      let vname = parseVariable(string.substr(i));
      if (vname !== null) {
        if ((vname === 'let' || vname === 'const') && !isDeclaration && obj.depth === 0 && obj.tokens.length === 0) {
          isDeclaration = vname === 'const' ? 2 : 1;
        } else {
          let t = new VariableToken(this, vname, obj.pos);
          t.isDeclaration = isDeclaration;
          if (isDeclaration) isDeclaration = 0; // End of declaration
          obj.tokens.push(t);
        }
        i += vname.length;
        obj.pos += vname.length;
        continue;
      }

      throw new Error(`Syntax Error: unexpected token '${string[i]}' at ${obj.pos}`);
    }
    if (inString) throw new Error(`Syntax Error: unterminated string literal at position ${strPos}`);
    if (brackets.length !== 0) {
      const bracket = peek(brackets);
      throw new Error(`Syntax Error: unterminated bracketed group at position ${bracket.pos}; expected ${bracketMap[bracket.value]}`);
    }

    // Special actions:
    // - If a variable is followed by a '=', set .isDeclaration=1
    // - Multiply adjacent variables
    const newTokens = [];
    for (let i = 0; i < obj.tokens.length; i++) {
      newTokens.push(obj.tokens[i]);
      if (obj.tokens[i + 1]?.is(OperatorToken, '=') && !obj.tokens[i].isDeclaration) {
        obj.tokens[i].isDeclaration = 1;
      } else if (obj.tokens[i + 1] instanceof Token && obj.tokens[i].adjacentMultiply(obj.tokens[i + 1])) {
        newTokens.push(new OperatorToken(this, '!*', obj.tokens[i].pos)); // High-precedence multiplication
      }
    }

    obj.tokens.length = 0;
    newTokens.forEach(i => obj.tokens.push(i));
    return;
  }

  eval() {
    try {
      return this._eval();
    } catch (e) {
      throw new Error(`${this.string}:\n${e}`);
    }
  }

  _eval() {
    // SORT OUT DECLARATIONS
    if (this.tokens[0]?.isDeclaration) {
      // Next char must be OperatorToken "="
      if (this.tokens[1]?.is(OperatorToken, "=")) {
        let defTokens = this.tokens.slice(2);
        if (defTokens.length === 0) throw new Error(`Syntax Error: unexpected end of input after assignement at position ${this.tokens[1].pos}`);

        if (this.tokens[0] instanceof VariableToken) {
          let name = this.tokens[0].value;
          if (this.env.func(name)) throw new Error(`Syntax Error: Invalid syntax - symbol '${name}' is a function but treated as a variable at position ${this.tokens[0].pos}`);
          if (this.env.var(name)?.constant) throw new Error(`Syntax Error: Assignment to constant variable ${name} (position ${this.tokens[1].pos})`);
          // Setup TokenString
          let ts = new TokenString(this.env, '');
          ts.tokens = defTokens;
          // Evaluate
          const obj = ts.eval(); // Intermediate
          const varObj = this.env.var(name, this.env._assignVarGetObjValue(ts, obj));
          if (this.tokens[0].isDeclaration === 2) varObj.constant = true;
          if (this.comment) varObj.desc = this.comment;
          return obj;
        } else if (this.tokens[0] instanceof FunctionToken) {
          let name = this.tokens[0].value;
          if (this.env.var(name)) throw new Error(`Syntax Error: Invalid syntax - symbol '${name}' is a variable but treated as a function at position ${this.tokens[0].pos}`);
          if (this.env.strict && this.env.func(name) instanceof RunspaceBuiltinFunction) throw new Error(`Strict Mode: cannot redefine built-in function ${name}`);
          if (this.env.func(name)?.constant) throw new Error(`Syntax Error: Assignment to constant function ${name} (position ${this.tokens[1].pos})`);
          // Extract function arguments - each TokenString in FunctionToken#args should contain ONE symbol
          let fargs = [], a = 0;
          for (let argts of this.tokens[0].args) {
            if (argts.tokens.length !== 1) throw new Error(`Syntax Error: Invalid function declaration: function ${name} paramater ${a} (positions ${argts.tokens[0].pos} - ${peek(argts.tokens).pos})`);
            if (!(argts.tokens[0] instanceof VariableToken)) throw new Error(`Syntax Error: Invalid function declaration: function ${name} paramater ${a} (positions ${argts.tokens[0].pos} - ${peek(argts.tokens).pos}): invalid parameter ${argts.tokens[0]}`);
            fargs[a] = argts.tokens[0].value;
            a++;
          }
          // Setup TokenString
          let ts = new TokenString(this.env, '');
          ts.tokens = defTokens;
          // Define function
          const fn = new RunspaceUserFunction(this.env, name, fargs, ts, this.comment || undefined);
          if (this.tokens[0].isDeclaration === 2) fn.constant = true;
          this.env.define(fn);
          return new FunctionRefToken(this, name, this.tokens[0].pos);
        } else {
          throw new Error(`Syntax Error: invalid assignment at position ${this.tokens[0].pos}: cannot assign to ${typeof this.tokens[0]} ${this.tokens[0]}`);
        }
      } else {
        throw new Error(`Syntax Error: expected assignment operator following declaration at position ${this.tokens[0].pos}`);
      }
    }

    const T = this._toRPN(this.tokens, this.env.bidmas), stack = []; // STACK SHOULD ONLY CONTAIN COMPLEX()
    for (let i = 0; i < T.length; i++) {
      if (T[i] instanceof NumberToken || T[i] instanceof StringToken || T[i] instanceof BoolToken || T[i] instanceof ArrayToken) {
        stack.push(T[i]);
      } else if (T[i] instanceof FunctionToken) {
        const val = T[i].eval('any');
        const t = primitiveToTypeToken(val);
        stack.push(t);
      } else if (T[i] instanceof VariableToken) {
        if (!T[i].exists()) throw new Error(`Name Error: name '${T[i]}' does not exist (position ${T[i].pos})`);
        stack.push(T[i]);
      } else if (T[i] instanceof FunctionRefToken) {
        if (!T[i].exists()) throw new Error(`Reference Error: null reference ${T[i]} (position ${T[i].pos})`);
        stack.push(T[i]);
      } else if (T[i] instanceof OperatorToken) {
        const info = T[i].info();
        if (stack.length < info.args) throw new Error(`Syntax Error: unexpected operator '${T[i]}' at position ${T[i].pos} (SIG_STACK_UNDERFLOW while evaluating)`);
        let args = [];
        for (let i = 0; i < info.args; i++) args.unshift(stack.pop()); // if stack is [a, b] pass in fn(a, b)
        const val = T[i].eval(...args);
        const t = primitiveToTypeToken(val);
        stack.push(t);
      } else {
        throw new Error(`Syntax Error: invalid syntax at position ${T[i].pos}: ${T[i]}`);
      }
    }
    if (stack.length === 0) return new NumberToken(this, 0);
    if (stack.length !== 1) throw new Error(`Syntax Error: Invalid syntax (evaluation failed to reduce expression to single number)`);
    return stack[0];
  }

  toString() {
    return this.tokens.map(t => t.toString()).join(' ');
  }

  /** Token array from infix to postfix */
  _toRPN(tokens, bidmas = true) {
    const stack = [], output = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] instanceof NumberToken || tokens[i] instanceof VariableToken || tokens[i] instanceof FunctionToken || tokens[i] instanceof FunctionRefToken || tokens[i] instanceof StringToken || tokens[i] instanceof BoolToken || tokens[i] instanceof ArrayToken) {
        output.push(tokens[i]);
      } else if (tokens[i].is(BracketToken, '(')) {
        stack.push(tokens[i]);
      } else if (tokens[i].is(BracketToken, ')')) {
        while (peek(stack) instanceof Token && !peek(stack).is(BracketToken, '(')) {
          output.push(stack.pop());
        }
        stack.pop(); // Remove ) from stack
      } else if (tokens[i] instanceof OperatorToken) {
        if (bidmas) {
          while (stack.length !== 0 && tokens[i].priority() < peek(stack).priority()) output.push(stack.pop());
        } else {
          while (stack.length !== 0) output.push(stack.pop());
        }
        stack.push(tokens[i]);
      } else {
        throw new Error(`Unknown token: ${typeof tokens[i]} ${tokens[i].constructor.name}`);
      }
    }
    while (stack.length !== 0) output.push(stack.pop()); // Dump the stack
    return output;
  }
}

module.exports = {
  Token, NumberToken, StringToken, BoolToken, ArrayToken, BracketToken, VariableToken, OperatorToken, FunctionToken, FunctionRefToken,
  primitiveToTypeToken,
  TokenString,
};