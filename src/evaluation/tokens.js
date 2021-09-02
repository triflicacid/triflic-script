const { peek, str, createTokenStringParseObj, isWhitespace } = require("../utils");
const { bracketValues, bracketMap, parseNumber, parseOperator, parseSymbol } = require("./parse");
const { StringValue, ArrayValue, NumberValue, FunctionRefValue, Value, SetValue } = require("./values");
const { isNumericType } = require("./types");
const operators = require("./operators");
const { errors } = require("../errors");
const { IfStructure, Structure, WhileStructure, DoWhileStructure } = require("./structures");

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

/** Token representing a keyword */
class KeywordToken extends Token {
  constructor(tstring, value, pos) {
    super(tstring, value, pos);
  }
}

KeywordToken.keywords = ["if", "else", "do", "while"];

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
    return this.isDeclaration ? `<symbol ${this.value}>` : str(this.getVar().value.type());
  }
  castTo(type) {
    if (this.isDeclaration) throw new Error(`Attempting to cast variable '${this.value}' where isDeclaration=${this.isDeclaration} to type ${type} - will fail, as variable does not exist`);
    let v = this.getVar();
    if (v.value === this) throw new Error(`Self-referencing variable (infinite lookup prevented) - variable '${this.value}'`);
    return v.castTo(type);
  }
  toPrimitive(type) {
    return this.tstr.rs.var(this.value).toPrimitive(type);
  }
  exists() {
    return this.tstr.rs.var(this.value) !== undefined;
  }
  getVar() {
    const v = this.tstr.rs.var(this.value);
    if (v === undefined) this._throwNameError();
    return v;
  }
  toString() {
    return this.isDeclaration ? this.value : str(this.getVar()?.value);
  }

  /** Throw Name Error */
  _throwNameError() {
    throw new Error(`[${errors.NAME}] Name Error: name '${this.value}' does not exist (position ${this.pos})`);
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

/** A bracketed TokenString */
class BracketedTokenString extends Token {
  constructor(tstring, tokenString, openingBracket, pos) {
    super(tstring, tokenString, pos);
    this.opening = openingBracket;
  }

  toString() { return this.opening + this.value.toString() + bracketMap[this.opening]; }
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

  /** Returns array of TokenStrings */
  splitByCommas() {
    let items = [], metItem = false, ts = new TokenString(this.rs);
    for (let i = 0; i < this.tokens.length; i++) {
      if (this.tokens[i] instanceof OperatorToken && this.tokens[i].value === ',') {
        if (!metItem) throw new Error(`[${errors.SYNTAX}]: expected expression, got , at position ${this.tokens[i].pos}`);
        metItem = false;
        items.push(ts);
        ts = new TokenString(this.rs);
      } else {
        ts.tokens.push(this.tokens[i]);
        metItem = true;
      }
    }
    if (ts) items.push(ts);
    return items;
  }

  /** Parse self's string. Return end position. */
  parse() {
    const obj = createTokenStringParseObj(this.string, 0, 0);
    this._parse(obj);
    this.tokens = obj.tokens;
    this.comment = obj.comment;
    this.string = this.string.substring(0, obj.pos);
    return obj.pos;
  }

  /** Parse a raw input string. Populate tokens array. */
  _parse(obj) {
    let string = obj.string, inString = false, strPos, str = '',
      currentKeyword; // currentKeyword - KeywordToken of latest keyword we are in
    const addToTokenStringPositions = []; // Array of positions which should be added to TokenStringArray objects

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

      if (obj.depth === 0 && (string[i] === '\n' || string[i] === ';')) { // Break; from execution
        i++;
        obj.pos++;
        break;
      }

      if (isWhitespace(string[i])) { // WHITESPACE - IGNORE
        i++;
        obj.pos++;
        continue;
      }

      // Comment? (only recognise in depth=0)
      if (obj.depth === 0 && string[i] === '#') {
        let comment = '';
        for (; i < string.length; i++, obj.pos++) {
          if (string[i] === '\n') break;
          comment += string[i];
        }
        obj.comment = comment;
        continue;
      }

      // Bracket Group?
      if (string[i] in bracketValues) {
        if (bracketValues[string[i]] === -1) { // Should never come across a closing bracket
          this._throwMatchingBracketError(string[i], bracketMap[string[i]], obj.pos);
          // } else if (string[i] === '(') {
          //   const opening = new BracketToken(this, '(', obj.pos);
          //   i++;
          //   obj.pos++;

          //   // Normal bracket group (evaluate normally) or evaluate as calling group
          //   const topmost = peek(obj.tokens);
          //   if (expectingGroup || !topmost || topmost instanceof OperatorToken) {
          //     if (i >= string.length) this._throwMatchingBracketError(opening.value, bracketMap[opening.value], obj.pos);
          //     const pobj = createTokenStringParseObj(string.substr(i), obj.pos, obj.depth + 1, [')']);
          //     this._parse(pobj);

          //     let d = pobj.pos - opening.pos;
          //     i += d;
          //     obj.pos += d;

          //     // Push tokens as array or as new TokenString
          //     if (expectingGroup) {
          //       const group = new TokenString(this.rs);
          //       group.string = string.substring(opening.pos + 1, pobj.pos);
          //       obj.tokens.push(group);
          //     } else {
          //       const closing = new BracketToken(this, ')', obj.pos);
          //       opening.matching = closing;
          //       opening.matching = opening;

          //       obj.tokens.push(opening, ...pobj.tokens, closing);
          //     }
          //   } else {
          //     // throw new Error(`Syntax Error: ) must follow an operator`);
          //     const argTokens = [];
          //     const [done, endPos] = this._parseCommaSeperated(argTokens, string.substr(i), obj.pos, obj.depth + 1, bracketMap[opening.value]);
          //     if (!done) this._throwMatchingBracketError(opening.value, bracketMap[opening.value], obj.pos);

          //     const argStr = string.substr(i, (endPos - obj.pos) - 1);
          //     obj.pos = endPos;
          //     i += argStr.length + 1;
          //     const array = new TokenStringArray(this, argTokens, opening.pos);
          //     obj.tokens.push(array);
          //   }
          //   continue;
          // } else if (string[i] === '[' || string[i] === '{') {
          //   const opening = new BracketToken(this.rs, string[i], obj.pos);
          //   i++;
          //   obj.pos++;

          //   if (opening.value === '{' && expectingBlock) {
          //     const pobj = createTokenStringParseObj(string.substr(i), obj.pos, obj.depth + 1, ['}']);
          //     this._parse(pobj);

          //     // Check that everything was matched
          //     if (pobj.terminateOn !== '}') throw new Error(`[${errors.SYNTAX}] Syntax Error: expected } following code block`);

          //     const block = new TokenString(this.rs);
          //     block.tokens = pobj.tokens;
          //     obj.tokens.push(block);

          //     const source = string.substr(i, pobj.pos - obj.pos); // Extract block text
          //     block.string = source;
          //     obj.pos += source.length + 1;
          //     i += source.length + 1;

          //     expectingBlock = false;
          //   } else {
          //     const itemTokens = [];
          //     const [done, endPos] = this._parseCommaSeperated(itemTokens, string.substr(i), obj.pos, obj.depth, bracketMap[opening.value]);
          //     if (!done) throw new Error(`[${errors.SYNTAX}] Syntax Error: expected '${bracketMap[opening.value]}' after collection declaration following '${opening.value}'(position ${opening.pos})`);

          //     const argStr = string.substr(i, (endPos - obj.pos) - 1);
          //     obj.pos += argStr.length + 1;
          //     i += argStr.length + 1;

          //     const Klass = opening.value === '{' ? SetValue : ArrayValue;
          //     let value = new Klass(this.rs, itemTokens.map(ts => ts.eval()));
          //     let valuet = new ValueToken(this, value, obj.pos);
          //     obj.tokens.push(valuet);
          //   }

          //   continue;
        } else {
          const opening = string[i];
          const closing = bracketMap[opening];
          const pobj = createTokenStringParseObj(string.substr(i + 1), obj.pos + 1, obj.depth + 1, [closing]);
          this._parse(pobj);

          // Check that everything was matched
          if (pobj.terminateOn !== closing) throw this._throwMatchingBracketError(opening, closing, obj.pos);
          const contents = new TokenString(this.rs);
          contents.tokens = pobj.tokens;
          const group = new BracketedTokenString(this, contents, opening, obj.pos);
          obj.tokens.push(group);

          const source = string.substr(i, (pobj.pos - obj.pos) + 1); // Extract block text
          contents.string = source;
          obj.pos += source.length;
          i += source.length;
          continue;
        }
      }

      // Operator?
      let op = parseOperator(string.substr(i));
      if (op !== null) {
        const t = new OperatorToken(this, op, obj.pos);

        if ((op === '=' || op === ':=') && peek(obj.tokens, 1) instanceof TokenStringArray && peek(obj.tokens, 2) instanceof VariableToken) {
          addToTokenStringPositions.push(obj.pos);
          peek(obj.tokens, 2).isDeclaration = op === ':=' ? 2 : 1; // Set declaration type
        }

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
        let t;
        if (KeywordToken.keywords.includes(symbol)) { // Keyword?
          t = new KeywordToken(this, symbol, obj.pos);
          currentKeyword = t;
        } else {
          t = new VariableToken(this, symbol, obj.pos);
        }

        obj.tokens.push(t);

        i += symbol.length;
        obj.pos += symbol.length;
        continue;
      }

      throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected token '${string[i]}' (${string[i].charCodeAt(0)}) at position ${obj.pos} `);
    }
    if (inString) throw new Error(`[${errors.UNTERM_STRING}] Syntax Error: unterminated string literal at position ${strPos} `);

    if (addToTokenStringPositions.length !== 0) {
      let tkstr = new TokenString(this.rs);
      while (addToTokenStringPositions.length > 0) {
        if (peek(addToTokenStringPositions) >= peek(obj.tokens).pos) {
          addToTokenStringPositions.pop();
          let old = tkstr;
          tkstr = new TokenString(this.rs);
          if (old.tokens.length > 0) tkstr.tokens.push(old);
        } else {
          let t = obj.tokens.pop();
          tkstr.tokens.unshift(t);
        }
      }
      obj.tokens.push(new TokenStringArray(this, tkstr.tokens, tkstr.tokens[0]?.pos ?? NaN));
    }

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
    // Before put into RPN...
    for (let i = 0; i < this.tokens.length; i++) {
      if (this.tokens[i] instanceof BracketedTokenString) {
        let ok = true;
        if (this.tokens[i].opening === '[') { // *** ARRAY
          const elements = this.tokens[i].value.splitByCommas();
          const values = elements.map(el => el.eval()); // Evaluate each element
          const arr = new ArrayValue(this.rs, values);
          this.tokens[i] = arr;
        } else if (this.tokens[i].opening === '(') { // *** CALL STRING / EXPRESSION
          // If first item, or after an operator, this is an expression group
          if (i === 0 || this.tokens[i - 1] instanceof OperatorToken) {
            // Replace [BracketedTokenString, ...] with ["(", ...tokens, ")", ...]
            this.tokens.splice(i, 1, new BracketToken(this, '(', this.tokens[i].pos), ...this.tokens[i].value.tokens, new BracketToken(this, ')', peek(this.tokens[i].value.tokens).pos + 1)); // Insert tokens in bracket group into tokens array
            i--;
          } else if (this.tokens[i + 1] instanceof OperatorToken && (this.tokens[i + 1].value === '=' || this.tokens[i + 1].value === ':=')) {
            this.tokens[i].isDeclaration = this.tokens[i + 1].value === ':=' ? 1 : 2;
          }
        } else if (this.tokens[i].opening === '{') { // *** SET OR CODE BLOCK
          if (i === 0 || this.tokens[i - 1] instanceof OperatorToken) { // Set if (1) first token (2) preceeded by operator
            const elements = this.tokens[i].value.splitByCommas();
            const values = elements.map(el => el.eval()); // Evaluate each element
            const arr = new SetValue(this.rs, values);
            this.tokens[i] = arr;
          }
        }

        if (!ok) throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid syntax '${this.tokens[i].opening}' at position ${this.tokens[i].pos}`);
      } else if (this.tokens[i] instanceof KeywordToken) {
        switch (this.tokens[i].value) {
          case "if": {
            if (this.tokens[i + 1] instanceof BracketedTokenString && this.tokens[i + 1].opening === "(") {
              if (this.tokens[i + 2] instanceof BracketedTokenString && this.tokens[i + 2].opening === "{") {
                const structure = new IfStructure(this.tokens[i].pos);
                structure.addBranch(this.tokens[i + 1].value, this.tokens[i + 2].value);
                this.tokens.splice(i, 3); // Remove "if" "(...)" "{...}"

                // Else statement?
                while (this.tokens[i] instanceof KeywordToken && this.tokens[i].value === 'else') {
                  // Else if?
                  if (this.tokens[i + 1] instanceof KeywordToken && this.tokens[i + 1].value === 'if') {
                    if (this.tokens[i + 2] instanceof BracketedTokenString && this.tokens[i + 2].opening === '(') {
                      if (this.tokens[i + 3] instanceof BracketedTokenString && this.tokens[i + 3].opening === '{') {
                        structure.addBranch(this.tokens[i + 2].value, this.tokens[i + 3].value);
                        this.tokens.splice(i, 4); // Remove "else" "if" "(...)" "{...}"
                      } else {
                        throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal ELSE-IF construct: expected condition (...) got ${this.tokens[i + 3] ?? 'end of input'} at ${this.tokens[i].pos}`);
                      }
                    } else {
                      throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal ELSE-IF construct: expected condition (...) got ${this.tokens[i + 2] ?? 'end of input'} at ${this.tokens[i].pos}`);
                    }
                  } else {
                    let block = this.tokens[i + 1];
                    if (block instanceof BracketedTokenString && block.opening === '{') {
                      structure.addElse(block.value);
                      this.tokens.splice(i, 2); // Remove "else" "{...}"
                      break;
                    } else {
                      throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal ELSE construct: expected block {...} got ${this.tokens[i + 1] ?? 'end of input'}`);
                    }
                  }
                }

                this.tokens.splice(i, 0, structure);
              } else {
                throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal IF construct: expected block {...} got ${this.tokens[i + 2] ?? 'end of input'} at ${this.tokens[i].pos}`);
              }
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal IF construct: expected condition (...) got ${this.tokens[i + 1] ?? 'end of input'} at ${this.tokens[i].pos}`);
            }
            break;
          }
          case "do": {
            if (this.tokens[i + 1] instanceof BracketedTokenString && this.tokens[i + 1].opening === '{') {
              this.tokens.splice(i, 1); // Remove "do"
            }
            break;
          }
          case "while": {
            if (this.tokens[i - 1] instanceof BracketedTokenString && this.tokens[i - 1].opening === '{' && this.tokens[i + 1] instanceof BracketedTokenString && this.tokens[i + 1].opening === '(') {
              // DO-WHILE
              const structure = new DoWhileStructure(this.tokens[i].pos, this.tokens[i + 1].value, this.tokens[i - 1].value);
              this.tokens.splice(i - 1, 3, structure); // Remove "{...}" "while" "(...)", insert strfucture
            }

            else if (this.tokens[i + 1] instanceof BracketedTokenString && this.tokens[i + 1].opening === '(' && this.tokens[i + 2] instanceof BracketedTokenString && this.tokens[i + 2].opening === '{') {
              // WHILE
              const structure = new WhileStructure(this.tokens[i].pos, this.tokens[i + 1].value, this.tokens[i + 2].value)
              this.tokens.splice(i, 3, structure); // Remove "while" "(...)" "{...}" and insert structure
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal WHILE construct at position ${this.tokens[i].pos}`);
            }

            break;
          }
        }
      }
    }

    // Remove ValueTokens
    for (let i = 0; i < this.tokens.length; i++) {
      if (this.tokens[i] instanceof ValueToken) this.tokens[i] = this.tokens[i].value;
    }

    // Evaluate in postfix notation
    const T = this.toRPN(), stack = [];
    for (let i = 0; i < T.length; i++) {
      if (T[i] instanceof Value) {
        stack.push(T[i]);
      } else if (T[i] instanceof VariableToken) {
        // if (!T[i].isDeclaration && !T[i].exists()) T[i]._throwNameError();
        stack.push(T[i]);
      } else if (T[i] instanceof OperatorToken) {
        const info = T[i].info();
        let argCount;
        if (Array.isArray(info.args)) {
          for (let j = 0; j < info.args.length; j++) {
            if (info.args[j] <= stack.length) {
              argCount = info.args[j];
              break;
            }
          }
        } else {
          argCount = info.args;
        }
        if (stack.length < argCount) throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected operator '${T[i]}' at position ${T[i].pos} - stack underflow (expects ${argCount} values, got ${stack.length}) (while evaluating)`);
        if (argCount === undefined) throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected operator '${T[i]}' at position ${T[i].pos} - no overload found for <= ${stack.length} parameters (while evaluating)`);
        let args = [];
        for (let j = 0; j < argCount; j++) args.unshift(stack.pop()); // if stack is [a, b] pass in fn(a, b)
        const val = T[i].eval(...args);
        stack.push(val);
      } else if (T[i] instanceof BracketedTokenString && T[i].opening === '(') {
        const last = stack.pop(); // Should be VariableToken
        if (T[i].isDeclaration) { // Declare function
          throw new Error(`[${errors.SYNTAX}] Syntax error - invalid assignment (fn)`);
          const variable = last; // Function name (VariableToken)
          const params = T[i].value.splitByCommas(); // Parameters to function (array of tokens)
          const body = T[++i]; // Body of function (TokenStringArray)
          const assign = T[++i]; // Assignment operator (OperatorToken)

          if (!(variable instanceof VariableToken)) throw new Error(`[${errors.SYNTAX}] Syntax Error: Invalid syntax. [1]`);
          if (!(body instanceof TokenStringArray && body.value.length === 1)) throw new Error(`[${errors.SYNTAX}] Syntax Error: Invalid syntax. [2] `);
          if (!(assign instanceof OperatorToken && (assign.value === '=' || assign.value === ':='))) throw new Error(`[${errors.SYNTAX}] Syntax Error: Invalid syntax. [3]`);

          const ref = new FunctionRefValue(this.rs, variable.value), sparams = [];
          for (const ts of params.value) {
            if (ts.tokens.length !== 1 || !(ts.tokens[0] instanceof VariableToken)) throw new Error(`[${errors.SYNTAX}] Syntax Error: Illegal function declaration`);
            params.push(ts.tokens[0]);
          }

          ref.defineFunction(params, body.value[0], assign.pos, variable.isDeclaration === 2, this.comment);
          stack.push(ref);
        } else { // Attempt to call last thing
          const lastValue = last.castTo("any");
          if (typeof lastValue?.__call__ !== 'function') throw new Error(`[${errors.NOT_CALLABLE}] Type Error: type ${lastValue.type()} is not callable (position ${T[i].pos})`);
          let args = [];
          try {
            args = T[i].value.splitByCommas().map(t => t.eval()); // Evaluate TokenString arguments
            stack.push(lastValue.__call__(args));
          } catch (e) {
            throw new Error(`${last}:\n${e}`);
          }
        }
      } else if (T[i] instanceof BracketedTokenString && T[i].opening === '{') {
        stack.push(T[i].value.eval()); // Code block
      } else if (T[i] instanceof Structure) {
        T[i].eval(); // Execute structure body 
      } else if (T[i] instanceof KeywordToken) {
        throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid syntax '${T[i].value}' at position ${this.tokens[i].pos}`);
      } else {
        let str, pos;
        if (T[i] instanceof BracketedTokenString) {
          str = T[i].opening;
        }
        throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid syntax at position ${pos ?? T[i].pos}: ${str ?? T[i].toString()} `);
      }
    }
    if (stack.length === 0) return new NumberValue(this.rs, 0);
    if (stack.length !== 1) throw new Error(`[${errors.SYNTAX}] Syntax Error: Invalid syntax ${stack[0].pos === undefined ? '' : ` at position ${stack[0].pos}`}\n (evaluation failed to reduce expression to single number)`);
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
      if (tokens[i] instanceof ValueToken || tokens[i] instanceof Value || tokens[i] instanceof VariableToken || tokens[i] instanceof TokenString || tokens[i] instanceof TokenStringArray || tokens[i] instanceof BracketedTokenString || tokens[i] instanceof KeywordToken || tokens[i] instanceof Structure) {
        output.push(tokens[i]);
      } else if (tokens[i].is?.(BracketToken, '(')) {
        stack.push(tokens[i]);
      } else if (tokens[i].is?.(BracketToken, ')')) {
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

module.exports = { Token, BracketToken, VariableToken, OperatorToken, TokenString, BracketedTokenString };