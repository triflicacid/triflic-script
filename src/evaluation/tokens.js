const { peek, str, createTokenStringParseObj, isWhitespace, throwMatchingBracketError, expectedSyntaxError, decodeEscapeSequence } = require("../utils");
const { bracketValues, bracketMap, parseNumber, parseOperator, parseSymbol } = require("./parse");
const { StringValue, NumberValue, Value, UndefinedValue, CharValue, BoolValue, FunctionRefValue } = require("./values");
const operators = require("./operators");
const { errors, operatorDoesntSupport } = require("../errors");
const { IfStructure, Structure, WhileStructure, DoWhileStructure, ForStructure, DoUntilStructure, UntilStructure, FuncStructure, ArrayStructure, SetStructure, MapStructure, ForInStructure, LoopStructure, BreakStructure, ContinueStructure, ReturnStructure, SwitchStructure, LabelStructure, GotoStructure, LetStructure } = require("./structures");
const { Block } = require("./block");
const Complex = require("../maths/Complex");
const { RunspaceUserFunction } = require("../runspace/Function");

class Token {
  constructor(tstring, v, pos = NaN) {
    this.tstr = tstring;
    this.block = this.tstr.block;
    this.value = v;
    this.pos = pos; // Definition position
  }
  setBlock(block) { this.block = block; }
  castTo(type) { throw new Error(`Overload Required (type provided: ${type})`); }
  is(klass, val = undefined) {
    return (this instanceof klass && (val != undefined && this.value === val));
  }
  toString(evalObj) {
    return this.value.toString(evalObj);
  }
}

/** Token which refers to a Value class. */
class ValueToken extends Token {
  constructor(tstring, value, pos) {
    super(tstring, value, pos);
  }

  castTo(type, evalObj) { return this.value.castTo(type, evalObj); }
}

/** Token representing a keyword */
class KeywordToken extends Token {
  constructor(tstring, value, pos) {
    super(tstring, value, pos);
    this.isValueKeyword = value === "true" || value === "false"; // Does this keyword represent a value
  }
}

KeywordToken.keywords = ["break", "case", "continue", "do", "else", "false", "for", "func", "goto", "if", "label", "let", "loop", "return", "switch", "then", "true", "until", "while"];

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
    try { r = await fn(evalObj, ...args, this.data); } catch (e) { throw new Error(`[${errors.BAD_ARG}] Operator '${this.toString().trim()}' with { ${args.map(a => a.type()).join(', ')} } at position ${this.pos}:\n${e}`); }
    if (r instanceof Error) throw r; // May return custom errors
    if (r === undefined) operatorDoesntSupport(this.toString().trim(), args.map(a => a.type()), this.pos);
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

/** Token '...' [ellipse] */
class EllipseToken extends Token {
  constructor(tline, pos) {
    super(tline, '...', pos);
  }

  toString() { return '...'; }
}

/** For symbols e.g. 'hello' */
class VariableToken extends Token {
  constructor(tstring, vname, pos) {
    super(tstring, vname, pos);
  }

  type() {
    let val = this.getVarNoError();
    if (val === undefined) return "symbol";
    return typeof val.type === "function" ? val.type() : val.value.type();
  }

  castTo(type, evalObj) {
    let v = this.getVar();
    if (v.value === this) throw new Error(`Self-referencing variable (infinite lookup prevented) - variable '${this.value}'`);
    return v.castTo(type, evalObj);
  }

  toPrimitive(type, evalObj) {
    return this.tstr.rs.getVar(this.value, this.tstr.block.pid).toPrimitive(type, evalObj);
  }

  exists() {
    return this.tstr.rs.getVar(this.value, this.tstr.block.pid) !== undefined;
  }

  getVar() {
    const v = this.tstr.rs.getVar(this.value, this.tstr.block.pid);
    if (v === undefined) this._throwNameError();
    return v;
  }

  getVarNoError() {
    return this.tstr.rs.getVar(this.value, this.tstr.block.pid);
  }

  toString(evalObj) {
    return str(this.getVar()?.value, evalObj);
  }

  /** Throw Name Error */
  _throwNameError() {
    throw new Error(`[${errors.NAME}] Name Error: name '${this.value}' does not exist (position ${this.pos})`);
  }

  /** function: del() */
  __del__(evalObj) {
    const ok = this.tstr.rs.deleteVar(this.value, this.tstr.block.pid);
    return new BoolValue(this.tstr.rs, ok);
  }

  /** operator: = */
  __assign__(evalObj, value) {
    value = value.castTo("any", evalObj);
    const name = this.value, thisVar = this.getVarNoError();
    if (thisVar && thisVar.refFor) {
      thisVar.refFor.value = value;
      thisVar.value = value;
    } else {
      this.tstr.rs.defineVar(name, value, undefined, this.tstr.block.pid);
    }
    return value;
  }

  /** operator: => */
  __nonlocalAssign__(evalObj, value) {
    value = value.castTo("any", evalObj);
    const name = this.value;
    if (!this.exists()) throw new Error(`[${errors.NULL_REF}] Null Reference: no non-local binding for symbol '${name}'. Did you mean to use '=' ?`);
    this.tstr.rs.setVar(name, value, undefined, this.tstr.block.pid);
    return value;
  }

  /** operator: += */
  async __assignAdd__(evalObj, value) {
    value = await this.castTo("any", evalObj).__add__?.(evalObj, value.castTo("any", evalObj));
    if (value === undefined) return undefined;
    this.tstr.rs.setVar(this.value, value, undefined, this.tstr.block.pid);
    return value;
  }

  /** operator: -= */
  async __assignSub__(evalObj, value) {
    value = await this.castTo("any", evalObj).__sub__?.(evalObj, value.castTo("any", evalObj));
    if (value === undefined) return undefined;
    this.tstr.rs.setVar(this.value, value, undefined, this.tstr.block.pid);
    return value;
  }

  /** operator: *= */
  async __assignMul__(evalObj, value) {
    value = await this.castTo("any", evalObj).__mul__?.(evalObj, value.castTo("any", evalObj));
    if (value === undefined) return undefined;
    this.tstr.rs.setVar(this.value, value, undefined, this.tstr.block.pid);
    return value;
  }

