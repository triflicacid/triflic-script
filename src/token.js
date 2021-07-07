const Complex = require("../Complex");
const { parseNumber, parseOperator, parseSymbol, getMatchingBracket, peek, operators, isMathError } = require("../utils");


class Token {
  constructor(tstring, v) {
    this.tstr = tstring;
    this.value = v;
  }
  is(klass, val = undefined) {
    return (this instanceof klass && (val != undefined && this.value === val));
  }
  toString() {
    return this.value.toString();
  }
}

/** For numerical values e.g. '3.1519' */
class NumberToken extends Token {
  constructor(tstring, n) {
    super(tstring, new Complex(n));
  }
  eval() {
    return this.n;
  }
}

/** For grammer items e.g. '(' */
class GrammarToken extends Token {
  constructor(tstring, x) {
    super(tstring, x);
  }
  priority() { return 0; }
  static isGrammar(x) {
    const array = ["(", ")", "[", "]", "{", "}"];
    return array.includes(x);
  }
}

/** For operators e.g. '+' */
class OperatorToken extends Token {
  constructor(tstring, op) {
    super(tstring, op);
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
  valueOf() {
    return this.tstr.env.var(this.value);
  }
}

/** For functions e.g. 'f(...)' (non-definitions) */
class FunctionToken extends Token {
  constructor(tstring, fname, body) {
    super(tstring, fname);

    let rargs = body.split(',').filter(a => a.length !== 0);
    this.args = rargs.map(a => new TokenString(tstring.env, a));
  }
  eval() {
    let fn = this.tstr.env.func(this.value);
    if (fn === undefined) throw new Error(`Name Error: name '${this.value}' is not a function`);
    let args = this.args.map(a => a.eval());
    return fn.eval(args);
  }
  toString() {
    return `${this.value}(${this.args.map(a => a.toString()).join(', ')})`;
  }
}

class TokenString {
  constructor(env, string) {
    this.env = env;
    this.string = string;
    this.tokens = []; // Array of token objects
    if (string) this.parse();
  }

  parse() {
    this.tokens = this._parse(this.string);
  }

  toRPN() {
    this.tokens = this._toRPN(this.tokens);
  }

  eval() {
    try {
      return this._eval();
    } catch (e) {
      throw new Error(`Error in '${this.toString()}':\n${e}`);
    }
  }

  _eval() {
    const T = this._toRPN(this.tokens), stack = []; // STACK SHOULD ONLY CONTAIN COMPLEX()
    for (let i = 0; i < T.length; i++) {
      if (T[i] instanceof NumberToken) {
        stack.push(T[i].value);
      } else if (T[i] instanceof FunctionToken) {
        let res = T[i].eval([]);
        stack.push(res);
      } else if (T[i] instanceof VariableToken) {
        let val = T[i].valueOf();
        if (val === undefined) throw new Error(`Name Error: name '${T[i]}' does not exist`);
        stack.push(val);
      } else if (T[i] instanceof OperatorToken) {
        const info = T[i].info();
        if (stack.length < info.args) throw new Error(`Syntax Error: unexpected operator '${T[i]}' (SIG_STACK_UNDERFLOW while evaluating)`);
        let args = [];
        for (let i = 0; i < info.args; i++) args.unshift(stack.pop()); // if stack is [a, b] pass in fn(a, b)
        let res = T[i].eval(...args);
        // isMathError(res, `At operator '${T[i]}' given values { ${args.join(', ')} }`);
        stack.push(res);
      }
    }
    if (stack.length !== 1) throw new Error(`Syntax Error: Invalid syntax`);
    return stack[0];
  }

  toString() {
    return this.tokens.map(t => t.toString()).join(' ');
  }

  /** Parse a raw input string. Return token array */
  _parse(string) {
    string = string.replace(/\s+/g, '');
    string = string.replace(/÷/g, '/');
    string = string.replace(/×/g, '*');
    const tokens = [];

    for (let i = 0; i < string.length;) {
      // Grammar?
      if (GrammarToken.isGrammar(string[i])) {
        const t = new GrammarToken(this, string[i]);
        tokens.push(t);
        i++;
        continue;
      }

      // Operator?
      let op = parseOperator(string.substr(i));
      if (op !== null) {
        if (op === '-' && (tokens.length === 0 || peek(tokens) instanceof OperatorToken)) {
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

      // Symbol?
      let symbol = parseSymbol(string.substr(i));
      if (symbol !== null) {
        let t;
        i += symbol.length;
        if (string[i] === '(') { // Function
          let end;
          try {
            end = getMatchingBracket(i, string);
          } catch (e) {
            throw new Error(`Syntax Error: unmatched parenthesis '${string[i]}' at ${i}`);
          }
          let body = string.substring(i + 1, end);
          try {
            t = new FunctionToken(this, symbol, body);
          } catch (e) {
            throw new Error(`Syntax Error: error whilst parsing function '${symbol}' at ${i}:\n${e}`);
          }
          i = end + 1; // Extend past closing bracket
        } else {
          t = new VariableToken(this, symbol);
          let p = peek(tokens);
          if (p instanceof VariableToken || p instanceof NumberToken) {
            tokens.push(t);
            t = new OperatorToken(this, '*'); // Multiply adjacent symbols
          }
        }
        tokens.push(t);
        continue;
      }

      throw new Error(`Syntax Error: unexpected token '${string[i]}' at ${i}`);
    }

    return tokens;
  }

  /** Token array from infix to postfix */
  _toRPN(tokens) {
    const stack = [], output = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] instanceof NumberToken || tokens[i] instanceof VariableToken || tokens[i] instanceof FunctionToken) {
        output.push(tokens[i]);
      } else if (tokens[i].is(GrammarToken, '(')) {
        stack.push(tokens[i]);
      } else if (tokens[i].is(GrammarToken, ')')) {
        while (peek(stack) instanceof Token && !peek(stack).is(GrammarToken, '(')) {
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

module.exports = { Token, NumberToken, GrammarToken, VariableToken, OperatorToken, FunctionToken, TokenString };