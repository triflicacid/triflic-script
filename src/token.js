const Complex = require("./Complex");
const operators = require("./operators");
const { peek, prefixLines } = require("./utils");
const { parseNumber, parseOperator, getMatchingBracket, parseFunction, parseVariable, bracketValues, bracketMap, } = require("./parse");

class Token {
  constructor(tstring, v) {
    this.tstr = tstring;
    this.value = v;
  }
  eval() { return this.value; }
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
  constructor(tstring, n) {
    super(tstring, Complex.assert(n));
  }
  adjacentMultiply(obj) {
    return obj instanceof FunctionToken || obj instanceof VariableToken || (obj instanceof BracketToken && obj.facing() === 1);
  }
}

/** For non-numerical values */
class NonNumericalToken extends Token {
  constructor(tstring, v) {
    super(tstring, v);
  }
  /** isFinal - is this for a final value, or for propagation */
  eval(isFinal = false) {
    if (isFinal) return this.value;
    let comment;
    if (!isNaN(+this.value)) {
      return new Complex(+this.value);
    } else if (typeof this.value === 'string') {
      let ts;
      try {
        ts = new TokenString(this.tstr.env, this.value);
      } catch (e) {
        ts = undefined;
        comment = `Attempted to parse as expression, but failed:\n${prefixLines(e.toString(), '\t')}`;
      }
      if (ts) {
        try {
          let val = ts.eval(); // Reduce to single token
          val = val.eval(); // Reduce to raw value
          return val;
        } catch (e) {
          comment = `Attempted to evaluate as expression, but failed:\n${prefixLines(e.toString(), '\t')}`;
        }
      }
    }
    return new Complex(NaN);
    // throw new Error(`Syntax Error: action attempted to evaluate non-numerical ${typeof this.value} value "${this.toString()}"${comment === undefined ? '' : `\n  Comment:\n${prefixLines(comment, '\t')}`}`);
  }
}

