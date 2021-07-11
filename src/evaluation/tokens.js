const Complex = require("../maths/Complex");
const operators = require("../evaluation/operators");
const { peek, prefixLines, str, createTokenStringParseObj } = require("../utils");
const { bracketValues, bracketMap, parseNumber, parseOperator, getMatchingBracket, parseFunction, parseVariable } = require("./parse");
const { isNumericType, isIntType, castingError } = require("./types");
const { RunspaceUserFunction } = require("../runspace/Function");

class Token {
  constructor(tstring, v, pos = NaN) {
    this.tstr = tstring;
    this.value = v;
    this.pos = pos; // Definition position
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
  eval(type) {
    if (type === 'any' || type === 'complex') return this.value;
    if (type === 'complex_int') return Complex.floor(this.value);
    if (type === 'real') return this.value.a;
    if (type === 'real_int') return Math.floor(this.value.a);
    if (type === 'string') return this.value.toString();
    if (type === 'list') return [this.value];
    castingError(this, type);
  }
  adjacentMultiply(obj) {
    return obj instanceof FunctionToken || obj instanceof VariableToken || (obj instanceof BracketToken && obj.facing() === 1);
  }
}

/** For non-numerical values */
class NonNumericalToken extends Token {
  constructor(tstring, v, pos) {
    super(tstring, v, pos);
  }
  eval(type) {
    if (type === 'any' || type === 'string') return this.toString();
    if (type === 'list') return [this.value];
    if (isNumericType(type)) {
      let n = +this.value;
      if (isIntType(type)) n = Math.floor(n);
      return Complex.assert(n);
    }
    castingError(this, type);
  }

