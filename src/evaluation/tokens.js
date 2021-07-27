const { peek, str, createTokenStringParseObj, isWhitespace } = require("../utils");
const { bracketValues, bracketMap, parseNumber, parseOperator, parseSymbol } = require("./parse");
const { RunspaceUserFunction, RunspaceBuiltinFunction } = require("../runspace/Function");
const { StringValue, ArrayValue, NumberValue, FunctionRefValue, Value, SetValue } = require("./values");
const { isNumericType } = require("./types");
const operators = require("./operators");
const { errors } = require("../errors");

class Token {
  constructor(tstring, v, pos = NaN) {
    this.tstr = tstring;
    this.value = v;
    this.pos = pos; // Definition position
  }
  castTo(type) { throw new Error(`Overload Required (type provided: ${type})`); }
  is(klass, val = undefined) {
    return (this instanceof klass && (val != undefined && this.value === val));
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

  castTo(type) { return this.value.castTo(type); }
}

class BracketToken extends Token {
  constructor(tstring, x, pos) {
    super(tstring, x, pos);
    if (bracketValues[x] === undefined) throw new Error(`new BracketToken() : '${x}' is not a bracket`);
    this.matching = undefined; // Matching BracketToken
  }
  priority() { return 0; }

  /** 1 : opening, -1 : closing */
  facing() {
    return bracketValues[this.value];
  }
}

/** For operators e.g. '+' */
class OperatorToken extends Token {
  constructor(tstring, op, pos) {
    super(tstring, op, pos);
    if (operators[op] === undefined) throw new Error(`new OperatorToken() : '${op}' is not an operator`);
    this.isUnary = false;
  }

  /** Eval as operators */
  eval(...args) {
    const info = this.info();
    let fn = Array.isArray(info.args) ? info['fn' + args.length] : info.fn;
    if (typeof fn !== 'function') throw new Error(`[${errors.ARG_COUNT}] Argument Error: no overload for operator function ${this.value} with ${args.length} args`);
    let r;
    try { r = fn(...args); } catch (e) { throw new Error(`Operator ${this.value}:\n${e}`); }
    if (r instanceof Error) throw r; // May return custom errors
    if (r === undefined) throw new Error(`[${errors.TYPE_ERROR}] Type Error: Operator ${this.value} does not support arguments { ${args.map(a => a.type()).join(', ')} }`);
    return r;
  }

  priority() {
    return +this.info().precedence;
  }

  info() {
    let i = operators[this.value];
    if (this.isUnary) {
      i = operators[i.unary];
      if (i === undefined) throw new Error(`[${errors.ARG_COUNT}] Operator ${this.toString()} has no unary counterpart (isUnary=${this.isUnary})`);
    }
    return i;
  }