/** For brackets */
class BracketToken extends Token {
  constructor(tstring, x) {
    super(tstring, x);
    if (bracketValues[x] === undefined) throw new Error(`new BracketToken() : '${x}' is not a bracket`);
  }
  priority() { return 0; }
  /** 1 : opening, -1 : closing */
  facing() {
    return bracketValues[this.value];
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
  constructor(tstring, op) {
    super(tstring, op);
    if (operators[op] === undefined) throw new Error(`new OperatorToken() : '${op}' is not an operator`);
  }
  eval(a, b) {
    return operators[this.value].fn(a, b);
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
  constructor(tstring, vname) {
    super(tstring, vname);
  }
  eval(isFinal) {
    return this.tstr.env.var(this.value)?.eval(isFinal);
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
  constructor(tstring, fname, argStr) {
    super(tstring, fname);
    this.raw = argStr;

    let rargs = this.raw.split(',').filter(a => a.length !== 0);
    this.args = rargs.map(a => new TokenString(tstring.env, a));
  }
  eval() {
    let fn = this.tstr.env.func(this.value);
    if (fn === undefined) throw new Error(`Name Error: name '${this.value}' is not a function`);
    let args = this.args;
    for (let i = 0; i < fn.evalState; i++) args = args.map(a => a.eval()); // Evaluate as many times as stated
    return fn.eval(args);
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
  constructor(tstring, fname) {
    super(tstring, fname);
  }
  exists() {
    return this.tstr.env.func(this.value) !== undefined;
  }
  getFn() {
    return this.tstr.env.func(this.value);
  }
  eval(isFinal = false) {
    return isFinal ? this.toString() : NaN;
  }

  toString() {
    return `<function ${this.value}>`;
  }
}

class TokenString {
  constructor(env, string) {
    this.env = env;
    this.string = string;
    this.tokens = []; // Array of token objects
    this.comment = '';
    if (string) this.parse();
  }

  parse() {
    this.comment = this._parse(this.string, this.tokens);
  }

  /** Parse a raw input string. Return token array */
  _parse(string, tokens) {
    tokens.length = 0;
    let nestLevel = 0, inString = false, strPos, str = '', comment = '';

    for (let i = 0; i < string.length;) {
      // Start/End string?
      if (string[i] === '"') {
        if (inString) {
          const t = new NonNumericalToken(this, str);
          tokens.push(t);
          str = '';
          strPos = undefined;
        } else {
          strPos = i;
        }
        inString = !inString;
        i++;
        continue;
      }

      // Add to string?
      if (inString) {
        str += string[i];
        i++;
        continue;
      }

      if (string[i] === ' ') {
        i++;
        continue; // WHITESPACE - IGNORE
      }

      // Comment?
      if (string[i] === '/' && string[i + 1] === '/') {
        comment = string.substr(i + 2).trim();
        break;
      }

      // Grammar?
      if (BracketToken.isGrammar(string[i])) {
        if (bracketValues[string[i]] === 1) nestLevel++;
        else if (bracketValues[string[i]] === -1) {
          if (nestLevel === 0) throw new Error(`Syntax Error: unexpected parenthesis '${string[i]}' at ${i}`);
          nestLevel--;
        }

        const t = new BracketToken(this, string[i]);
        tokens.push(t);
        i++;
        continue;
      }

      // Operator?
      let op = parseOperator(string.substr(i));
      if (op !== null) {
        let top = peek(tokens);
        if ((op === '-' || op === '+') && (tokens.length === 0 || top instanceof OperatorToken || top instanceof BracketToken)) {
          // Negative sign for a number, then
        } else {
          const t = new OperatorToken(this, op);
          tokens.push(t);
          i += op.length;
          continue;
        }
      }

      // Number?
      let o = parseNumber(string.substr(i));
      if (o.nStr.length !== 0) {
        const t = new NumberToken(this, o.n);
        tokens.push(t);
        i += o.pos;
        continue;
      }

      // Function?
      let fname = parseFunction(string.substr(i));
      if (fname !== null && this.env.func(fname) !== undefined) {
        i += fname.length;
        while (string[i] === ' ') i++; // Remove whitespace
        let t;
        if (string[i] === '(') {
          // Get matching bracket
          let end;
          try {
            end = getMatchingBracket(i, string);
          } catch (e) {
            throw new Error(`Syntax Error: unmatched parenthesis '${string[i]}' at ${i}`);
          }
          // Extract function argument string
          let argString = string.substring(i + 1, end);
          // Parse argument string
          try {
            t = new FunctionToken(this, fname, argString);
          } catch (e) {
            throw new Error(`Syntax Error: ${argString}:\n${e}`);
          }
          i += argString.length + 2; // Skip over argument string and ()
        } else {
          // throw new Error(`Syntax Error: expected '(' after function reference`);
          t = new FunctionRefToken(this, fname);
        }
        tokens.push(t);
        continue;
      }

      // Variable?
      let vname = parseVariable(string.substr(i));
      if (vname !== null) {
        let t = new VariableToken(this, vname);
        tokens.push(t);
        i += vname.length;
        continue;
      }

      throw new Error(`Syntax Error: unexpected token '${string[i]}' at ${i}`);
    }
    if (inString) throw new Error(`Syntax Error: unterminated string literal at position ${strPos}`);

    // Special actions e.g. multiply adjacent variables
    const newTokens = [];
    for (let i = 0; i < tokens.length; i++) {
      newTokens.push(tokens[i]);
      if (tokens[i + 1] instanceof Token && tokens[i].adjacentMultiply(tokens[i + 1])) {
        newTokens.push(new OperatorToken(this, '!*')); // High-precedence multiplication
      }
    }
    // console.log(this.string, newTokens.map(t => t.toString()));

    tokens.length = 0;
    newTokens.forEach(i => tokens.push(i));
    return comment;
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
        const val = T[i].eval();
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
        for (let i = 0; i < info.args; i++) args.unshift(stack.pop().eval()); // if stack is [a, b] pass in fn(a, b)
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
    if (stack.length === 0) return 0;
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

module.exports = { Token, NumberToken, NonNumericalToken, BracketToken, VariableToken, OperatorToken, FunctionToken, FunctionRefToken, TokenString };