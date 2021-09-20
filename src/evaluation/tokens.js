const { peek, str, createTokenStringParseObj, isWhitespace, throwMatchingBracketError, expectedSyntaxError } = require("../utils");
const { bracketValues, bracketMap, parseNumber, parseOperator, parseSymbol } = require("./parse");
const { StringValue, ArrayValue, NumberValue, FunctionRefValue, Value, SetValue, UndefinedValue, MapValue, CharValue } = require("./values");
const operators = require("./operators");
const { errors } = require("../errors");
const { IfStructure, Structure, WhileStructure, DoWhileStructure, ForStructure, DoUntilStructure, UntilStructure, FuncStructure, ArrayStructure, SetStructure, MapStructure, ForInStructure, LoopStructure, BreakStructure, ContinueStructure, ReturnStructure } = require("./structures");
const { Block } = require("./block");
const { isNumericType } = require("./types");

class Token {
  constructor(tstring, v, pos = NaN) {
    this.tstr = tstring;
    this.block = this.tstr.block;
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

KeywordToken.keywords = ["if", "else", "do", "while", "until", "for", "loop", "break", "continue", "func", "return", "then", "goto"];

/** For operators e.g. '+' */
class OperatorToken extends Token {
  constructor(tstring, op, pos) {
    super(tstring, op, pos);
    if (operators[op] === undefined) throw new Error(`new OperatorToken() : '${op}' is not an operator`);
    this.isUnary = false;
    this.data = undefined; // Extra data to pass to operator
  }

  /** Eval as operators */
  async eval(args, evalObj) {
    const info = this.info();
    let fn = info.fn;
    if (typeof fn !== 'function') throw new Error(`[${errors.ARG_COUNT}] Argument Error: no overload for operator function ${this.toString().trim()} with ${args.length} args`);
    let r;
    try { r = await fn(...args, this.data, evalObj); } catch (e) { throw new Error(`[${errors.BAD_ARG}] Operator '${this.toString().trim()}' with { ${args.map(a => a.type()).join(', ')} } at position ${this.pos}:\n${e}`); }
    if (r instanceof Error) throw r; // May return custom errors
    if (r === undefined) throw new Error(`[${errors.TYPE_ERROR}] Type Error: Operator ${this.toString().trim()} does not support arguments { ${args.map(a => a.type()).join(', ')} } at position ${this.pos}`);
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
    if (this.value === '<cast>') return '<' + this.data + '>';
    return this.isUnary ? operators[this.value].unary : this.value;
  }
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

/** Token for EOL */
class EOLToken extends Token {
  constructor(tline, pos) {
    super(tline, EOLToken.symbol, pos);
  }

  toString() { return EOLToken.symbol; }
}

EOLToken.symbol = ';';

/** For symbols e.g. 'hello' */
class VariableToken extends Token {
  constructor(tstring, vname, pos) {
    super(tstring, vname, pos);
  }
  type() {
    return str(this.getVar().value.type());
  }
  castTo(type) {
    let v = this.getVar();
    if (v.value === this) throw new Error(`Self-referencing variable (infinite lookup prevented) - variable '${this.value}'`);
    return v.castTo(type);
  }
  toPrimitive(type) {
    return this.tstr.rs.getVar(this.value).toPrimitive(type);
  }
  exists() {
    return this.tstr.rs.getVar(this.value) !== undefined;
  }
  getVar() {
    const v = this.tstr.rs.getVar(this.value);
    if (v === undefined) this._throwNameError();
    return v;
  }
  toString() {
    return str(this.getVar()?.value);
  }

  /** Throw Name Error */
  _throwNameError() {
    throw new Error(`[${errors.NAME}] Name Error: name '${this.value}' does not exist (position ${this.pos})`);
  }

  /** function: del() */
  __del__() {
    const v = this.getVar();
    if (v.constant) throw new Error(`[${errors.DEL}] Argument Error: Attempt to delete a constant variable ${this.value}`);
    this.tstr.rs.deleteVar(this.value);
    return new NumberValue(this.tstr.rs, 0);
  }

  /** operator: = */
  __assign__(value) {
    const name = this.value;
    let varObj = this.exists() ? this.tstr.rs.setVar(name, value) : this.tstr.rs.defineVar(name, value);
    return value;
  }

  /** operator: += */
  __assignAdd__(value) {
    value = this.castTo("any").__add__(value);
    if (value === undefined) return undefined;
    this.tstr.rs.setVar(this.value, value);
    return value;
  }

  /** operator: -= */
  __assignSub__(value) {
    value = this.castTo("any").__sub__(value);
    if (value === undefined) return undefined;
    this.tstr.rs.setVar(this.value, value);
    return value;
  }

  /** operator: *= */
  __assignMul__(value) {
    value = this.castTo("any").__mul__(value);
    if (value === undefined) return undefined;
    this.tstr.rs.setVar(this.value, value);
    return value;
  }

  /** operator: /= */
  __assignDiv__(value) {
    value = this.castTo("any").__div__(value);
    if (value === undefined) return undefined;
    this.tstr.rs.setVar(this.value, value);
    return value;
  }

  /** operator: %= */
  __assignMod__(value) {
    value = this.castTo("any").__mod__(value);
    if (value === undefined) return undefined;
    this.tstr.rs.setVar(this.value, value);
    return value;
  }
}

/** A bracketed TokenLine[] */
class BracketedTokenLines extends Token {
  constructor(tstring, tokenLines, openingBracket, pos) {
    super(tstring, tokenLines, pos);
    this.opening = openingBracket;
  }

  prepare(doRPN = true) {
    this.value.forEach(line => {
      if (line.block !== undefined && line.block === null) line.block = this.tstr.block;
      line.prepare(doRPN);
    });
  }

  async eval(evalObj) {
    let lastVal;
    for (let line of this.value) {
      lastVal = await line.eval(evalObj);
    }
    return lastVal ?? new UndefinedValue(this.tstr.rs);
  }

  toString() { return this.opening + this.value.toString() + bracketMap[this.opening]; }

  toBlock(opts = []) {
    if (!this.tstr.block) throw new Error(`BracketedTokenLines.toBlock :: this.tstr is not bound to a scope`);
    return new Block(this.tstr.rs, this.value, this.pos, this.tstr.block, opts);
  }
}

/** Represents a program line - holds array of tokens */
class TokenLine {
  constructor(runspace, block, tokens = [], source = '') {
    this.rs = runspace;
    this.block = block;
    this.source = source;
    this.tokens = undefined; // Array of token objects
    this.comment = '';
    this._ready = false;
    this.updateTokens(tokens);
  }

  /** Update token array and process them so they're ready for exection. */
  updateTokens(tokens) {
    this._ready = false;
    this.tokens = [...tokens];
  }

  /** Prepare line for execution. Arg - also transform to RPN? */
  prepare(doRPN = true) {
    if (this._ready) return;
    this._ready = true;
    this.tokens.forEach(t => (t.block = this.block)); // Set block for each token
    this.parse(); // Parse
    if (doRPN) this.tokens = this.toRPN();
  }

  /** Returns array of TokenStrings */
  splitByCommas(prepareThem = true, prepareDoRPN = true) {
    let items = [], metItem = false, ts = new TokenLine(this.rs, this.block), tsTokens = [];
    for (let i = 0; i < this.tokens.length; i++) {
      if (this.tokens[i] instanceof OperatorToken && this.tokens[i].value === ',') {
        if (!metItem) throw new Error(`[${errors.SYNTAX}]: expected expression, got , at position ${this.tokens[i].pos}`);
        metItem = false;
        ts.updateTokens(tsTokens);
        items.push(ts);
        ts = new TokenLine(this.rs, this.block);
        tsTokens = [];
      } else {
        tsTokens.push(this.tokens[i]);
        metItem = true;
      }
    }
    if (ts && tsTokens !== 0) {
      ts.updateTokens(tsTokens);
      items.push(ts);
    }
    if (prepareThem) items.forEach(item => item.prepare(prepareDoRPN));
    return items;
  }

  parse() {
    return this._parse();
    try {
      return this._parse();
    } catch (e) {
      throw new Error(`${this.source}: \n${e} `);
    }
  }

  /** Extra parsing - assemble tokens into structure */
  _parse() {
    // Before put into RPN...
    for (let i = 0; i < this.tokens.length; i++) {
      if (this.tokens[i] instanceof ValueToken) {
        this.tokens[i] = this.tokens[i].value; // Remove all ValueToken objects
      } else if (this.tokens[i] instanceof BracketedTokenLines) {
        let ok = true;
        if (this.tokens[i].opening === '[') { // *** ARRAY
          let elements;
          if (this.tokens[i].value.length === 0) elements = [];
          else if (this.tokens[i].value.length === 1) elements = this.tokens[i].value[0].splitByCommas();
          else throw new expectedSyntaxError(']', peek(this.tokens[i].value[0].tokens));

          let structure = new ArrayStructure(this.rs, elements, this.tokens[i].pos);
          structure.validate();
          this.tokens[i] = structure;
        } else if (this.tokens[i].opening === '(') { // *** CALL STRING / EXPRESSION
          // If first item, or after an operator, this is an expression group
          if (i === 0 || (this.tokens[i - 1] instanceof OperatorToken && this.tokens[i - 1].value !== '()') || this.tokens[i - 1] instanceof BracketToken) {
            if (this.tokens[i].value.length == 0) {
              this.tokens.splice(i, 1); // Simply ignore as empty
            } else {
              // Replace [BracketedTokenString, ...] with ["(", ...tokens, ")", ...]
              if (this.tokens[i].value.length > 1) throw new expectedSyntaxError(')', this.tokens[i].value[0].tokens[0]);
              this.tokens.splice(i, 1, new BracketToken(this, '(', this.tokens[i].pos), ...this.tokens[i].value[0].tokens, new BracketToken(this, ')', peek(this.tokens[i].value[0].tokens).pos + 1)); // Insert tokens in bracket group into tokens array
              // variable i is not pointing at '('
            }
          }
        } else if (this.tokens[i].opening === '{') { // *** SET OR MAP OR CODE BLOCK
          if (i === 0 || this.tokens[i - 1] instanceof OperatorToken) { // Set/Map if (1) first token (2) preceeded by operator
            let elements;
            if (this.tokens[i].value.length === 0) elements = [];
            else if (this.tokens[i].value.length === 1) elements = this.tokens[i].value[0].splitByCommas(false);
            else throw new expectedSyntaxError('}', peek(this.tokens[i].value[0].tokens));

            let structure;
            // MAP if first item is in syntax "a : ..."
            if (elements.length > 0 && elements[0].tokens.length > 0 && elements[0].tokens[1] instanceof OperatorToken && elements[0].tokens[1].value === ':') {
              structure = new MapStructure(this.rs, this.tokens[i].pos);

              for (const pair of elements) {
                if (pair.tokens[1] instanceof OperatorToken && pair.tokens[1].value === ':') {
                  structure.addPair(pair.tokens[0], new TokenLine(this.rs, this.block, pair.tokens.slice(2)));
                } else {
                  throw new Error(`[${errors.SYNTAX}]: Syntax Error: expected ':' but got ${pair.tokens[1] ?? '}'}${pair.tokens[1]?.pos ? ` at position ${pair.tokens[1].pos}` : ''}\n(interpreting {...} as a map as '<x> : ...' was found in first element. If you meant the operator ':', encase the first element in parenthesis)`);
                }
              }
            } else {
              elements.forEach(e => e.prepare());
              structure = new SetStructure(this.rs, elements, this.tokens[i].pos);
            }
            structure.validate();
            this.tokens[i] = structure;
          } else {
            if (this.block == undefined) throw new Error(`[${errors.SYNTAX}]: Syntax Error: invalid syntax '{' at position ${this.tokens[i].pos} (no enclosing block found)`);
            this.tokens[i] = this.block.createChild(this.tokens[i].value, this.tokens[i].pos);
          }
        }

        if (!ok) throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid syntax '${this.tokens[i].opening}' at position ${this.tokens[i].pos}`);
      } else if (this.tokens[i] instanceof OperatorToken && this.tokens[i].value === '<' && (this.tokens[i + 1] instanceof VariableToken || this.tokens[i + 1] instanceof KeywordToken) && this.tokens[i + 2] instanceof OperatorToken && this.tokens[i + 2].value === '>') {
        // Cast?
        let op = new OperatorToken(this, "<cast>", this.tokens[i].pos);
        op.data = this.tokens[i + 1].value;
        this.tokens.splice(i, 3, op); // Remove "<" "type" ">"
      }
    }

    // Second scan
    for (let i = 0; i < this.tokens.length; i++) {
      if (this.tokens[i] instanceof KeywordToken) {
        switch (this.tokens[i].value) {
          case "if": {
            if (this.tokens[i + 1] instanceof BracketedTokenLines && this.tokens[i + 1].opening === "(") {
              if (this.tokens[i + 2] instanceof Block) {
                const structure = new IfStructure(this.tokens[i].pos);

                structure.addBranch(this.tokens[i + 1], this.tokens[i + 2]);
                this.tokens.splice(i, 3); // Remove "if" "(...)" "{...}"

                // Else statement?
                while (this.tokens[i] instanceof KeywordToken && this.tokens[i].value === 'else') {
                  // Else if?
                  if (this.tokens[i + 1] instanceof KeywordToken && this.tokens[i + 1].value === 'if') {
                    if (this.tokens[i + 2] instanceof BracketedTokenLines && this.tokens[i + 2].opening === '(') {
                      if (this.tokens[i + 3] instanceof Block) {
                        structure.addBranch(this.tokens[i + 2], this.tokens[i + 3]);
                        this.tokens.splice(i, 4); // Remove "else" "if" "(...)" "{...}"
                      } else {
                        throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal ELSE-IF construct: expected condition (...) got ${this.tokens[i + 3] ?? 'end of input'} at ${this.tokens[i].pos}`);
                      }
                    } else {
                      throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal ELSE-IF construct: expected condition (...) got ${this.tokens[i + 2] ?? 'end of input'} at ${this.tokens[i].pos}`);
                    }
                  } else {
                    let block = this.tokens[i + 1];
                    if (block instanceof Block) {
                      structure.addElse(block);
                      this.tokens.splice(i, 2); // Remove "else" "{...}"
                      break;
                    } else {
                      throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal ELSE construct: expected block {...} got ${this.tokens[i + 1] ?? 'end of input'}`);
                    }
                  }
                }