  /** operator: /= */
  async __assignDiv__(evalObj, value) {
    value = await this.castTo("any", evalObj).__div__?.(evalObj, value.castTo("any", evalObj));
    if (value === undefined) return undefined;
    this.tstr.rs.setVar(this.value, value, undefined, this.tstr.block.pid);
    return value;
  }

  /** operator: %= */
  async __assignMod__(evalObj, value) {
    value = await this.castTo("any", evalObj).__mod__?.(evalObj, value.castTo("any", evalObj));
    if (value === undefined) return undefined;
    this.tstr.rs.setVar(this.value, value, undefined, this.tstr.block.pid);
    return value;
  }
}

/** A bracketed TokenLine[] */
class BracketedTokenLines extends Token {
  constructor(tstring, tokenLines, openingBracket, pos) {
    super(tstring, tokenLines, pos);
    this.opening = openingBracket;
  }

  setBlock(block) {
    super.setBlock(block);
    this.value.forEach(tl => tl.setBlock(block));
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

  toBlock(pid) {
    if (!this.tstr.block) throw new Error(`BracketedTokenLines.toBlock :: this.tstr is not bound to a scope`);
    return new Block(this.tstr.rs, this.value, this.pos, pid, this.tstr.block);
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

  /** Set Block object - also assign to every token object in line */
  setBlock(block) {
    this.block = block;
    this.tokens.forEach(t => t.setBlock?.(block));
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
    this.setBlock(this.block);
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
    try {
      return this._parse();
    } catch (e) {
      // throw e;
      throw new Error(`${this.source}: \n${e} `);
    }
  }

  /** Extra parsing - assemble tokens into structure */
  _parse() {
    // Before put into RPN...
    for (let i = 0; i < this.tokens.length; i++) {
      if (this.tokens[i] instanceof ValueToken) {
        if (this.tokens[i].value instanceof StringValue) {
          let tstr = this.tokens[i].value;
          for (let ipos in tstr.intpls) {
            if (tstr.intpls.hasOwnProperty(ipos)) {
              try {
                tstr.intpls[ipos].val.setBlock(this.block);
                tstr.intpls[ipos].val.prepare();
              } catch (e) {
                throw new Error(`[${errors.GENERAL}] Error in interpolated string at ${this.tokens[i].pos} at string index ${ipos}:\n${e}`);
              }
            }
          }
        }
        this.tokens[i] = this.tokens[i].value; // Remove all ValueToken objects
      } else if ((this.tokens[i] instanceof VariableToken || (this.tokens[i] instanceof BracketedTokenLines && this.tokens[i].opening === '(')) && this.tokens[i + 1] instanceof OperatorToken && this.tokens[i + 1].value === '-' && this.tokens[i + 2] instanceof OperatorToken && this.tokens[i + 2].value === '>') {
        //* SHORTHAND LAMBDA WITHOUT RETURN TYPE
        let structure = new FuncStructure(this.tokens[i].pos, this.rs, {});
        structure.args = this.tokens[i] instanceof VariableToken ? ({ [this.tokens[i].value]: { type: 'any' } }) : parseAsFunctionArgs(this.tokens[i]);

        // Extract function body
        if (this.tokens[i + 3] instanceof Block) {
          structure.body = this.tokens[i + 3];
          this.tokens.splice(i, 4, structure);
        } else if (this.tokens[i + 3] instanceof BracketedTokenLines && this.tokens[i + 3].opening === '{') {
          structure.body = this.tokens[i + 3].toBlock(this.block.pid);
          this.tokens.splice(i, 4, structure);
        } else {
          // Extract everything up to EOL or COMMA
          let tokens = [], j = i + 3;
          for (; j < this.tokens.length; j++) {
            if (this.tokens[j] instanceof EOLToken || (this.tokens[j] instanceof OperatorToken && this.tokens[j].value === ',')) break;
            tokens.push(this.tokens[j]);
          }
          if (tokens.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected following '->', got ${this.tokens[j] ? `${this.tokens[j]} at position ${this.tokens[j].pos}` : `end of input at position ${this.tokens[j - 1].pos}`}`);
          structure.body = this.block.createChild([new TokenLine(this.rs, undefined, tokens)], this.tokens[i + 5]?.pos);
          this.tokens.splice(i, j - i, structure);
        }

        structure.validate();
      } else if ((this.tokens[i] instanceof VariableToken || (this.tokens[i] instanceof BracketedTokenLines && this.tokens[i].opening === '(')) && (this.tokens[i + 1] instanceof OperatorToken && this.tokens[i + 1].value === ":" && this.tokens[i + 3] instanceof OperatorToken && this.tokens[i + 3].value === '-' && this.tokens[i + 4] instanceof OperatorToken && this.tokens[i + 4].value === '>')) {
        //* SHORTHAND LAMBDA WITH RETURN TYPE
        let structure = new FuncStructure(this.tokens[i].pos, this.rs, {});
        structure.returnType = this.tokens[i + 2].value;
        structure.args = this.tokens[i] instanceof VariableToken ? ({ [this.tokens[i].value]: { type: 'any' } }) : parseAsFunctionArgs(this.tokens[i]);

        // Extract function body
        if (this.tokens[i + 5] instanceof Block) {
          structure.body = this.tokens[i + 5];
          this.tokens.splice(i, 6, structure);
        } else if (this.tokens[i + 5] instanceof BracketedTokenLines && this.tokens[i + 3].opening === '{') {
          structure.body = this.tokens[i + 3].toBlock(this.block.pid);
          this.tokens.splice(i, 6, structure);
        } else {
          // Extract everything up to EOL or COMMA
          let tokens = [], j = i + 5;
          for (; j < this.tokens.length; j++) {
            if (this.tokens[j] instanceof EOLToken || (this.tokens[j] instanceof OperatorToken && this.tokens[j].value === ',')) break;
            tokens.push(this.tokens[j]);
          }
          if (tokens.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected following '->', got ${this.tokens[j] ? `${this.tokens[j]} at position ${this.tokens[j].pos}` : `end of input at position ${this.tokens[j - 1].pos}`}`);
          structure.body = this.block.createChild([new TokenLine(this.rs, undefined, tokens)], this.tokens[i + 5]?.pos);
          this.tokens.splice(i, j - i, structure);
        }

        structure.validate();
      } else if (this.tokens[i] instanceof BracketedTokenLines) {
        let ok = true;
        if (this.tokens[i].opening === '[') { // *** ARRAY
          // If first item, or after an operator, this is an array
          if (i === 0 || this.tokens[i - 1] instanceof EllipseToken || (this.tokens[i - 1] instanceof OperatorToken && this.tokens[i - 1].value !== '[]') || this.tokens[i - 1] instanceof BracketToken) {
            let elements;
            if (this.tokens[i].value.length === 0) elements = [];
            else if (this.tokens[i].value.length === 1) elements = this.tokens[i].value[0].splitByCommas().filter(tl => tl.tokens.length > 0);
            else throw new expectedSyntaxError(']', peek(this.tokens[i].value[0].tokens));

            let structure = new ArrayStructure(this.rs, elements, this.tokens[i].pos);
            structure.validate();
            this.tokens[i] = structure;
          }
        } else if (this.tokens[i].opening === '(') { // *** CALL STRING / EXPRESSION
          // Conditional operator? "(...) ? (...)"
          if (this.tokens[i + 1] instanceof OperatorToken && this.tokens[i + 1].value == '?' && this.tokens[i + 2] instanceof BracketedTokenLines && this.tokens[i + 2].opening === '(') {
            let op = new OperatorToken(this, '?:', this.tokens[i + 1].pos), remCount = 3;
            op.data = [this.tokens[i], this.tokens[i + 2]]; // <condition> <ifTrue> (return undef if false)

            if (this.tokens[i + 3] instanceof OperatorToken && this.tokens[i + 3].value === ':') {
              if (this.tokens[i + 4] instanceof BracketedTokenLines && this.tokens[i + 4].opening === '(') {
                op.data.push(this.tokens[i + 4]);
                remCount += 2;
              } else {
                throw new Error(`[${errors.SYNTAX}] Syntax Error: expected (...) following ':' (position ${this.tokens[i + 3].pos}) in conditional operator '?' (position ${this.tokens[i + 1].pos}), got ${this.tokens[i + 4]?.pos ?? 'end of line'}`);
              }
            }
            for (let x of op.data) x.prepare();
            this.tokens.splice(i, remCount, op);
          }

          // If first item, or after an operator, this is an expression group
          else if (i === 0 || this.tokens[i - 1] instanceof EllipseToken || (this.tokens[i - 1] instanceof OperatorToken && this.tokens[i - 1].value !== '()') || this.tokens[i - 1] instanceof BracketToken) {
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
          if (i === 0 || this.tokens[i - 1] instanceof EllipseToken || this.tokens[i - 1] instanceof OperatorToken) { // Set/Map if (1) first token (2) preceeded by operator
            let elements;
            if (this.tokens[i].value.length === 0) elements = [];
            else if (this.tokens[i].value.length === 1) elements = this.tokens[i].value[0].splitByCommas(false);
            else throw new expectedSyntaxError('}', peek(this.tokens[i].value[0].tokens));
            elements = elements.filter(tl => tl.tokens.length > 0);

            let structure;
            // MAP if first item is in syntax "a : ..."
            if (elements.length > 0 && elements[0].tokens.length > 0 && elements[0].tokens[1] instanceof OperatorToken && elements[0].tokens[1].value === ':') {
              structure = new MapStructure(this.rs, this.tokens[i].pos);

              for (const pair of elements) {
                if (pair.tokens.length === 0) continue;
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
          } else if (!(this.tokens[i - 1] instanceof KeywordToken && this.tokens[i - 1].value === "let")) { //* BLOCK assuming not following LET declaration
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
                const structure = new IfStructure(this.rs, this.tokens[i].pos);

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
                        throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid ELSE-IF construct at position ${this.tokens[i].pos}: expected condition (...) got ${this.tokens[i + 3] ?? 'end of input'} at ${this.tokens[i].pos}`);
                      }
                    } else {
                      throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid ELSE-IF construct at position ${this.tokens[i].pos}: expected condition (...) got ${this.tokens[i + 2] ?? 'end of input'} at ${this.tokens[i].pos}`);
                    }
                  } else {
                    let block = this.tokens[i + 1];
                    if (block instanceof Block) {
                      structure.addElse(block);
                      this.tokens.splice(i, 2); // Remove "else" "{...}"
                      break;
                    } else {
                      throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid ELSE construct at position ${this.tokens[i].pos}: expected block {...} got ${this.tokens[i + 1] ?? 'end of input'}`);
                    }
                  }
                }

                structure.validate();
                this.tokens.splice(i, 0, structure);
              } else {
                throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid IF construct at position ${this.tokens[i].pos}: expected block {...} got ${this.tokens[i + 2] ?? 'end of input'} at ${this.tokens[i].pos}`);
              }
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid IF construct at position ${this.tokens[i].pos}: expected condition (...) got ${this.tokens[i + 1] ?? 'end of input'} at ${this.tokens[i].pos}`);
            }
            break;
          }
          case "do": {
            if (this.tokens[i + 1] instanceof Block) {
              this.tokens[i + 1].breakable = 2;
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
              structure = new DoWhileStructure(this.rs, this.tokens[i].pos, this.tokens[i + 1], this.tokens[i - 1]);

              if (this.tokens[i + 2] instanceof KeywordToken && this.tokens[i + 2].value === 'then') {
                if (this.tokens[i + 3] instanceof Block) {
                  structure.thenBlock = this.tokens[i + 3];
                  removeCount += 2;
                } else {
                  throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid WHILE construct at position ${this.tokens[i].pos}: expected block after 'then' at position ${this.tokens[i + 2].pos}`);
                }
              }
              this.tokens.splice(i - 1, removeCount, structure); // Remove "{...}" "while" "(...)", insert strfucture
            }

            else if (this.tokens[i + 1] instanceof BracketedTokenLines && this.tokens[i + 1].opening === '(' && this.tokens[i + 2] instanceof Block) {
              // ! WHILE
              let removeCount = 3;
              structure = new WhileStructure(this.rs, this.tokens[i].pos, this.tokens[i + 1], this.tokens[i + 2]);
              if (this.tokens[i + 3] instanceof KeywordToken && this.tokens[i + 3].value === 'then') {
                if (this.tokens[i + 4] instanceof Block) {
                  structure.thenBlock = this.tokens[i + 4];
                  removeCount += 2;
                } else {
                  throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid WHILE construct at position ${this.tokens[i].pos}: expected block after 'then' at position ${this.tokens[i + 3].pos}`);
                }
              }
              this.tokens.splice(i, removeCount, structure); // Remove "while" "(...)" "{...}" and insert structure
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid WHILE construct at position ${this.tokens[i].pos}`);
            }
            structure.validate();
            break;
          }
          case "until": {
            let structure;
            if (this.tokens[i - 1] instanceof Block && this.tokens[i + 1] instanceof BracketedTokenLines && this.tokens[i + 1].opening === '(') {
              // ! DO-UNTIL
              let removeCount = 3;
              structure = new DoUntilStructure(this.rs, this.tokens[i].pos, this.tokens[i + 1], this.tokens[i - 1]);

              if (this.tokens[i + 2] instanceof KeywordToken && this.tokens[i + 2].value === 'then') {
                if (this.tokens[i + 3] instanceof Block) {
                  structure.thenBlock = this.tokens[i + 3];
                  removeCount += 2;
                } else {
                  throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid UNTIL construct at position ${this.tokens[i].pos}: expected block after 'then' at position ${this.tokens[i + 2].pos}`);
                }
              }
              this.tokens.splice(i - 1, removeCount, structure); // Remove "{...}" "while" "(...)", insert strfucture
            }

            else if (this.tokens[i + 1] instanceof BracketedTokenLines && this.tokens[i + 1].opening === '(' && this.tokens[i + 2] instanceof Block) {
              // ! UNTIL
              let removeCount = 3;
              structure = new UntilStructure(this.rs, this.tokens[i].pos, this.tokens[i + 1], this.tokens[i + 2]);

              if (this.tokens[i + 3] instanceof KeywordToken && this.tokens[i + 3].value === 'then') {
                if (this.tokens[i + 4] instanceof Block) {
                  structure.thenBlock = this.tokens[i + 4];
                  removeCount += 2;
                } else {
                  throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid UNTIL construct at position ${this.tokens[i].pos}: expected block after 'then' at position ${this.tokens[i + 3].pos}`);
                }
              }
              this.tokens.splice(i, removeCount, structure); // Remove "while" "(...)" "{...}" and insert structure
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid UNTIL construct at position ${this.tokens[i].pos}`);
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
                structure = new ForInStructure(this.rs, this.tokens[i].pos, vars, rest, this.tokens[i + 2]);
              } else {
                // General for loop
                structure = new ForStructure(this.rs, this.tokens[i].pos, this.tokens[i + 1], this.tokens[i + 2]);
              }

              // Then block?
              if (this.tokens[i + 3] instanceof KeywordToken && this.tokens[i + 3].value === 'then') {
                if (this.tokens[i + 4] instanceof Block) {
                  structure.thenBlock = this.tokens[i + 4];
                  removeCount += 2;
                } else {
                  throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid FOR construct at position ${this.tokens[i].pos}: expected block after 'then' at position ${this.tokens[i + 3].pos}`);
                }
              }

              this.tokens.splice(i, removeCount, structure); // Remove "for" "(...)" "{...}"
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid FOR construct at position ${this.tokens[i].pos}`);
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

            let ok = true, offset = 0, removeCount = 0;

            // Arguments?
            let argGroup;
            if (this.tokens[i + 1] instanceof BracketedTokenLines && this.tokens[i + 1].opening === '(') {
              argGroup = this.tokens[i + 1];
              removeCount = 3;
              offset = 2;
            } else {
              removeCount = 2;
              offset = 1;
            }

            // Return Value
            let returnType = "any";
            if (ok && this.tokens[i + offset] instanceof OperatorToken && this.tokens[i + offset].value === ':') {
              offset++;
              removeCount++;
              if (this.tokens[i + offset] instanceof VariableToken || this.tokens[i + offset] instanceof KeywordToken) {
                returnType = this.tokens[i + offset].value;
                removeCount++;
                offset++;
              } else ok = false;
            }

            // Block for function body
            if (this.tokens[i + offset] instanceof Block) {
              structure.body = this.tokens[i + offset];
              structure.returnType = returnType;
              this.tokens.splice(i, removeCount, structure);

              // Parse arguments
              if (argGroup) {
                structure.args = parseAsFunctionArgs(argGroup);
              }
            } else ok = false;

            if (!ok) throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid FUNC construct at position ${structure.pos}`);

