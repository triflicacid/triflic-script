const { peek, str, createTokenStringParseObj } = require("../utils");
const { bracketValues, bracketMap, parseNumber, parseOperator, parseFunction, parseVariable } = require("./parse");
const { RunspaceUserFunction, RunspaceBuiltinFunction } = require("../runspace/Function");
const { StringValue, ArrayValue, NumberValue, FunctionRefValue, Value, primitiveToValueClass, SetValue } = require("./values");
const { isNumericType } = require("./types");

class Token {
  constructor(tstring, v, pos = NaN) {
    this.tstr = tstring;
    this.value = v;
    this.pos = pos; // Definition position
  }
  eval(type) { throw new Error(`Overload Required (type provided: ${type})`); }
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

/** Token which refers to a Value class. */
class ValueToken extends Token {
  constructor(tstring, value, pos) {
    super(tstring, value, pos);
  }

  eval(type) { return this.value.eval(type); }

  adjacentMultiply(obj) {
    const t = this.value.type();
    if (isNumericType(t)) return obj instanceof FunctionToken || obj instanceof VariableToken || (obj instanceof BracketToken && obj.facing() === 1);
    return false;
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

  adjacentMultiply(obj) {
    if (this.facing() === -1) {
      if (obj instanceof BracketToken && bracketMap[this.value] === obj.value) return true; // Matching brackets e.g. ')(' or ']['
      return obj instanceof FunctionToken || obj instanceof VariableToken || (obj instanceof ValueToken && isNumericType(obj.value.type()));
    }
    return false;
  }
}

/** For operators e.g. '+' */
class OperatorToken extends Token {
  constructor(tstring, op, pos) {
    super(tstring, op, pos);
    if (tstring.rs.operators[op] === undefined) throw new Error(`new OperatorToken() : '${op}' is not an operator`);
    this.isUnary = false;
  }

  /** Eval as operators */
  eval(...args) {
    const info = this.info();
    let fn = Array.isArray(info.args) ? info['fn' + args.length] : info.fn;
    if (typeof fn !== 'function') throw new Error(`Internal Error: operator function for ${this.value} with ${args.length} args is undefined`);
    let r = fn(...args);
    if (r === undefined) throw new Error(`Type Error: Operator ${this.value} does not support arguments { ${args.map(a => a.type()).join(', ')} }`);
    return r;
  }

  priority() {
    return +this.info().precedence;
  }

