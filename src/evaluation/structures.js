const { errors } = require("../errors");
const { RunspaceUserFunction } = require("../runspace/Function");
const { expectedSyntaxError, peek, createEvalObj, propagateEvalObj } = require("../utils");
const { parseSymbol } = require("./parse");
const { FunctionRefValue, ArrayValue, SetValue, MapValue, UndefinedValue } = require("./values");

class Structure {
  constructor(name, pos) {
    this.name = name;
    this.pos = pos;
  }

  eval(evalObj) { throw new Error(`${this}.eval: overload required`); }
  validate() { throw new Error(`${this}.validate: overload required`); }

  toString() { return `<Structure ${this.name}>`; }
}

/** Structure to build an array */
class ArrayStructure extends Structure {
  constructor(rs, elements, pos) {
    super("ARRAY", pos);
    this.rs = rs;
    this.elements = elements;
  }

  validate() {
    this.elements.forEach(e => e.prepare());
  }

  async eval(evalObj) {
    const values = await Promise.all(this.elements.map(el => el.eval(evalObj)));
    return new ArrayValue(this.rs, values);
  }
}

/** Structure to build a Map */
class MapStructure extends Structure {
  constructor(rs, pos) {
    super("MAP", pos);
    this.rs = rs;
    this.keys = [];
    this.values = [];
  }

  /** key: Value. value: TokenLine */
  addPair(key, value) {
    this.keys.push(key);
    this.values.push(value);
  }

  validate() {
    if (this.keys.length !== this.values.length) throw new Error(`${this}: keys and values arrays must be equal lengths`);
    this.values.forEach(e => e.prepare());
  }

  async eval() {
    let map = new MapValue(this.rs);
    for (let i = 0; i < this.keys.length; i++) {
      map.__set__(this.keys[i], await this.values[i].eval(evalObj));
    }
    return map;
  }
}

/** Structure to build a set */
class SetStructure extends Structure {
  constructor(rs, elements, pos) {
    super("SET", pos);
    this.rs = rs;
    this.elements = elements;
  }

  validate() {
    this.elements.forEach(e => e.prepare());
  }

  async eval() {
    const values = await Promise.all(this.elements.map(el => el.eval(evalObj)));
    return new SetValue(this.rs, values);
  }
}

class IfStructure extends Structure {
  /**
   * @param conditionals - array of [condition: BracketedTokenLines, body: Block]
   * @param elseBlock - else block (Block)
   */
  constructor(pos, conditionals = [], elseBlock = undefined) {
    super("IF", pos);
    this.conditionals = conditionals;
    this.elseBlock = elseBlock;
  }

  /** condition - BracketedTokenLines. body - Block */
  addBranch(condition, block) {
    this.conditionals.push([condition, block]);
  }

  addElse(block) {
    this.elseBlock = block;
  }

  validate() {
    // Check that each condition only has ONE line
    for (const [condition, block] of this.conditionals) {
      if (condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
      if (condition.value.length > 1) throw new expectedSyntaxError(')', peek(condition.value[0].tokens));
      condition.prepare();
      block.prepare();
    }
    this.elseBlock?.prepare();
  }

  async eval(evalObj) {
    // Loop through conditionals...
    let foundTruthy = false, value;
    for (const [condition, block] of this.conditionals) {
      let cond = await condition.eval(evalObj);
      if (cond.toPrimitive("bool")) { // If conditon is truthy...
        foundTruthy = true;
        value = await block.eval(evalObj); // Evaluate code block
        break;
      }
    }
    if (!foundTruthy && this.elseBlock) { // If no condition was truthy and there is an else block...
      value = await this.elseBlock.eval(evalObj);
    }
    return value;
  }
}

class WhileStructure extends Structure {
  constructor(pos, condition = undefined, body = undefined) {
    super("WHILE", pos);
    this.condition = condition;
    this.body = body;
  }

  validate() {
    // Check that condition only has ONE line
    if (this.condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.condition.value.length > 1) throw new expectedSyntaxError(')', peek(this.condition.value[0].tokens));
    this.body.breakable = 1;
    this.body.prepare();
    this.condition.prepare();
  }

  async eval(evalObj) {
    let obj = createEvalObj(evalObj.blockID, evalObj.lineID);
    while (true) {
      let bool = await this.condition.eval(obj);
      if (!bool.toPrimitive("bool")) break;
      await this.body.eval(obj);

      if (obj.action === 1) break;
      else if (obj.action === 2) {
        obj.action = 0;
      } else if (obj.action === 3) {
        propagateEvalObj(obj, evalObj);
        break;
      }
    }
  }
}

class DoWhileStructure extends Structure {
  constructor(pos, condition = undefined, body = undefined) {
    super("DOWHILE", pos);
    this.condition = condition;
    this.body = body;
  }

  validate() {
    // Check that condition only has ONE line
    if (this.condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.condition.value.length > 1) throw new expectedSyntaxError(')', peek(this.condition.value[0].tokens));
    this.body.breakable = 1;
    this.body.prepare();
    this.condition.prepare();
  }