            structure.validate();
            break;
          }
          case "loop": {
            if (this.tokens[i + 1] instanceof Block) {
              let structure = new LoopStructure(this.rs, this.tokens[i].pos, this.tokens[i + 1]);
              structure.validate();
              this.tokens.splice(i, 2, structure); // Remove "loop" "{...}" and add structure
            } else {
              throw new Error(`[${errors.SYNTAX}] LOOP: expected block {...} after keyword 'loop' at position ${this.tokens[i].pos}`);
            }
            break;
          }
          case "break": {
            if (this.tokens.length > i + 2) throw new Error(`[${errors.SYNTAX}] Syntex Error: unexpected token(s) after 'break' at position ${this.tokens[i].pos}`);
            if (this.block.breakable) {
              let label;
              if (this.tokens[i + 1]) {
                if (this.tokens[i + 1] instanceof VariableToken) label = this.tokens[i + 1].value;
                else throw new Error(`[${errors.SYNTAX}] Syntax Error: expected symbol after 'break' statement at position ${this.tokens[i + 1]}`);
              }
              let structure = new BreakStructure(this.tokens[i].pos);
              structure.label = label;
              structure.validate();
              this.tokens.splice(i, label ? 2 : 1, structure);
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: 'break' not permitted here`);
            }
            break;
          }
          case "continue": {
            if (this.tokens.length > i + 1) throw new Error(`[${errors.SYNTAX}] Syntex Error: unexpected token(s) after 'continue' at position ${this.tokens[i].pos}`);
            if (this.block.continueable) {
              let structure = new ContinueStructure(this.tokens[i].pos);
              structure.validate();
              this.tokens[i] = structure;
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: 'continue' not permitted here`);
            }
            break;
          }
          case "return": {
            if (this.block.returnable) {
              let tokenLine = new TokenLine(this.rs, this.block, this.tokens.splice(i + 1) ?? []);
              let structure = new ReturnStructure(this.tokens[i].pos, tokenLine);
              structure.validate();
              this.tokens[i] = structure;
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: 'return' not permitted here`);
            }
            break;
          }
          case "switch": {
            if (this.tokens[i + 1] instanceof BracketedTokenLines && this.tokens[i + 1].opening === "(") {
              if (this.tokens[i + 2] instanceof Block) {
                const structure = new SwitchStructure(this.rs, this.tokens[i].pos, this.tokens[i + 1]);
                const switchBlock = this.tokens[i + 2];

                this.tokens.splice(i, 3); // Remove "switch" "(...)" "{...}"

                let currLine = switchBlock.tokenLines[0];
                if (!currLine) throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid SWITCH construct: empty block {...} at ${switchBlock.pos}`);

                let currLineI = 0, currTokenI = 0;
                while (true) {
                  if (!currLine.tokens[currTokenI]) throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid SWITCH construct: unexpected end of input`);
                  if (currLine.tokens[currTokenI] instanceof KeywordToken && currLine.tokens[currTokenI].value === 'case') {
                    let conditions = [], offset = 1;

                    while (true) {
                      if (currLine.tokens[currTokenI + offset] instanceof BracketedTokenLines && currLine.tokens[currTokenI + offset].opening === '(') {
                        conditions.push(currLine.tokens[currTokenI + offset]);
                        offset++;

                        if (currLine.tokens[currTokenI + offset] instanceof OperatorToken && currLine.tokens[currTokenI + offset].value === ',') {
                          offset++;
                        } else {
                          break;
                        }
                      } else {
                        throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid SWITCH construct at position ${structure.pos}: expected '(' following case-clause (at ${currLine.tokens[currTokenI].pos}), got '${currLine.tokens[currTokenI + offset]?.toString()[0] ?? 'end of input'}' at ${currLine.tokens[currTokenI + offset].pos}`);
                      }
                    }

                    if (currLine.tokens[currTokenI + offset] instanceof BracketedTokenLines && currLine.tokens[currTokenI + offset].opening === '{') {
                      const block = this.block.createChild(currLine.tokens[currTokenI + offset].value, currLine.tokens[currTokenI + offset].pos);
                      structure.addCase(conditions, block);
                      currTokenI += offset + 1;
                    } else {
                      throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid SWITCH construct at position ${structure.pos}: expected '{' following 'case (...)', got '${currLine.tokens[currTokenI + 2]?.toString()[0] ?? 'end of input'}' following position ${currLine.tokens[currTokenI + 1].pos}`);
                    }
                  } else if (currLine.tokens[currTokenI] instanceof KeywordToken && currLine.tokens[currTokenI].value === 'else') {
                    if (currLine.tokens[currTokenI + 1] instanceof BracketedTokenLines && currLine.tokens[currTokenI + 1].opening === '{') {
                      if (structure.elseBlock) throw new Error(`[${errors.SYNTAX}] Syntax Error: More than one else clause in switch statement at position ${currLine.tokens[currTokenI].pos} (previous else clause at position ${structure.elseBlock.pos})`);
                      const block = this.block.createChild(currLine.tokens[currTokenI + 1].value, currLine.tokens[currTokenI + 1].pos);
                      structure.addElse(block);
                      currTokenI += 2;
                    } else {
                      throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid SWITCH construct at position ${structure.pos}: expected '{' following 'else', got '${currLine.tokens[currTokenI + 1]?.toString()[0] ?? 'end of input'}' following position ${currLine.tokens[currTokenI].pos}`);
                    }
                  } else {
                    throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid SWITCH construct at position ${structure.pos}: expected 'case' or 'else', got '${currLine.tokens[currTokenI]}' at ${currLine.tokens[currTokenI].pos}`);
                  }
                  if (currTokenI >= currLine.tokens.length) {
                    currLineI++;
                    if (!switchBlock.tokenLines[currLineI]) break;
                  }
                }

                structure.validate();
                this.tokens.splice(i, 0, structure);
              } else {
                throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid SWITCH construct: expected block {...} got ${this.tokens[i + 2] ?? 'end of input'} at ${this.tokens[i].pos}`);
              }
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid SWITCH construct: expected condition (...) got ${this.tokens[i + 1] ?? 'end of input'} at ${this.tokens[i].pos}`);
            }
            break;
          }
          case "let": {
            if (this.tokens[i + 1] instanceof VariableToken) {
              const structure = new LetStructure(this.tokens[i].pos, this.rs, this.tokens[i + 1]);
              structure.validate();
              this.tokens.splice(i, 2, structure);
            } else if (this.tokens[i + 1] instanceof BracketedTokenLines && (this.tokens[i + 1].opening === "[" || this.tokens[i + 1].opening === "{") && this.tokens[i + 1].value.length === 1) {
              let elements = this.tokens[i + 1].value[0].splitByCommas(), symbols = [];
              for (let i = 0; i < elements.length; i++) {
                if (elements[i].tokens.length === 1 && elements[i].tokens[0] instanceof VariableToken) symbols.push(elements[i].tokens[0]);
                else throw new Error(`[${errors.SYNTAX}] Syntax Error: expected array of symbols on lhs of expression at position ${elements[i].pos}, got otherwise in member ${i}`);
              }
              const structure = new LetStructure(this.tokens[i].pos, this.rs, symbols);
              structure.variation = this.tokens[i + 1].opening === "{" ? "set" : "array";
              structure.validate();
              this.tokens.splice(i, 2, structure);
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: expected symbol, got ${this.tokens[i + 1] ?? 'end of input'} at ${this.tokens[i].pos} in 'let' expression`);
            }
            break;
          }
          case "label": {
            if (this.tokens[i + 1] instanceof VariableToken || this.tokens[i + 1] instanceof KeywordToken) {
              const structure = new LabelStructure(this.tokens[i].pos, this.rs, this.tokens[i + 1].value);
              structure.validate();
              this.tokens.splice(i, 2, structure);
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: expected symbolic label, got ${this.tokens[i + 1] ?? 'end of input'} at ${this.tokens[i].pos}`);
            }
            break;
          }
          case "goto": {
            if (this.tokens[i + 1] instanceof VariableToken || this.tokens[i + 1] instanceof KeywordToken) {
              const structure = new GotoStructure(this.tokens[i].pos, this.rs, this.tokens[i + 1].value);
              structure.validate();
              this.tokens.splice(i, 2, structure);
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: expected symbolic label, got ${this.tokens[i + 1] ?? 'end of input'} at ${this.tokens[i].pos}`);
            }
            break;
          }
          case "false":
            this.tokens.splice(i, 1, new BoolValue(this.rs, false));
            break;
          case "true":
            this.tokens.splice(i, 1, new BoolValue(this.rs, true));
            break;
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
      } else if (this.tokens[i] instanceof BracketedTokenLines && this.tokens[i].opening === '[') {
        if (this.tokens[i].value.length === 1) {
          let op = new OperatorToken(this, '[]', this.tokens[i].pos);
          op.data = this.tokens[i].value[0]; // Property
          op.data.prepare();
          this.tokens[i] = op;
        } else {
          throw new Error(`[${errors.SYNTAX}] Syntax Error: expected expression, got ] at position ${this.tokens[i].pos} (computed member access)`);
        }
      }
    }
    return this;
  }

  /** Evaluate TokenLine */
  async eval(evalObj) {
    try {
      return await this._eval(evalObj);
    } catch (e) {
      throw new Error(`${this.source}: \n${e} `);
    }
  }

  /** Code executed just before evaluation */
  async preeval(evalObj) {
    for (const T of this.tokens) {
      if (typeof T.preeval === 'function') {
        await T.preeval(evalObj);
        if (evalObj.action !== 0) break;
      }
    }
  }

  async _eval(evalObj) {
    // Evaluate in postfix notation
    const T = this.tokens, stack = [];
    for (let i = 0; i < T.length; i++) {
      const cT = T[i];
      if (cT instanceof Value || cT instanceof VariableToken) {
        stack.push(cT.eval ? await cT.eval(evalObj) : cT);
      } else if (cT instanceof OperatorToken) {
        const info = cT.info();
        if (stack.length < info.args) {
          let str = `[${errors.SYNTAX}] Syntax Error: unexpected operator '${cT.value}' at position ${cT.pos} - stack underflow (expects ${info.args} values, got ${stack.length})`;
          if (info.unary && info.unary !== cT.value) str += `\n\tIf you meant the unary operator '${cT.value}', check your syntax with the criterion in docs/General.md`;
          throw new Error(str);
        }
        const args = stack.splice(stack.length - info.args);
        const val = await cT.eval(args, evalObj);
        stack.push(val);
      } else if (cT instanceof Block) {
        let ret = await cT.eval(evalObj);
        if (ret !== undefined) stack.push(ret);
      } else if (cT instanceof Structure) {
        // If, in infix, is before an assignment operator, special
        if ((cT instanceof ArrayStructure || cT instanceof SetStructure) && T[i + 2] instanceof OperatorToken && (T[i + 2].value === "=" || T[i + 2].value === "=>")) cT.assignment = true;
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
    // Update 'ans' var with latest value
    this.rs.setVar('ans', stack[0].castTo("any"), undefined, evalObj.pid);
    return stack[0];
  }

  toString(evalObj) {
    return this.tokens.map(t => t.toString(evalObj)).join(' ');
  }

  /** Return array of tokens of this tokenString RPNd */
  toRPN() {
    return this._toRPN(this.tokens, this.rs.opts.value.get("bidmas").toPrimitive("bool"));
  }

  /** Token array from infix to postfix */
  _toRPN(tokens, bidmas = true) {
    const stack = [], output = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] instanceof Value || tokens[i] instanceof VariableToken || tokens[i] instanceof TokenLine || tokens[i] instanceof BracketedTokenLines || tokens[i] instanceof KeywordToken || tokens[i] instanceof Structure || tokens[i] instanceof Block || tokens[i] instanceof EllipseToken) {
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
  let string = obj.string, lastSourceIndex = 0;
  let currentLine = new TokenLine(obj.rs, null), currentTokens = []; // Tokens for the current line

  const checkLastToken = (unexpected, pos) => {
    const topmost = peek(currentTokens);
    if (topmost instanceof ValueToken)
      throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected token '${unexpected}' at position ${pos}`);
  };

  for (let i = 0; i < string.length;) {
    // String literal?
    if (string[i] === '"') {
      checkLastToken('"', obj.pos);
      let seq = '', j = i + 1, interpolations = {};
      while (true) {
        if (string[j] === '"') break;
        if (string[j] === '\\' && string[j + 1]) {
          j++;
          const obj = decodeEscapeSequence(string, j);
          if (obj.char) {
            j = obj.pos;
            seq += obj.char;
            continue;
          }
        }
        if (string[j] === '{') { // INTERPOLATION
          const pobj = createTokenStringParseObj(obj.rs, string.substr(j + 1), obj.pos + j + 1, obj.depth + 1, ['}'], false);
          _tokenify(pobj);
          if (pobj.terminateOn !== '}') throw throwMatchingBracketError('{', '}', obj.pos);
          if (pobj.lines.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expected expression, got '}' at position ${pobj.pos}`);
          const source = string.substr(j + 1, pobj.pos - (obj.pos + j + 1)); // Extract line source
          let itp = { val: pobj.lines[0], src: source }, itpLast = itp.val.tokens[itp.val.tokens.length - 1];
          if (itp.val.tokens.length > 1 && itpLast instanceof OperatorToken && itpLast.value === '=') {
            itp.val.tokens.pop();
            itp.eq = true;
          }
          interpolations[seq.length] = itp;
          j += source.length + 2;
          continue;
        }
        if (string[j] === undefined) throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected end of input in string literal at position ${j} (literal at ${i})`);
        seq += string[j];
        j++;
      }
      currentTokens.push(new ValueToken(currentLine, new StringValue(obj.rs, seq, interpolations), i));
      const d = (j - i) + 1;
      i += d;
      obj.pos += d;
      continue;
    }

    // Char literal?
    if (string[i] === '\'') {
      checkLastToken('\'', obj.pos);
      let seq = '', j = i + 1;
      while (true) {
        if (string[j] === '\'') break;
        if (string[j] === '\\') {
          j++;
          const obj = decodeEscapeSequence(string, j);
          if (obj.char) {
            j = obj.pos;
            seq += obj.char;
            continue;
          }
        }
        if (string[j] === undefined) throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected end of input in char literal at position ${j} (literal at ${i})`);
        seq += string[j];
        j++;
      }
      if (seq.length > 1) throw new Error(`[${errors.SYNTAX}] Syntax Error: multi-character character literal at position ${i}. Did you mean to use double quotes: "${string.substring(i + 1, j)}" ?`);
      currentTokens.push(new ValueToken(currentLine, new CharValue(obj.rs, seq), i));
      const d = (j - i) + 1;
      i += d;
      obj.pos += d;
      continue;
    }

    // Break (reached termination)
    if (obj.terminateOn.includes(string[i])) {
      obj.terminateOn = string[i];
      break;
    }

    // Start a new line?
    if (obj.allowMultiline && (string[i] === EOLToken.symbol || (string[i] === '\n' && !(obj.terminateOn.includes(")") || obj.terminateOn.includes("]"))))) { // End Of Line
      // Blank line
      i++;
      obj.pos++;
      // (1) Line empty? (2) Comma beforehand
      if (currentTokens.length === 0 || (currentTokens[currentTokens.length - 1] instanceof OperatorToken && currentTokens[currentTokens.length - 1].value === ",")) continue;
      currentLine.updateTokens(currentTokens);
      currentLine.source = string.substring(lastSourceIndex, i - 1).trim();
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

    // Comment?
    if (string[i] === '/' && string[i + 1] === '/') {
      let comment = '';
      i += 3; // Skip '//' 
      obj.pos += 3;
      for (; i < string.length; i++, obj.pos++) {
        if (string[i] === '\n' || string[i] === '\r') {
          i++;
          obj.pos++;
          break;
        }
        comment += string[i];
      }
      currentLine.comment = comment;
      continue;
    }

    // Multi-line Comment?
    if (string[i] === '/' && string[i + 1] === '*') {
      let comment = '';
      i += 3; // SKip '/*'
      obj.pos += 3;
      for (; i < string.length; i++, obj.pos++) {
        if (string[i] === '*' && string[i + 1] === '/') {
          i += 2; // Skip '*/'
          obj.pos += 2;
          break;
        }
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
        const opening = string[i], closing = bracketMap[opening];
        const pobj = createTokenStringParseObj(obj.rs, string.substr(i + 1), obj.pos + 1, obj.depth + 1, [closing], true);
        _tokenify(pobj);

        // Check that everything was matched
        const len = (pobj.pos - obj.pos) + 1;
        if (pobj.terminateOn !== closing) {
          throw throwMatchingBracketError(opening, closing, obj.pos);
        }
        const group = new BracketedTokenLines(currentLine, pobj.lines, opening, obj.pos);
        currentTokens.push(group);

        obj.pos += len;
        i += len;
        continue;
      }
    }

    // '...'
    if (string.substr(i, 3) === '...') {
      currentTokens.push(new EllipseToken(currentLine, obj.pos));
      i += 3;
      obj.pos += 3;
      continue;
    }

    // Operator?
    let op = parseOperator(string.substr(i));
    if (op !== null) {
      const t = new OperatorToken(currentLine, op, obj.pos);

      // Is unary: first, after (, after an operator (first, check that there IS a unary operator available)
      const top = peek(currentTokens);
      if (t.info().unary && (top === undefined || (top instanceof BracketToken && top.facing() === 1) || top instanceof OperatorToken || (top instanceof KeywordToken && !top.isValueKeyword))) {
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
      numObj = parseNumber(string.substr(i), true, '_', Complex.imagLetter);
    } catch (e) {
      throw new Error(`[${errors.SYNTAX}] Syntax Error: ${e.message} (literal at position ${obj.pos})`); // Error whilst parsing number literal
    }
    if (numObj.str.length > 0) {
      checkLastToken(numObj.str, obj.pos);
      const t = new ValueToken(currentLine, new NumberValue(obj.rs, numObj.imag ? new Complex(0, numObj.num) : numObj.num), obj.pos);
      currentTokens.push(t);
      i += numObj.pos;
      obj.pos += numObj.pos;
      continue;
    }

    // Variable? (symbol)
    let symbol = parseSymbol(string.substr(i));
    if (symbol !== null) {
      // Break? (reached termination)
      if (obj.terminateOn.includes(symbol)) {
        obj.terminateOn = symbol;
        i += symbol.length;
        obj.pos += symbol.length;
        break;
      }

      if (symbol === 'begin') {
        const begin = 'begin', end = 'end';
        const pobj = createTokenStringParseObj(obj.rs, string.substr(i + begin.length), obj.pos + begin.length, obj.depth + 1, [end], true);
        _tokenify(pobj);

        // Check that everything was matched
        const len = (pobj.pos - obj.pos);
        if (pobj.terminateOn !== end) {
          throwMatchingBracketError(begin, end, obj.pos);
        }
        const group = new BracketedTokenLines(currentLine, pobj.lines, "{", obj.pos);
        currentTokens.push(group);

        obj.pos += len;
        i += len;
        continue;
      }

      let t;
      if (KeywordToken.keywords.includes(symbol)) { // Keyword?
        t = new KeywordToken(currentLine, symbol, obj.pos);
      } else {
        checkLastToken(symbol, obj.pos);
        t = new VariableToken(currentLine, symbol, obj.pos);
      }

      currentTokens.push(t);

      i += symbol.length;
      obj.pos += symbol.length;
      continue;
    }

    throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected token '${string[i]}' (${string[i].charCodeAt(0)}) at position ${obj.pos} `);
  }

  // Make sure any remnant tokens are pushes to a new line
  if (currentTokens.length > 0) {
    currentLine.updateTokens(currentTokens);
    currentLine.source = string.substr(lastSourceIndex).trim();
    obj.lines.push(currentLine);
  }

  return;
}

/** Parse BracketedTokenLine as function arguments string. Return argument object. */
function parseAsFunctionArgs(argGroup) {
  // Syntax: "arg[: [ref|val] [?]type [= ...]]"
  let argObj = {}, lastOptional = null, lastPosition = argGroup.pos, foundEllipse = false; // Last encountered optional argument, found ellipse '...' ?
  if (argGroup.value.length === 1) {
    let args = argGroup.value[0].splitByCommas(false); // DO NOT do extra parsing - not required for function arguments
    if (args.length > 0 && args[args.length - 1].tokens.length === 0) args.pop();
    for (let arg of args) {
      if (arg.tokens.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected end of input at position ${lastPosition}`);
      let data = {}, ok = true, i = 0, param;

      // Collapse multiple arguments into array?
      if (arg.tokens[i].value === '...') {
        if (foundEllipse) throw new Error(`[${errors.SYNTAX}] Syntax Error: only one parameter may have '...' , found second at position ${arg.tokens[i].pos}`);
        data.ellipse = true;
        foundEllipse = true;
        i++;
      }
      // Optional?
      if (arg.tokens[i] instanceof OperatorToken && arg.tokens[i].value === '?') {
        data.optional = true;
        i++;
      }

      // Parameter name
      if (arg.tokens[i] === undefined || !(arg.tokens[i] instanceof VariableToken)) throw new Error(`[${errors.SYNTAX}] Syntax Error: expected parameter name, got ${arg.tokens[i]} at position ${arg.tokens[i]?.pos}`);
      else {
        param = arg.tokens[i];
        if (param.value in argObj) throw new Error(`[${errors.NAME}] Name Error: Duplicate parameter name '${param.value}' at position ${param.pos}`);
        if (data.optional) lastOptional = param.value;
        i++;
      }

      // Type information?
      if (arg.tokens[i] instanceof OperatorToken && arg.tokens[i].value === ':') {
        i++;

        // Pass-by type
        if (arg.tokens[i] instanceof VariableToken && (arg.tokens[i + 1] instanceof VariableToken || arg.tokens[i + 1] instanceof KeywordToken || (arg.tokens[i + 1] instanceof OperatorToken && arg.tokens[i + 1].value === '?'))) {
          if (arg.tokens[i].value === 'val' || arg.tokens[i].value === 'ref') {
            data.pass = arg.tokens[i].value;
            if (data.pass === 'ref' && data.optional) throw new Error(`[${errors.SYNTAX}] Syntax Error: optional parameter '${param.value}' cannot be marked as pass-by-reference (position ${arg.tokens[i].pos})`);
            i++;
          } else {
            throw new Error(`[${errors.SYNTAX}] Syntax Error: expected pass-by indicator, got ${arg.tokens[i].value} (position ${arg.tokens[i].pos})`);
          }
        }

        if (ok) {
          if (arg.tokens[i] === undefined) {
            throw new Error(`[${errors.SYNTAX}] Syntax Error: expected type indicator, got EOL${arg.tokens[i - 1] ? " (position " + arg.tokens[i - 1].pos + ")" : ""}`);
          } else if (arg.tokens[i] instanceof VariableToken || arg.tokens[i] instanceof KeywordToken) {
            data.type = arg.tokens[i].value;
            i++;
          } else {
            throw new Error(`[${errors.SYNTAX}] Syntax Error: expected type indicator, got ${arg.tokens[i].value} (position ${arg.tokens[i].pos})`);
          }
        }
      }

      // Default value?
      if (ok && arg.tokens[i]) {
        if (arg.tokens[i] instanceof OperatorToken && arg.tokens[i].value === '=') {
          i++;
          if (arg.tokens[i] instanceof Token) {
            if (data.pass === 'ref') throw new Error(`[${errors.SYNTAX}] Syntax Error: unexpected token '=' at position ${arg.tokens[i].pos}: ${data.pass} parameter '${param.value}' cannot have a default value`);
            data.optional = true;
            data.default = arg.tokens[i];
            if (data.default instanceof ValueToken) data.default = data.default.value;
            else if (data.default instanceof BracketedTokenLines) {
              data.default.prepare();
            }
            i++;
          } else ok = false;
        } else ok = false;
      }

      // Set parameter info
      if (ok && arg.tokens[i] !== undefined) ok = false;
      if (!ok) throw new Error(`[${errors.SYNTAX}] Syntax Error: FUNCTION: invalid syntax in parameter '${param.value}' at position ${param.pos}`);
      if (lastOptional && !data.optional) throw new Error(`[${errors.SYNTAX}] Syntax Error: required argument '${param.value}' cannot precede optional argument '${lastOptional}' (position ${param.pos})`);
      if (data.ellipse) {
        foundEllipse = true;
        if (!(data.pass === undefined || data.pass === 'val')) throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid pass-by type for '...' parameter '${param.value}' at ${param.pos}: ${data.pass}`);
      }
      lastPosition = arg.tokens[i - 1].pos;
      argObj[param.value] = data;
    }
  }
  return argObj;
}

module.exports = { Token, BracketToken, VariableToken, OperatorToken, TokenLine, KeywordToken, BracketedTokenLine: BracketedTokenLines, tokenify };