  info() {
    let i = this.tstr.rs.operators[this.value];
    if (this.isUnary) {
      i = this.tstr.rs.operators[i.unary];
      if (i === undefined) throw new Error(`Operator ${this.toString()} has no unary counterpart (isUnary=${this.isUnary})`);
    }
    return i;
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
  eval(type) {
    return this.tstr.rs.var(this.value)?.eval(type);
  }
  toPrimitive(type) {
    return this.tstr.rs.var(this.value)?.toPrimitive(type);
  }
  exists() {
    return this.tstr.rs.var(this.value) !== undefined;
  }
  getVar() {
    return this.tstr.rs.var(this.value);
  }
  adjacentMultiply(obj) {
    return obj instanceof FunctionToken || obj instanceof VariableToken || (obj instanceof BracketToken && obj.facing() === 1);
  }
  toString() {
    return str(this.getVar()?.value);
  }
  __del__() {
    const v = this.getVar();
    if (v.constant) throw new Error(`Argument Error: Attempt to delete a constant variable ${this.value}`);
    this.tstr.rs.var(this.value, null);
    return new NumberValue(this.tstr.rs, 0);
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
    const fn = this.tstr.rs.func(this.value);
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
    return this.tstr.rs.func(this.value) === undefined;
  }

  adjacentMultiply(obj) {
    return obj instanceof FunctionToken || obj instanceof VariableToken || (obj instanceof BracketToken && obj.facing() === 1);
  }

  toString() {
    return `${this.value}(${this.raw})`;
  }
}


/** Take input as a string. Use TokenString#parse() to transform into array of tokens */
class TokenString {
  constructor(runspace, string) {
    this.rs = runspace;
    this.string = string;
    this.tokens = []; // Array of token objects
    this.comment = '';
    // this.setAns = true; // Used by Runspace; use value produced as 'ans' variable?
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
          const t = new ValueToken(this, new StringValue(this.rs, str), obj.pos);
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
      if (string[i] in bracketValues) {
        let t = new BracketToken(this, string[i], obj.pos);

        if (string[i] === '(') {
          brackets.push(t);
        } else if (bracketValues[string[i]] === -1) {
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
        } else if (string[i] === '[' || string[i] === '{') {
          i++;
          obj.pos++;

          const itemTokens = [];
          const [done, endPos] = this._parseCommaSeperated(itemTokens, string.substr(i), obj.pos, obj.depth, bracketMap[t.value]);
          if (!done) throw new Error(`Syntax Error: expected '${bracketMap[t.value]}' after array declaration following '${t.value}' (position ${t.pos})`);

          const argStr = string.substr(i, (endPos - obj.pos) - 1);
          obj.pos += argStr.length;
          i += argStr.length;

          const Klass = t.value === '{' ? SetValue : ArrayValue;
          let value = new Klass(this.rs, itemTokens.map(ts => ts.eval()));
          t = new ValueToken(this, value, obj.pos);
        } else {
          throw new Error(`SYntax Error: unexpected token '${string[i]}' at position ${obj.pos}`);
        }

        obj.tokens.push(t);
        i++;
        obj.pos++;
        continue;
      }

      // Operator?
      let op = parseOperator(this.rs, string.substr(i));
      if (op !== null) {
        const t = new OperatorToken(this, op, obj.pos);

        // Is unary: first, after (, after an operator
        const top = peek(obj.tokens);
        if (top === undefined || (top instanceof BracketToken && top.facing() === 1) || top instanceof OperatorToken) {
          // Check if has unary counterpart
          if (this.rs.operators[t.info().unary] === undefined) throw new Error(`Syntax Error: unexpected operator ${t} (flagged as unary, but no associated unary overload found)`);

          t.isUnary = true;
        }

        obj.tokens.push(t);
        i += op.length;
        obj.pos += op.length;
        continue;
      }

      // Number?
      let o = parseNumber(string.substr(i));
      if (o.nStr.length !== 0) {
        const t = new ValueToken(this, new NumberValue(this.rs, o.n), obj.pos);
        obj.tokens.push(t);
        i += o.pos;
        obj.pos += o.pos;
        continue;
      }

      // Function?
      let fname = parseFunction(string.substr(i));
      functionParseBlock:
      if (fname !== null && (isDeclaration || this.rs.func(fname) !== undefined)) {
        const declPos = obj.pos; // Position where function name was enountered
        i += fname.length;
        obj.pos += fname.length;
        while (string[i] === ' ') { i++; obj.pos++; } // Remove whitespace
        let t;
        if (string[i] === '(') {
          const openingBracket = new BracketToken(this, string[i], obj.pos);
          i++;
          obj.pos++;

          const argTokens = [];
          const [done, endPos] = this._parseCommaSeperated(argTokens, string.substr(i), obj.pos, obj.depth, bracketMap[openingBracket.value]);
          if (!done) throw new Error(`Syntax Error: expected '${bracketMap[openingBracket.value]}' after <function ${fname}> invocation following '${openingBracket.value}' (position ${openingBracket.pos})`);

          const argStr = string.substr(i, (endPos - obj.pos) - 1);
          obj.pos = endPos;
          i += argStr.length + 1;

          t = new FunctionToken(this, fname, argStr, argTokens, declPos);
          t.isDeclaration = isDeclaration;
          if (isDeclaration) isDeclaration = 0; // End of declaration
        } else {
          if (isDeclaration) { // Now a variable declaration; go back to before fname
            i -= obj.pos - declPos;
            obj.pos = declPos;
            break functionParseBlock;
          }
          t = new ValueToken(this, new FunctionRefValue(this.rs, fname), obj.pos);
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
      if (obj.tokens[i + 1] instanceof OperatorToken && obj.tokens[i + 1].value === '=' && !obj.tokens[i].isDeclaration) {
        obj.tokens[i].isDeclaration = 1;
      } else if (obj.tokens[i + 1] instanceof Token && obj.tokens[i] instanceof Token && obj.tokens[i].adjacentMultiply(obj.tokens[i + 1])) {
        newTokens.push(new OperatorToken(this, '!*', obj.tokens[i].pos)); // High-precedence multiplication
      }
    }

    obj.tokens.length = 0;
    newTokens.forEach(i => obj.tokens.push(i));
    return;
  }

  _parseCommaSeperated(argTokens, string, pos, depth, closingSymbol) {
    let i = 0, done = false;
    while (!done && i < string.length) { // Keep parsing args until ending thing is found
      const pobj = createTokenStringParseObj(string.substr(i), pos, depth + 1, closingSymbol);
      try {
        this._parse(pobj); // Parse
        if (pobj.tokens.length !== 0) { // Not Empty
          const ts = new TokenString(this.rs, string.substr(i, pobj.pos - pos));
          ts.tokens = pobj.tokens;
          argTokens.push(ts);
        }

        // Increment position
        i += (pobj.pos - pos) + 1;
        pos = pobj.pos + 1;

        // Was terminating bracket met?
        if (pobj.terminateClosing === true) {
          done = true;
        }
      } catch (e) {
        throw new Error(`${string}:\n${e}`);
      }
    }
    return [done, pos];
  }

  eval() {
    try {
      return this._eval();
    } catch (e) {
      throw e
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
          if (this.rs.func(name)) throw new Error(`Syntax Error: Invalid syntax - symbol '${name}' is a function but treated as a variable at position ${this.tokens[0].pos}`);
          if (this.rs.var(name)?.constant) throw new Error(`Syntax Error: Assignment to constant variable ${name} (position ${this.tokens[1].pos})`);
          // Setup TokenString
          let ts = new TokenString(this.rs, '');
          ts.tokens = defTokens;
          // Evaluate
          const obj = ts.eval(); // Intermediate
          const varObj = this.rs.var(name, obj);
          if (this.tokens[0].isDeclaration === 2) varObj.constant = true;
          if (this.comment) varObj.desc = this.comment;
          return obj;
        } else if (this.tokens[0] instanceof FunctionToken) {
          let name = this.tokens[0].value;
          if (this.rs.var(name)) throw new Error(`Syntax Error: Invalid syntax - symbol '${name}' is a variable but treated as a function at position ${this.tokens[0].pos}`);
          if (this.rs.opts.strict && this.rs.func(name) instanceof RunspaceBuiltinFunction) throw new Error(`Strict Mode: cannot redefine built-in function ${name}`);
          if (this.rs.func(name)?.constant) throw new Error(`Syntax Error: Assignment to constant function ${name} (position ${this.tokens[1].pos})`);
          // Extract function arguments - each TokenString in FunctionToken#args should contain ONE symbol
          let fargs = [], a = 0;
          for (let argts of this.tokens[0].args) {
            if (argts.tokens.length !== 1) throw new Error(`Syntax Error: Invalid function declaration: function ${name} paramater ${a} (positions ${argts.tokens[0].pos} - ${peek(argts.tokens).pos})`);
            if (!(argts.tokens[0] instanceof VariableToken)) throw new Error(`Syntax Error: Invalid function declaration: function ${name} paramater ${a} (positions ${argts.tokens[0].pos} - ${peek(argts.tokens).pos}): invalid parameter ${argts.tokens[0]}`);
            fargs[a] = argts.tokens[0].value;
            a++;
          }
          // Setup TokenString
          let ts = new TokenString(this.rs, '');
          ts.tokens = defTokens;
          // Define function
          const fn = new RunspaceUserFunction(this.rs, name, fargs, ts, this.comment || undefined);
          if (this.tokens[0].isDeclaration === 2) fn.constant = true;
          this.rs.define(fn);
          return new FunctionRefValue(this.rs, name);
        } else {
          throw new Error(`Syntax Error: invalid assignment at position ${this.tokens[0].pos}: cannot assign to ${typeof this.tokens[0]} ${this.tokens[0]}`);
        }
      } else {
        throw new Error(`Syntax Error: expected assignment operator following declaration at position ${this.tokens[0].pos}`);
      }
    }