  toString() {
    return this.isUnary ? operators[this.value].unary : this.value;
  }
}

/** For symbols e.g. 'hello' */
class VariableToken extends Token {
  constructor(tstring, vname, pos) {
    super(tstring, vname, pos);
    this.isDeclaration = false; // Is this token on the RHS of assignment?
  }
  type() {
    return this.isDeclaration ? `<symbol ${this.value}>` : str(this.getVar()?.value.type());
  }
  castTo(type) {
    let v = this.tstr.rs.var(this.value);
    if (v.value === this) throw new Error(`Self-referencing variable (infinite lookup prevented) - variable '${this.value}'`);
    return v.castTo(type);
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
  toString() {
    return this.isDeclaration ? this.value : str(this.getVar()?.value);
  }

  /** function: del() */
  __del__() {
    const v = this.getVar();
    if (v.constant) throw new Error(`[${errors.DEL}] Argument Error: Attempt to delete a constant variable ${this.value}`);
    this.tstr.rs.var(this.value, null);
    return new NumberValue(this.tstr.rs, 0);
  }

  /** operator: = */
  __assign__(v) {
    const name = this.value;
    // if (this.tstr.rs.func(name)) throw new Error(`[${errors.ARG_COUNT}] Syntax Error: Invalid syntax - symbol '${name}' is a function but treated as a variable at position ${this.pos}`);
    if (this.tstr.rs.var(name)?.constant) throw new Error(`[${errors.ASSIGN}] Syntax Error: Assignment to constant variable ${name} (position ${this.pos})`);
    // Setup TokenString
    const ts = new TokenString(this.tstr.rs, '');
    ts.tokens = [v];
    // Evaluate
    const obj = ts.eval(); // Intermediate
    const varObj = this.tstr.rs.var(name, obj.castTo('any'));
    if (this.isDeclaration === 2) varObj.constant = true; // Is variable constant?
    return obj;
  }
}

/** Contains array of token strings in this.token */
class TokenStringArray extends Token {
  /** @param {TokenString[]} tokens Array of tokens which were seperated by commas */
  constructor(tstring, tokens, pos) {
    super(tstring, tokens, pos);
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
    let string = obj.string, inString = false, strPos, str = ''; // isDeclaration: are we declaring a function? (alters behaviour of lexer - 0:no, 1:yes, 2:yes,constant)

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

      // Break??
      if (obj.terminateOn.includes(string[i])) {
        obj.terminateOn = string[i];
        break;
      }

      if (isWhitespace(string[i])) {
        i++;
        obj.pos++;
        continue; // WHITESPACE - IGNORE
      }

      // Comment? (only recognise in depth=0)
      if (obj.depth === 0 && string[i] === '#') {
        obj.comment = string.substr(i + 2).trim();
        break;
      }

      // Bracket Group?
      if (string[i] in bracketValues) {
        if (bracketValues[string[i]] === -1) { // Should never come across a closing bracket
          this._throwMatchingBracketError(string[i], bracketMap[string[i]], obj.pos);
        } else if (string[i] === '(') {
          const opening = new BracketToken(this, '(', obj.pos);
          i++;
          obj.pos++;

          // Normal bracket group? (evaluate normally) or evaluate as calling group
          const topmost = peek(obj.tokens);
          if (!topmost || topmost instanceof OperatorToken) {
            if (i >= string.length) this._throwMatchingBracketError(opening.value, bracketMap[opening.value], obj.pos);
            const pobj = createTokenStringParseObj(string.substr(i), obj.pos, obj.depth + 1, [')']);
            this._parse(pobj);

            let d = pobj.pos - opening.pos;
            i += d;
            obj.pos += d;

            const closing = new BracketToken(this, ')', obj.pos);
            opening.matching = closing;
            opening.matching = opening;

            obj.tokens.push(opening, ...pobj.tokens, closing);
          } else {
            // throw new Error(`Syntax Error: ) must follow an operator`);
            const argTokens = [];
            const [done, endPos] = this._parseCommaSeperated(argTokens, string.substr(i), obj.pos, obj.depth + 1, bracketMap[opening.value]);
            if (!done) this._throwMatchingBracketError(opening.value, bracketMap[opening.value], obj.pos);

            const argStr = string.substr(i, (endPos - obj.pos) - 1);
            obj.pos = endPos;
            i += argStr.length + 1;
            const array = new TokenStringArray(this, argTokens, opening.pos);
            obj.tokens.push(array);
          }
          continue;
        } else if (string[i] === '[' || string[i] === '{') {
          const opening = new BracketToken(this.rs, string[i], obj.pos);
          i++;
          obj.pos++;

          const itemTokens = [];
          const [done, endPos] = this._parseCommaSeperated(itemTokens, string.substr(i), obj.pos, obj.depth, bracketMap[opening.value]);
          if (!done) throw new Error(`[${errors.SYNTAX}] Syntax Error: expected '${bracketMap[opening.value]}' after array declaration following '${opening.value}'(position ${opening.pos})`);

          const argStr = string.substr(i, (endPos - obj.pos) - 1);
          obj.pos += argStr.length + 1;
          i += argStr.length + 1;

          const Klass = opening.value === '{' ? SetValue : ArrayValue;
          let value = new Klass(this.rs, itemTokens.map(ts => ts.eval()));
          let valuet = new ValueToken(this, value, obj.pos);
          obj.tokens.push(valuet);

          continue;
        }
      }

      // Operator?
      let op = parseOperator(string.substr(i));
      if (op !== null) {
        const t = new OperatorToken(this, op, obj.pos);

        // Is unary: first, after (, after an operator (first, check that there IS a unary operator available)
        const top = peek(obj.tokens);
        if (t.info().unary && (top === undefined || (top instanceof BracketToken && top.facing() === 1) || top instanceof OperatorToken)) {
          t.isUnary = true;
        }

        obj.tokens.push(t);
        i += op.length;
        obj.pos += op.length;
        continue;
      }

      // Number?
      const numObj = parseNumber(string.substr(i));
      if (numObj.str.length > 0) {
        const t = new ValueToken(this, new NumberValue(this.rs, numObj.num), obj.pos);
        obj.tokens.push(t);
        i += numObj.pos;
        obj.pos += numObj.pos;
        continue;
      }

      // Variable? (symbol)
      let symbol = parseSymbol(string.substr(i));
      if (symbol !== null) {
        let t = new VariableToken(this, symbol, obj.pos);
        obj.tokens.push(t);

        i += symbol.length;
        obj.pos += symbol.length;
        continue;
      }

      throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected token '${string[i]}' (${string[i].charCodeAt(0)}) at position ${obj.pos} `);
    }
    if (inString) throw new Error(`[${errors.UNTERM_STRING}] Syntax Error: unterminated string literal at position ${strPos} `);

    // Special actions:
    // - If a variable is followed by a '=', set .isDeclaration=1
    // - Multiply adjacent variables
    const newTokens = [];
    for (let i = 0; i < obj.tokens.length; i++) {
      newTokens.push(obj.tokens[i]);
      if (obj.tokens[i + 1] instanceof OperatorToken && (obj.tokens[i + 1].value === '=' || obj.tokens[i + 1].value === ':=') && !obj.tokens[i].isDeclaration) {
        const declType = obj.tokens[i + 1].value === ':=' ? 2 : 1;
        // Set isDeclaration of every Token before we meet a VariableToken = 1
        for (let j = i; j >= 0; j--) {
          obj.tokens[j].isDeclaration = declType;
          if (obj.tokens[j] instanceof VariableToken) break;
        }
      }
    }

    obj.tokens.length = 0;
    newTokens.forEach(i => obj.tokens.push(i));
    return;
  }

  _parseCommaSeperated(argTokens, string, pos, depth, closingSymbol) {
    let i = 0, done = false;
    while (!done && i < string.length) { // Keep parsing args until ending thing is found
      const pobj = createTokenStringParseObj(string.substr(i), pos, depth + 1, [",", closingSymbol]);
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
        if (pobj.terminateOn === closingSymbol) {
          done = true;
        }
      } catch (e) {
        throw new Error(`${string}: \n${e} `);
      }
    }
    return [done, pos];
  }

  eval() {
    try {
      return this._eval();
    } catch (e) {
      throw new Error(`${this.string}: \n${e} `);
    }
  }

  _eval() {
    // Remove ValueTokens
    for (let i = 0; i < this.tokens.length; i++) {
      if (this.tokens[i] instanceof ValueToken) this.tokens[i] = this.tokens[i].value;
    }

    const T = this.toRPN(), stack = []; // STACK SHOULD ONLY CONTAIN COMPLEX()
    for (let i = 0; i < T.length; i++) {
      if (T[i] instanceof Value) {
        stack.push(T[i]);
      } else if (T[i] instanceof VariableToken) {
        if (!T[i].isDeclaration && !T[i].exists()) throw new Error(`[${errors.NAME}] Name Error: name '${T[i].value}' does not exist (position ${T[i].pos})`);
        stack.push(T[i]);
      } else if (T[i] instanceof FunctionRefValue) {
        if (!T[i].isDeclaration && !T[i].exists()) throw new Error(`[${errors.NULL_REF}] Reference Error: null reference ${T[i]} (position ${T[i].pos})`);
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
        if (stack.length < argCount) throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected operator '${T[i]}' at position ${T[i].pos} - stack underflow (expects ${argCount} values, got ${stack.length}) (while evaluating)`);
        if (argCount === undefined) throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected operator '${T[i]}' at position ${T[i].pos} - no overload found for <= ${stack.length} parameters (while evaluating)`);
        let args = [];
        for (let i = 0; i < argCount; i++) args.unshift(stack.pop()); // if stack is [a, b] pass in fn(a, b)
        const val = T[i].eval(...args);
        stack.push(val);
      } else if (T[i] instanceof TokenStringArray) {
        const last = stack.pop(); // SHould be VariableToken
        if (!last) throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected TokenStringArray in position ${T[i].pos}`);
        if (last.isDeclaration) { // Declare function
          if (!(last instanceof VariableToken)) throw new Error(`[${errors.SYNTAX}] Syntax Error: expected symbol to precede bracketed group in declaration (position ${T[i].pos})`);
          const assignment = peek(T); // Should be assignment
          if (!(assignment instanceof OperatorToken) && (assignment.value === '=' || assignment.value === ':=')) throw new Error(`[${errors.SYNTAX}] Syntax Error: expected assignment operator after function declaration (position ${T[i].pos})`);
          T.pop(); // Remove assignment operator
          const ref = new FunctionRefValue(this.rs, last.value), params = [];
          for (const ts of T[i].value) {
            if (ts.tokens.length !== 1 || !(ts.tokens[0] instanceof VariableToken)) throw new Error(`[${errors.SYNTAX}] Syntax Error: Illegal function declaration`);
            params.push(ts.tokens[0]);
          }

          const bodyTokens = T.slice(++i);
          i += bodyTokens.length;
          const body = new TokenString(this.rs, '');
          body.tokens = bodyTokens;
          ref.defineFunction(params, body, assignment.pos, last.isDeclaration === 2, this.comment);
          stack.push(ref);
        } else { // Attempt to call last thing
          const lastValue = last.castTo("any");
          if (typeof lastValue?.__call__ !== 'function') throw new Error(`[${errors.NOT_CALLABLE}] Type Error: type ${lastValue.type()} is not callable (position ${T[i].pos})`);
          let args = [];
          try {
            args = T[i].value.map(t => t.eval()); // Evaluate TokenString arguments
            stack.push(lastValue.__call__(args));
          } catch (e) {
            throw new Error(`${last}:\n${e}`);
          }
        }
      } else {
        throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid syntax at position ${T[i].pos}: ${T[i]} `);
      }
    }
    if (stack.length === 0) return new NumberValue(this.rs, 0);
    if (stack.length !== 1) throw new Error(`[${errors.SYNTAX}] Syntax Error: Invalid syntax (evaluation failed to reduce expression to single number)`);
    return stack[0];
  }

  toString() {
    return this.tokens.map(t => t.toString()).join(' ');
  }

  /** Return array of tokens of this tokenString RPNd */
  toRPN() {
    return this._toRPN(this.tokens, this.rs.opts.bidmas);
  }

  /** Token array from infix to postfix */
  _toRPN(tokens, bidmas = true) {
    const stack = [], output = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] instanceof ValueToken || tokens[i] instanceof Value || tokens[i] instanceof VariableToken || tokens[i] instanceof TokenStringArray) {
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
            while (stack.length !== 0 && tokens[i].priority() <= peek(stack).priority()) output.push(stack.pop());
          } else {
            while (stack.length !== 0) output.push(stack.pop());
          }
          stack.push(tokens[i]);
        }
      } else {
        throw new Error(`[${errors.SYNTAX}] Unknown token: ${typeof tokens[i]} ${tokens[i].constructor.name} `);
      }
    }
    while (stack.length !== 0) output.push(stack.pop()); // Dump the stack
    return output;
  }

  /** Error with matching brackets */
  _throwMatchingBracketError(open, close, pos) {
    throw new Error(`[${errors.UNMATCHED_BRACKET}] Syntax Error: unexpected bracket token '${open}' at position ${pos}; no matching '${close}' found.`);
  }
}

module.exports = { Token, BracketToken, VariableToken, OperatorToken, TokenString };