                structure.validate();
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
            if (this.tokens[i + 1] instanceof Block) {
              this.tokens[i + 1].breakable = 1;
              this.tokens[i + 1].prepare();
              this.tokens.splice(i, 1); // Remove "do"
            }
            break;
          }
          case "while": {
            let structure;
            if (this.tokens[i - 1] instanceof Block && this.tokens[i + 1] instanceof BracketedTokenLines && this.tokens[i + 1].opening === '(') {
              // ! DO-WHILE
              let removeCount = 3;
              structure = new DoWhileStructure(this.tokens[i].pos, this.tokens[i + 1], this.tokens[i - 1]);

              if (this.tokens[i + 2] instanceof KeywordToken && this.tokens[i + 2].value === 'then') {
                if (this.tokens[i + 3] instanceof Block) {
                  structure.thenBlock = this.tokens[i + 3];
                  removeCount += 2;
                } else {
                  throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal WHILE construct at position ${this.tokens[i].pos}: expected block after 'else' at position ${this.tokens[i + 2].pos}`);
                }
              }
              this.tokens.splice(i - 1, removeCount, structure); // Remove "{...}" "while" "(...)", insert strfucture
            }

            else if (this.tokens[i + 1] instanceof BracketedTokenLines && this.tokens[i + 1].opening === '(' && this.tokens[i + 2] instanceof Block) {
              // ! WHILE
              let removeCount = 3;
              structure = new WhileStructure(this.tokens[i].pos, this.tokens[i + 1], this.tokens[i + 2]);
              if (this.tokens[i + 3] instanceof KeywordToken && this.tokens[i + 3].value === 'then') {
                if (this.tokens[i + 4] instanceof Block) {
                  structure.thenBlock = this.tokens[i + 4];
                  removeCount += 2;
                } else {
                  throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal WHILE construct at position ${this.tokens[i].pos}: expected block after 'else' at position ${this.tokens[i + 3].pos}`);
                }
              }
              this.tokens.splice(i, removeCount, structure); // Remove "while" "(...)" "{...}" and insert structure
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal WHILE construct at position ${this.tokens[i].pos}`);
            }
            structure.validate();
            break;
          }
          case "until": {
            let structure;
            if (this.tokens[i - 1] instanceof Block && this.tokens[i + 1] instanceof BracketedTokenLines && this.tokens[i + 1].opening === '(') {
              // ! DO-UNTIL
              let removeCount = 3;
              structure = new DoUntilStructure(this.tokens[i].pos, this.tokens[i + 1], this.tokens[i - 1]);

              if (this.tokens[i + 2] instanceof KeywordToken && this.tokens[i + 2].value === 'then') {
                if (this.tokens[i + 3] instanceof Block) {
                  structure.thenBlock = this.tokens[i + 3];
                  removeCount += 2;
                } else {
                  throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal UNTIL construct at position ${this.tokens[i].pos}: expected block after 'else' at position ${this.tokens[i + 2].pos}`);
                }
              }
              this.tokens.splice(i - 1, removeCount, structure); // Remove "{...}" "while" "(...)", insert strfucture
            }

            else if (this.tokens[i + 1] instanceof BracketedTokenLines && this.tokens[i + 1].opening === '(' && this.tokens[i + 2] instanceof Block) {
              // ! UNTIL
              let removeCount = 3;
              structure = new UntilStructure(this.tokens[i].pos, this.tokens[i + 1], this.tokens[i + 2]);

              if (this.tokens[i + 3] instanceof KeywordToken && this.tokens[i + 3].value === 'then') {
                if (this.tokens[i + 4] instanceof Block) {
                  structure.thenBlock = this.tokens[i + 4];
                  removeCount += 2;
                } else {
                  throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal UNTIL construct at position ${this.tokens[i].pos}: expected block after 'else' at position ${this.tokens[i + 3].pos}`);
                }
              }
              this.tokens.splice(i, removeCount, structure); // Remove "while" "(...)" "{...}" and insert structure
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal UNTIL construct at position ${this.tokens[i].pos}`);
            }
            structure.validate();
            break;
          }
          case "for": {
            let structure;
            // ! FOR
            if (this.tokens[i + 1] instanceof BracketedTokenLines && this.tokens[i + 1].opening === '(' && this.tokens[i + 2] instanceof Block) {
              let removeCount = 3;
              // Scan for-in loop
              let btokens = this.tokens[i + 1].value[0].tokens, vars = [], expect = 'VARS', rest, isForIn = false;
              for (let j = 0; j < btokens.length; j++) {
                if (expect === 'VARS' && btokens[j] instanceof VariableToken) {
                  vars.push(btokens[j]);
                  if (btokens[j + 1] instanceof OperatorToken && btokens[j + 1].value === ',') {
                    j++;
                  } else {
                    expect = 'IN';
                  }
                } else if (expect === 'IN' && btokens[j] instanceof OperatorToken && btokens[j].value === 'in ') {
                  j++;
                  rest = new TokenLine(this.rs, this.block, btokens.slice(j));
                  isForIn = true;
                  break;
                } else break;
              }
              if (isForIn) {
                structure = new ForInStructure(this.tokens[i].pos, vars, rest, this.tokens[i + 2]);
              } else {
                // General for loop
                structure = new ForStructure(this.tokens[i].pos, this.tokens[i + 1], this.tokens[i + 2]);
              }

              // Else block?
              if (this.tokens[i + 3] instanceof KeywordToken && this.tokens[i + 3].value === 'then') {
                if (this.tokens[i + 4] instanceof Block) {
                  structure.thenBlock = this.tokens[i + 4];
                  removeCount += 2;
                } else {
                  throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal FOR construct at position ${this.tokens[i].pos}: expected block after 'else' at position ${this.tokens[i + 3].pos}`);
                }
              }

              this.tokens.splice(i, removeCount, structure); // Remove "for" "(...)" "{...}"
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal FOR construct at position ${this.tokens[i].pos}`);
            }
            structure.validate();
            break;
          }
          case "func": {
            let structure = new FuncStructure(this.tokens[i].pos, this.rs, {});

            // Name?
            if (this.tokens[i + 1] instanceof VariableToken) {
              structure.name = this.tokens[i + 1].value;
              this.tokens.splice(i, 1);
            }

            if (this.tokens[i + 1] instanceof BracketedTokenLines && this.tokens[i + 1].opening === '(' && this.tokens[i + 2] instanceof Block) {
              const argLine = this.tokens[i + 1];
              structure.body = this.tokens[i + 2];
              this.tokens.splice(i, 3, structure);

              // Extract argGroup
              // Syntax: "arg[: [ref|val] [?]type [= ...]]"
              let argObj = {}, lastOptional = null; // Last encountered optional argument
              if (argLine.value.length === 1) {
                let args = argLine.value[0].splitByCommas(false); // DO NOT do extra parsing - not required for function arguments
                for (let arg of args) {
                  if (arg.tokens[0] === undefined || !(arg.tokens[0] instanceof VariableToken)) throw new Error(`[${errors.SYNTAX}] Syntax Error: expected parameter name, got ${arg.tokens[0]} at position ${arg.tokens[0]?.pos}`);
                  if (arg.tokens.length === 1) { // "<arg>"
                    argObj[arg.tokens[0].value] = 'any';
                  } else if (arg.tokens.length > 2) { // "<arg>" ":" ...
                    if (arg.tokens[1] instanceof OperatorToken && arg.tokens[1].value === ':') {
                      let i = 2, data = {}, ok = true;
                      if (arg.tokens[i] instanceof VariableToken && (arg.tokens[i + 1] instanceof VariableToken || (arg.tokens[i + 1] instanceof OperatorToken && arg.tokens[i + 1].value === '?'))) {
                        if (arg.tokens[i].value === 'val' || arg.tokens[i].value === 'ref') {
                          data.pass = arg.tokens[i].value;
                          i++;
                        } else ok = false;
                      }
                      if (ok && arg.tokens[i] instanceof OperatorToken) {
                        if (arg.tokens[i].value === '?') {
                          if (data.pass === 'ref') throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected '?': pass-by-reference parameter '${arg.tokens[0].value}' cannot be optional`);
                          data.optional = true;
                          lastOptional = arg.tokens[0].value;
                          i++;
                        } else {
                          ok = false;
                        }
                      }
                      if (ok) {
                        if (arg.tokens[i] instanceof VariableToken) {
                          data.type = arg.tokens[i].value;
                          i++;
                        } else ok = false;
                      }
                      if (ok && arg.tokens[i]) {
                        if (arg.tokens[i] instanceof OperatorToken && arg.tokens[i].value === '=') {
                          i++;
                          if (arg.tokens[i] instanceof Token) {
                            if (data.pass === 'ref') throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected '=': pass-by-reference parameter '${arg.tokens[0].value}' cannot have a default value`);
                            data.optional = true;
                            data.default = arg.tokens[i];
                            if (data.default instanceof ValueToken) data.default = data.default.value;
                            i++;
                          } else ok = false;
                        } else ok = false;
                      }
                      if (ok && arg.tokens[i] !== undefined) ok = false;
                      if (!ok) throw new Error(`[${errors.SYNTAX}] Syntax Error: FUNCTION: invalid syntax in parameter string at position ${arg.tokens[1].pos}`);
                      if (lastOptional && !data.optional) throw new Error(`[${errors.SYNTAX}] Syntax Error: required argument '${arg.tokens[0].value}' cannot precede optional argument '${lastOptional}' (position ${arg.tokens[0].pos})`);
                      argObj[arg.tokens[0].value] = data;
                    } else if (arg.tokens[1] instanceof OperatorToken && arg.tokens[1].value === '=' && arg.tokens[2] instanceof Token) {
                      let data = {
                        optional: true,
                        default: arg.tokens[2]
                      };
                      if (data.default instanceof ValueToken) data.default = data.default.value;
                      argObj[arg.tokens[0].value] = data;
                    }
                  } else {
                    throw new Error(`[${errors.SYNTAX}] Syntax Error: FUNCTION: expected ':' or '=' after parameter name '${arg.tokens[0].value}', got '${arg.tokens[1]}' at position ${arg.tokens[1].pos}`);
                  }
                }
              }
              structure.args = argObj;
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: illegal FUNC construct at position ${structure.pos}`);
            }

            structure.validate();
            break;
          }
          case "loop": {
            if (this.tokens[i + 1] instanceof Block) {
              let structure = new LoopStructure(this.tokens[i].pos, this.tokens[i + 1]);
              structure.validate();
              this.tokens.splice(i, 2, structure); // Remove "loop" "{...}" and add structure
            } else {
              throw new Error(`[${errors.SYNTAX}] LOOP: expected block {...} after keyword 'loop' at position ${this.tokens[i].pos}`);
            }
            break;
          }
          case "break": {
            if (this.block.breakable) {
              let structure = new BreakStructure(this.tokens[i].pos);
              structure.validate();
              this.tokens[i] = structure;
            }
            break;
          }
          case "continue": {
            if (this.block.breakable) {
              let structure = new ContinueStructure(this.tokens[i].pos);
              structure.validate();
              this.tokens[i] = structure;
            }
            break;
          }
          case "return": {
            if (this.block.returnable) {
              let tokenLine = new TokenLine(this.rs, this.block, this.tokens.splice(i + 1) ?? []);
              let structure = new ReturnStructure(this.tokens[i].pos, tokenLine);
              structure.validate();
              this.tokens[i] = structure;
            }
            break;
          }
        }
      } else if (this.tokens[i] instanceof BracketedTokenLines && this.tokens[i].opening === '(') {
        if (this.tokens[i].value.length < 2) { // (call) operator. One or zero value[]
          let op = new OperatorToken(this, '()', this.tokens[i].pos);
          op.data = []; // Data = arguments

          if (this.tokens[i].value.length > 0) {
            op.data = this.tokens[i].value[0].splitByCommas(); // Get arguments
          }

          this.tokens[i] = op;
        }
      }
    }

    return this;
  }

  async eval(evalObj) {
    try {
      return await this._eval(evalObj);
    } catch (e) {
      throw e;
      // throw new Error(`${this.source}: \n${e} `);
    }
  }

  async _eval(evalObj) {
    // Evaluate in postfix notation
    const T = this.tokens, stack = [];
    for (let i = 0; i < T.length; i++) {
      const cT = T[i];
      if (cT instanceof Value || cT instanceof VariableToken) {
        stack.push(cT);
      } else if (cT instanceof OperatorToken) {
        const info = cT.info();
        if (stack.length < info.args) throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected operator '${cT}' at position ${cT.pos} - stack underflow (expects ${info.args} values, got ${stack.length})`);
        const args = stack.splice(stack.length - info.args);
        const val = await cT.eval(args, evalObj);
        stack.push(val);
      } else if (cT instanceof Block) {
        let ret = await cT.eval(evalObj);
        if (ret !== undefined) stack.push(ret);
      } else if (cT instanceof Structure) {
        let ret = await cT.eval(evalObj); // Execute structure body
        if (ret !== undefined) stack.push(ret);
      } else {
        let str, pos;
        if (cT instanceof BracketedTokenLines) {
          str = cT.opening;
        }
        throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid syntax at position ${pos ?? cT.pos}: ${str ?? cT.toString()} `);
      }

      if (evalObj.action !== 0) break;
    }
    while (stack[stack.length - 1] instanceof UndefinedValue) stack.pop(); // Remove all Undefined values from top of stack
    if (stack.length === 0) return new UndefinedValue(this.rs);
    if (stack.length !== 1) {
      let items = stack.map(x => x + (x.pos === undefined ? '' : ` (position ${x.pos})`));
      throw new Error(`[${errors.SYNTAX}] Syntax Error: Invalid syntax ${items.join(', ')}. Did you miss an EOL token ${EOLToken.symbol} (${EOLToken.symbol.charCodeAt(0)}) ?\n(evaluation failed to reduce expression to single value)`);
    }
    return stack[0];
  }

  toString() {
    return this.tokens.map(t => t.toString()).join(' ');
  }

  /** Return array of tokens of this tokenString RPNd */
  toRPN() {
    return this._toRPN(this.tokens, this.rs.opts?.bidmas);
  }

  /** Token array from infix to postfix */
  _toRPN(tokens, bidmas = true) {
    const stack = [], output = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] instanceof Value || tokens[i] instanceof VariableToken || tokens[i] instanceof TokenLine || tokens[i] instanceof BracketedTokenLines || tokens[i] instanceof KeywordToken || tokens[i] instanceof Structure || tokens[i] instanceof Block) {
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
        if (bidmas) {
          if (info.assoc === 'ltr') {
            while (stack.length !== 0 && tokens[i].priority() <= peek(stack).priority()) output.push(stack.pop());
          } else {
            while (stack.length !== 0 && tokens[i].priority() < peek(stack).priority()) output.push(stack.pop());
          }
        } else {
          while (stack.length !== 0) output.push(stack.pop());
        }
        stack.push(tokens[i]);
      } else if (tokens[i] instanceof EOLToken) {
        if (i !== tokens.length - 1) throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected token ${tokens[i]}`);
      } else {
        throw new Error(`[${errors.SYNTAX}] Unknown token: ${typeof tokens[i]} ${tokens[i].constructor.name} `);
      }
    }
    while (stack.length !== 0) output.push(stack.pop()); // Dump the stack
    return output;
  }
}