    for (let i = 0; i < this.tokens.length; i++) {
      if (this.tokens[i] instanceof ValueToken) this.tokens[i] = this.tokens[i].value;
    }

    const T = this._toRPN(this.tokens, this.rs.opts.bidmas), stack = []; // STACK SHOULD ONLY CONTAIN COMPLEX()
    for (let i = 0; i < T.length; i++) {
      if (T[i] instanceof Value) {
        stack.push(T[i]);
      } else if (T[i] instanceof FunctionToken) {
        const val = T[i].eval();
        stack.push(val);
      } else if (T[i] instanceof VariableToken) {
        if (!T[i].exists()) throw new Error(`Name Error: name '${T[i].value}' does not exist (position ${T[i].pos})`);
        stack.push(T[i]);
      } else if (T[i] instanceof FunctionRefValue) {
        if (!T[i].exists()) throw new Error(`Reference Error: null reference ${T[i]} (position ${T[i].pos})`);
        stack.push(T[i]);
      } else if (T[i] instanceof OperatorToken) {
        const info = T[i].info();
        let argCount;
        if (Array.isArray(info.args)) {
          for (let i = 0; i < info.args.length; i++) {
            if (info.args[i] <= stack.length) {
              argCount = info.args[i];
              break;
            }
          }
        } else {
          argCount = info.args;
        }
        if (stack.length < argCount) throw new Error(`Syntax Error: unexpected operator '${T[i]}' at position ${T[i].pos} - stack underflow (expects ${argCount} values, got ${stack.length}) (while evaluating)`);
        if (argCount === undefined) throw new Error(`Syntax Error: unexpected operator '${T[i]}' at position ${T[i].pos} - no overload found for <= ${stack.length} parameters (while evaluating)`);
        let args = [];
        for (let i = 0; i < argCount; i++) args.unshift(stack.pop()); // if stack is [a, b] pass in fn(a, b)
        const val = T[i].eval(...args);
        stack.push(val);
      } else {
        throw new Error(`Syntax Error: invalid syntax at position ${T[i].pos}: ${T[i]}`);
      }
    }
    if (stack.length === 0) return new NumberValue(this.rs, 0);
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
      if (tokens[i] instanceof ValueToken || tokens[i] instanceof Value || tokens[i] instanceof VariableToken || tokens[i] instanceof FunctionToken) {
        output.push(tokens[i]);
      } else if (tokens[i].is(BracketToken, '(')) {
        stack.push(tokens[i]);
      } else if (tokens[i].is(BracketToken, ')')) {
        while (peek(stack) instanceof Token && !peek(stack).is(BracketToken, '(')) {
          output.push(stack.pop());
        }
        stack.pop(); // Remove ) from stack
      } else if (tokens[i] instanceof OperatorToken) {
        const info = tokens[i].info();
        if (info.preservePosition) {
          output.push(tokens[i]);
        } else {
          if (bidmas) {
            while (stack.length !== 0 && tokens[i].priority() < peek(stack).priority()) output.push(stack.pop());
          } else {
            while (stack.length !== 0) output.push(stack.pop());
          }
          stack.push(tokens[i]);
        }
      } else {
        throw new Error(`Unknown token: ${typeof tokens[i]} ${tokens[i].constructor.name}`);
      }
    }
    while (stack.length !== 0) output.push(stack.pop()); // Dump the stack
    return output;
  }
}

module.exports = { Token, BracketToken, VariableToken, OperatorToken, FunctionToken, TokenString };