  toString() {
    if (Array.isArray(this.value)) return '[' + this.value.join(',') + ']';
    return str(this.value);
  }
}

/** For brackets */
class BracketToken extends Token {
  constructor(tstring, x, pos) {
    super(tstring, x, pos);
    if (bracketValues[x] === undefined) throw new Error(`new BracketToken() : '${x}' is not a bracket`);
  }
  priority() { return 0; }
  /** 1 : opening, -1 : closing */
  facing() {
    return bracketValues[this.value];
  }
  eval(type) {
    if (type === 'any') return this.value;
    if (type === 'string') return str(this.value);
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
  /** Either 1) cast to type (1 arg) or 2) evaluate as operators (2 args) */
  eval(a, b) {
    if (arguments.length === 1) { // Cast
      if (a === 'any' || a === 'string') return this.value;
      if (isNumericType(a)) return Complex.NaN();
      castingError(this, a);
    }
    return operators[this.value].fn(a, b); // Evaluate as 
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
  }
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
  exists() {
    return this.tstr.env.func(this.value) !== undefined;
  }
  getFn() {
    return this.tstr.env.func(this.value);
  }
  eval(type) {
    if (type === 'any' || type === 'string') return this.toString();
    if (isNumericType(type)) return Complex.NaN();
    castingError(this, type);
  }

  toString() {
    return `<function ${this.value}>`;
  }
}


/** Take input as a string. Use TokenString#parse() to transform into array of tokens */
class TokenString {
  constructor(env, string) {
    this.env = env;
    this.string = string;
    this.tokens = []; // Array of token objects
    this.comment = '';
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
    let string = obj.string, inString = false, strPos, str = '';
    const brackets = [];

    for (let i = 0; i < string.length;) {
      // Start/End string?
      if (string[i] === '"') {
        if (inString) {
          const t = new NonNumericalToken(this, str, obj.pos);
          obj.tokens.push(t);
          str = '';
          strPos = undefined;
        } else {
          strPos = i;
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
      if (obj.depth === 0 && string[i] === '/' && string[i + 1] === '/') {
        obj.comment = string.substr(i + 2).trim();
        break;
      }

      // Comma? (only in depth>0)
      if (string[i] === ',' && obj.depth > 0) {
        break;
      }

      // Grammar?
      if (BracketToken.isGrammar(string[i])) {
        const t = new BracketToken(this, string[i], obj.pos);

        if (bracketValues[string[i]] === 1) { // Opening bracket
          brackets.push(t);
        } else if (bracketValues[string[i]] === -1) { // Closing bracket
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
      if (fname !== null && this.env.func(fname) !== undefined) {
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
              const ts = new TokenString(this.env, string.substr(i, pobj.pos - obj.pos));
              ts.tokens = pobj.tokens;
              argTokens.push(ts);

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
        } else {
          // throw new Error(`Syntax Error: expected '(' after function reference`);
          t = new FunctionRefToken(this, fname, obj.pos);
        }
        obj.tokens.push(t);
        continue;
      }

      // Variable?
      let vname = parseVariable(string.substr(i));
      if (vname !== null) {
        let t = new VariableToken(this, vname, obj.pos);
        obj.tokens.push(t);
        i += vname.length;
        obj.pos += vname.length;
        continue;
      }

      throw new Error(`Syntax Error: unexpected token '${string[i]}' at ${i}`);
    }
    if (inString) throw new Error(`Syntax Error: unterminated string literal at position ${strPos}`);
    if (brackets.length !== 0) {
      const bracket = peek(brackets);
      throw new Error(`Syntax Error: unterminated bracketed group at position ${bracket.pos}; expected ${bracketMap[bracket.value]}`);
    }

    // Special actions e.g. multiply adjacent variables
    const newTokens = [];
    for (let i = 0; i < obj.tokens.length; i++) {
      newTokens.push(obj.tokens[i]);
      if (obj.tokens[i + 1] instanceof Token && obj.tokens[i].adjacentMultiply(obj.tokens[i + 1])) {
        newTokens.push(new OperatorToken(this, '!*', obj.tokens[i].pos)); // High-precedence multiplication
      }
    }
    // console.log(this.string, newTokens.map(t => t.toString()));

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
    const T = this._toRPN(this.tokens), stack = []; // STACK SHOULD ONLY CONTAIN COMPLEX()
    for (let i = 0; i < T.length; i++) {
      if (T[i] instanceof NumberToken || T[i] instanceof NonNumericalToken) {
        stack.push(T[i]);
      } else if (T[i] instanceof FunctionToken) {
        const val = T[i].eval('any');
        const t = Complex.is(val) === false ? new NonNumericalToken(this, val) : new NumberToken(this, val);
        stack.push(t);
      } else if (T[i] instanceof VariableToken) {
        if (!T[i].exists()) throw new Error(`Name Error: name '${T[i]}' does not exist`);
        stack.push(T[i]);
      } else if (T[i] instanceof FunctionRefToken) {
        if (!T[i].exists()) throw new Error(`Reference Error: null reference ${T[i]}`);
        stack.push(T[i]);
      } else if (T[i] instanceof OperatorToken) {
        const info = T[i].info();
        if (stack.length < info.args) throw new Error(`Syntax Error: unexpected operator '${T[i]}' (SIG_STACK_UNDERFLOW while evaluating)`);
        let args = [];
        for (let i = 0; i < info.args; i++) args.unshift(stack.pop().eval('complex')); // if stack is [a, b] pass in fn(a, b)
        try {
          const val = T[i].eval(...args);
          const t = Complex.is(val) === false ? new NonNumericalToken(this, val) : new NumberToken(this, val);
          stack.push(t);
        } catch (e) {
          throw new Error(`Applying [ ${T[i]} ] to { ${args.join(', ')} }:\n${e}`);
        }
      } else {
        throw new Error(`Syntax Error: invalid syntax: ${T[i]}`);
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
  _toRPN(tokens) {
    const stack = [], output = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] instanceof NumberToken || tokens[i] instanceof VariableToken || tokens[i] instanceof FunctionToken || tokens[i] instanceof FunctionRefToken || tokens[i] instanceof NonNumericalToken) {
        output.push(tokens[i]);
      } else if (tokens[i].is(BracketToken, '(')) {
        stack.push(tokens[i]);
      } else if (tokens[i].is(BracketToken, ')')) {
        while (peek(stack) instanceof Token && !peek(stack).is(BracketToken, '(')) {
          output.push(stack.pop());
        }
        stack.pop(); // Remove ) from stack
      } else if (tokens[i] instanceof OperatorToken) {
        if (tokens[i].value === '^') {
          while (stack.length !== 0 && tokens[i].priority() <= peek(stack).priority()) {
            output.push(stack.pop());
          }
        } else {
          while (stack.length !== 0 && tokens[i].priority() < peek(stack).priority()) {
            output.push(stack.pop());
          }
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
  Token, NumberToken, NonNumericalToken, BracketToken, VariableToken, OperatorToken, FunctionToken, FunctionRefToken,
  TokenString,
};