/** Parse source code into tokens */
function tokenify(rs, source, singleStatement = false) {
  const obj = createTokenStringParseObj(rs, source, 0, 0);
  obj.allowMultiline = !singleStatement;
  _tokenify(obj);
  return obj.lines;
}

function _tokenify(obj) {
  let string = obj.string, inString = false, strPos, str = '', lastSourceIndex = 0;
  let currentLine = new TokenLine(obj.rs, null), currentTokens = []; // Tokens for the current line
  const addToTokenStringPositions = []; // Array of positions which should be added to TokenStringArray objects

  for (let i = 0; i < string.length;) {
    // Start/End string?
    if (string[i] === '"') {
      if (inString) {
        const t = new ValueToken(obj.rs, new StringValue(obj.rs, str), obj.pos);
        currentTokens.push(t);
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
      if (string[i] === '\\' && string[i + 1]) {
        str += string[i + 1];
        i += 2;
        obj.pos += 2;
      } else {
        str += string[i];
        i++;
        obj.pos++;
      }
      continue;
    }

    // Char literal?
    if (string[i] === '\'') {
      let seq = '';
      for (let j = i + 1; ; j++) {
        if (string[j] === '\'') break;
        if (string[j] === '\\') j++;
        if (string[j] === undefined) throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected end of input in char literal (position ${j})`);
        seq += string[j];
      }
      if (seq.length > 1) throw new Error(`[${errors.SYNTAX}] Syntax Error: multi-character string literal. Did you mean to use double quotes: "${seq}" ?`);
      currentTokens.push(new ValueToken(currentLine, new CharValue(obj.rs, seq), i));
      const d = seq.length + 2;
      i += d;
      obj.pos += d;
      continue;
    }

    // Break??
    if (obj.terminateOn.includes(string[i])) {
      obj.terminateOn = string[i];
      break;
    }

    if (obj.allowMultiline && string[i] === EOLToken.symbol) { // End Of Line
      currentTokens.push(new EOLToken(currentLine, obj.pos));
      i++;
      obj.pos++;
      currentLine.updateTokens(currentTokens);
      currentLine.source = string.substr(lastSourceIndex, i).trim();
      obj.lines.push(currentLine);
      lastSourceIndex = i;
      currentTokens = []; // Reset token array - start a new line
      currentLine = new TokenLine(obj.rs, null);
      continue;
    }

    if (isWhitespace(string[i])) { // WHITESPACE - IGNORE
      i++;
      obj.pos++;
      continue;
    }

    // Comment? (only recognise in depth=0)
    if (string[i] === '#') {
      let comment = '';
      for (; i < string.length; i++, obj.pos++) {
        if (string[i] === '\n') break;
        comment += string[i];
      }
      currentLine.comment = comment;
      continue;
    }

    // Bracket Group?
    if (string[i] in bracketValues) {
      if (bracketValues[string[i]] === -1) { // Should never come across a closing bracket
        throwMatchingBracketError(string[i], bracketMap[string[i]], obj.pos);
      } else {
        const opening = string[i];
        const closing = bracketMap[opening];
        const pobj = createTokenStringParseObj(obj.rs, string.substr(i + 1), obj.pos + 1, obj.depth + 1, [closing], true);
        _tokenify(pobj);

        // Check that everything was matched
        if (pobj.terminateOn !== closing) throw throwMatchingBracketError(opening, closing, obj.pos);
        const contents = pobj.lines;
        const group = new BracketedTokenLines(currentLine, contents, opening, obj.pos);
        currentTokens.push(group);

        const source = string.substr(i, (pobj.pos - obj.pos) + 1); // Extract block text
        obj.pos += source.length;
        i += source.length;
        continue;
      }
    }

    // Operator?
    let op = parseOperator(string.substr(i));
    if (op !== null) {
      const t = new OperatorToken(currentLine, op, obj.pos);

      // Is unary: first, after (, after an operator (first, check that there IS a unary operator available)
      const top = peek(currentTokens);
      if (t.info().unary && (top === undefined || (top instanceof BracketToken && top.facing() === 1) || top instanceof OperatorToken)) {
        t.isUnary = true;
      }

      currentTokens.push(t);
      i += op.length;
      obj.pos += op.length;
      continue;
    }

    // Number?
    let numObj;
    try {
      numObj = parseNumber(string.substr(i));
    } catch (e) {
      throw new Error(`[${errors.SYNTAX}] Syntax Error: ${e.message} (literal at position ${obj.pos})`); // Error whilst parsing number literal
    }
    if (numObj.str.length > 0) {
      const t = new ValueToken(currentLine, new NumberValue(obj.rs, numObj.num), obj.pos);
      currentTokens.push(t);
      i += numObj.pos;
      obj.pos += numObj.pos;
      continue;
    }

    // Variable? (symbol)
    let symbol = parseSymbol(string.substr(i));
    if (symbol !== null) {
      let t;
      if (KeywordToken.keywords.includes(symbol)) { // Keyword?
        t = new KeywordToken(currentLine, symbol, obj.pos);
      } else {
        t = new VariableToken(currentLine, symbol, obj.pos);
      }

      currentTokens.push(t);

      i += symbol.length;
      obj.pos += symbol.length;
      continue;
    }

    throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected token '${string[i]}' (${string[i].charCodeAt(0)}) at position ${obj.pos} `);
  }

  // Still scanning a string?
  if (inString) throw new Error(`[${errors.UNTERM_STRING}] Syntax Error: unterminated string literal at position ${strPos} `);

  // Make sure any remnant tokens are pushes to a new line
  if (currentTokens.length > 0) {
    currentLine.updateTokens(currentTokens);
    currentLine.source = string.substr(lastSourceIndex).trim();
    obj.lines.push(currentLine);
  }

  // if (addToTokenStringPositions.length !== 0) {
  //   let tkstr = new TokenLine(this.rs);
  //   while (addToTokenStringPositions.length > 0) {
  //     if (peek(addToTokenStringPositions) >= peek(currentLine.tokens).pos) {
  //       addToTokenStringPositions.pop();
  //       let old = tkstr;
  //       tkstr = new TokenLine(this.rs);
  //       if (old.tokens.length > 0) tkstr.tokens.push(old);
  //     } else {
  //       let t = currentLine.tokens.pop();
  //       tkstr.tokens.unshift(t);
  //     }
  //   }
  //   currentLine.tokens.push(new TokenStringArray(this, tkstr.tokens, tkstr.tokens[0]?.pos ?? NaN));
  // }

  return;
}

module.exports = { Token, BracketToken, VariableToken, OperatorToken, TokenLine, KeywordToken, BracketedTokenLine: BracketedTokenLines, tokenify };