  async eval(evalObj) {
    let obj = createEvalObj(evalObj.blockID, evalObj.lineID);
    while (true) {
      await this.body.eval(obj);

      if (obj.action === 1) break;
      else if (obj.action === 2) {
        obj.action = 0;
      } else if (obj.action === 3) {
        propagateEvalObj(obj, evalObj);
        break;
      }

      let bool = await this.condition.eval(obj);
      if (!bool.toPrimitive("bool")) break;
    }
  }
}

class UntilStructure extends Structure {
  constructor(pos, condition = undefined, body = undefined) {
    super("UNTIL", pos);
    this.condition = condition;
    this.body = body;
  }

  validate() {
    // Check that condition only has ONE line
    if (this.condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.condition.value.length > 1) throw new expectedSyntaxError(')', peek(this.condition.value[0].tokens));
    this.body.breakable = 1;
    this.body.prepare();
    this.condition.prepare();
  }

  async eval(evalObj) {
    let obj = createEvalObj(evalObj.blockID, evalObj.lineID);
    while (true) {
      let bool = await this.condition.eval(obj);
      if (bool.toPrimitive("bool")) break;
      await this.body.eval(obj);

      if (obj.action === 1) break;
      else if (obj.action === 2) {
        obj.action = 0;
      } else if (obj.action === 3) {
        propagateEvalObj(obj, evalObj);
        break;
      }
    }
  }
}

class DoUntilStructure extends Structure {
  constructor(pos, condition = undefined, body = undefined) {
    super("DOUNTIL", pos);
    this.condition = condition;
    this.body = body;
  }

  validate() {
    // Check that condition only has ONE line
    if (this.condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.condition.value.length > 1) throw new expectedSyntaxError(')', peek(this.condition.value[0].tokens));
    this.body.breakable = 1;
    this.body.prepare();
    this.condition.prepare();
  }

  async eval(evalObj) {
    let obj = createEvalObj(evalObj.blockID, evalObj.lineID);
    while (true) {
      await this.body.eval(obj);

      if (obj.action === 1) break;
      else if (obj.action === 2) {
        obj.action = 0;
      } else if (obj.action === 3) {
        propagateEvalObj(obj, evalObj);
        break;
      }

      let bool = await this.condition.eval(obj);
      if (bool.toPrimitive("bool")) break;
    }
  }
}

class ForStructure extends Structure {
  constructor(pos, loop, body) {
    super("FOR", pos);
    this.loop = loop;
    this.body = body;
  }

  validate() {
    // LOOP must have 3 items
    if (this.loop.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got ) (FOR loop)`);
    if (this.loop.value.length < 2) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got end of input (FOR loop)`); // If step is empty, there will only be two TokenLine objects
    if (this.loop.value.length > 3) throw new expectedSyntaxError(')', peek(this.loop.value[2].tokens));
    this.loop.value.forEach(line => line.prepare());
    this.body.breakable = 1;
    this.body.prepare();
  }

  async eval(evalObj) {
    let obj = createEvalObj(evalObj.blockID, evalObj.lineID);
    await this.loop.value[0].eval(obj);
    if (this.loop.value[1].tokens.length <= 1) { // If empty (contains only ';') - infinite loop
      while (true) {
        await this.body.eval(obj);

        if (obj.action === 1) break;
        else if (obj.action === 2) {
          obj.action = 0;
        } else if (obj.action === 3) {
          propagateEvalObj(obj, evalObj);
          break;
        }

        await this.loop.value[2]?.eval(obj);
      }
    } else {
      while (true) {
        let cond = await this.loop.value[1].eval(obj);
        if (!cond.toPrimitive("bool")) break;
        await this.body.eval(obj);

        if (obj.action === 1) break;
        else if (obj.action === 2) {
          obj.action = 0;
        } else if (obj.action === 3) {
          propagateEvalObj(obj, evalObj);
          break;
        }

        await this.loop.value[2]?.eval(obj);
      }
    }
  }
}

class ForInStructure extends Structure {
  /** for (<vars> in <iter>) {<body>}. iter is a TokenLine. */
  constructor(pos, vars, iter, body) {
    super("FORIN", pos);
    this.vars = vars;
    this.iter = iter;
    this.body = body;
  }

  validate() {
    this.iter.prepare();
    this.body.breakable = 1;
    this.body.prepare();
  }

  async eval(evalObj) {
    let iter, obj = createEvalObj(evalObj.blockID, evalObj.lineID);
    try {
      iter = await this.iter.eval(obj);
      iter = iter.castTo("any");
    } catch (e) {
      throw new Error(`[${errors.SYNTAX}] FOR IN loop: error whilst evaluating iterator:\n${e}`);
    }

    if (typeof iter.__iter__ !== 'function') throw new Error(`[${errors.TYPE_ERROR}] Type ${iter.type()} is not iterable`);
    let collection = iter.__iter__();
    if (Array.isArray(collection[0])) {
      if (this.vars.length === 1) { // One var contains an array
        for (let i = 0; i < collection.length; i++) {
          this.body.rs.var(this.vars[0].value, new ArrayValue(this.body.rs, collection[i]));
          await this.body.eval(obj);

          if (obj.action === 1) break;
          else if (obj.action === 2) {
            obj.action = 0;
          } else if (obj.action === 3) {
            propagateEvalObj(obj, evalObj);
            break;
          }
        }
      } else { // Map every item in array to a variable
        if (this.vars.length !== collection[0].length) throw new Error(`[${errors.SYNTAX}] Syntax Error: FOR-IN: variable count mismatch: got ${this.vars.length}, expected ${collection[0].length} for type ${iter.type()}`);
        for (let i = 0; i < collection.length; i++) {
          for (let a = 0; a < this.vars.length; a++) {
            this.body.rs.var(this.vars[a].value, collection[i][a]);
          }
          await this.body.eval(obj);

          if (obj.action === 1) break;
          else if (obj.action === 2) {
            obj.action = 0;
          } else if (obj.action === 3) {
            propagateEvalObj(obj, evalObj);
            break;
          }
        }
      }
    } else {
      // Single-value for-in
      if (this.vars.length !== 1) throw new Error(`[${errors.SYNTAX}] Syntax Error: FOR-IN: variable count mismatch: got ${this.vars.length}, expected 1 for type ${iter.type()}`);
      for (let i = 0; i < collection.length; i++) {
        this.body.rs.var(this.vars[0].value, collection[i]);
        await this.body.eval(obj);

        if (obj.action === 1) break;
        else if (obj.action === 2) {
          obj.action = 0;
        } else if (obj.action === 3) {
          propagateEvalObj(obj, evalObj);
          break;
        }
      }
    }
  }
}

class FuncStructure extends Structure {
  constructor(pos, rs, args, body, name = undefined) {
    super("FUNC", pos);
    this.rs = rs;
    this.name = name;
    this.args = args;
    this.body = body;
  }

  validate() {
    if (this.args.value.length > 1) throw new expectedSyntaxError(')', peek(this.args.value[2].tokens));
    this.body.breakable = 0;
    this.body.returnable = 1; // Handle returns directly
    this.body.prepare();
  }

  async eval() {
    let argObj = {};
    if (this.args.value.length === 1) {
      let args = this.args.value[0].splitByCommas(false); // DO NOT do extra parsing - not required for function arguments
      for (let arg of args) {
        if (arg.tokens[0] === undefined || arg.tokens[0].constructor.name !== 'VariableToken') throw new Error(`[${errors.SYNTAX}] Syntax Error: expected parameter name, got ${arg.tokens[0]} at position ${arg.tokens[0]?.pos}`);
        if (arg.tokens.length === 1) { // "<arg>"
          argObj[arg.tokens[0].value] = 'any';
        } else if (arg.tokens.length === 3) { // "<arg>" ":" "<type>"
          if (arg.tokens[1].constructor.name === 'OperatorToken' && arg.tokens[1].value === ':' && arg.tokens[2].constructor.name === 'VariableToken') {
            argObj[arg.tokens[0].value] = arg.tokens[2].value;
          } else {
            throw new Error(`[${errors.SYNTAX}] Syntax Error: FUNCTION: invalid syntax`);
          }
        }
      }
    }

    let fn = new RunspaceUserFunction(this.rs, this.name ?? 'anonymous', argObj, this.body);
    let ref = new FunctionRefValue(this.rs, fn);
    let ret;

    if (this.name) { // Not anonymous - define function
      this.rs.var(fn.name, ref);
    } else {
      ref.func = fn; // Bind to reference
      ret = ref; // Return reference
    }
    ref.id = ref._genid();
    return ret;
  }
}

class LoopStructure extends Structure {
  constructor(pos, body) {
    super("LOOP", pos);
    this.body = body;
  }

  validate() {
    this.body.breakable = 1;
    this.body.prepare();
  }

  async eval(evalObj) {
    const obj = createEvalObj(evalObj.blockID, evalObj.lineID);

    while (true) {
      await this.body.eval(obj);

      if (obj.action === 1) break;
      else if (obj.action === 2) {
        obj.action = 0;
      } else if (obj.action === 3) {
        propagateEvalObj(obj, evalObj);
        break;
      }
    }
  }
}

class BreakStructure extends Structure {
  constructor(pos) {
    super("BREAK", pos);
  }

  validate() { }

  async eval(evalObj) {
    evalObj.action = 1; // Action for BREAK
  }
}

class ContinueStructure extends Structure {
  constructor(pos) {
    super("CONTINUE", pos);
  }

  validate() { }

  async eval(evalObj) {
    evalObj.action = 2; // Action for CONTINUE
  }
}

module.exports = {
  Structure,
  ArrayStructure, SetStructure, MapStructure,
  IfStructure,
  WhileStructure, DoWhileStructure, UntilStructure, DoUntilStructure, LoopStructure,
  ForStructure, ForInStructure,
  FuncStructure,
  BreakStructure, ContinueStructure,
};