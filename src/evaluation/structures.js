const { errors } = require("../errors");
const { RunspaceUserFunction } = require("../runspace/Function");
const { expectedSyntaxError, peek, createEvalObj, propagateEvalObj, equal } = require("../utils");
const { FunctionRefValue, ArrayValue, SetValue, MapValue } = require("./values");

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
    return new ArrayValue(this.rs, values.map(v => v.castTo('any')));
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

  async eval(evalObj) {
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

  async eval(evalObj) {
    const values = await Promise.all(this.elements.map(el => el.eval(evalObj)));
    return new SetValue(this.rs, values.map(v => v.castTo('any')));
  }
}
class IfStructure extends Structure {
  /**
   * @param conditionals - array of [condition: BracketedTokenLines, body: Block]
   * @param thenBlock - else block (Block)
   */
  constructor(pos, conditionals = [], thenBlock = undefined) {
    super("IF", pos);
    this.conditionals = conditionals;
    this.thenBlock = thenBlock;
  }

  /** condition - BracketedTokenLines. body - Block */
  addBranch(condition, block) {
    this.conditionals.push([condition, block]);
  }

  addElse(block) {
    this.thenBlock = block;
  }

  validate() {
    // Check that each condition only has ONE line
    for (const [condition, block] of this.conditionals) {
      if (condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
      if (condition.value.length > 1) throw new expectedSyntaxError(')', peek(condition.value[0].tokens));
      condition.prepare();
      block.prepare();
    }
    this.thenBlock?.prepare();
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
    if (!foundTruthy && this.thenBlock) { // If no condition was truthy and there is an else block...
      value = await this.thenBlock.eval(evalObj);
    }
    return value;
  }
}

class WhileStructure extends Structure {
  constructor(pos, condition = undefined, body = undefined, thenBlock = undefined) {
    super("WHILE", pos);
    this.condition = condition;
    this.body = body;
    this.thenBlock = thenBlock;
  }

  validate() {
    // Check that condition only has ONE line
    if (this.condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.condition.value.length > 1) throw new expectedSyntaxError(')', peek(this.condition.value[0].tokens));
    this.body.breakable = 1;
    this.body.prepare();
    this.condition.prepare();
    if (this.thenBlock) this.thenBlock.prepare();
  }

  async eval(evalObj) {
    let obj = createEvalObj(evalObj.blockID, evalObj.lineID);
    while (true) {
      let bool = await this.condition.eval(obj);
      if (!bool.toPrimitive("bool")) {
        if (this.thenBlock) await this.thenBlock.eval(obj);
        if (obj.action === 3) propagateEvalObj(obj, evalObj);
        break;
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
}

class DoWhileStructure extends Structure {
  constructor(pos, condition = undefined, body = undefined, thenBlock = undefined) {
    super("DOWHILE", pos);
    this.condition = condition;
    this.body = body;
    this.thenBlock = thenBlock;
  }

  validate() {
    // Check that condition only has ONE line
    if (this.condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.condition.value.length > 1) throw new expectedSyntaxError(')', peek(this.condition.value[0].tokens));
    this.body.breakable = 1;
    this.body.prepare();
    this.condition.prepare();
    if (this.thenBlock) this.thenBlock.prepare();
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
      if (!bool.toPrimitive("bool")) {
        if (this.thenBlock) await this.thenBlock.eval(obj);
        if (obj.action === 3) propagateEvalObj(obj, evalObj);
        break;
      }
    }
  }
}

class UntilStructure extends Structure {
  constructor(pos, condition = undefined, body = undefined, thenBlock = undefined) {
    super("UNTIL", pos);
    this.condition = condition;
    this.body = body;
    this.thenBlock = thenBlock;
  }

  validate() {
    // Check that condition only has ONE line
    if (this.condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.condition.value.length > 1) throw new expectedSyntaxError(')', peek(this.condition.value[0].tokens));
    this.body.breakable = 1;
    this.body.prepare();
    this.condition.prepare();
    if (this.thenBlock) this.thenBlock.prepare();
  }

  async eval(evalObj) {
    let obj = createEvalObj(evalObj.blockID, evalObj.lineID);
    while (true) {
      let bool = await this.condition.eval(obj);
      if (bool.toPrimitive("bool")) {
        if (this.thenBlock) await this.thenBlock.eval(obj);
        if (obj.action === 3) propagateEvalObj(obj, evalObj);
        break;
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
}

class DoUntilStructure extends Structure {
  constructor(pos, condition = undefined, body = undefined, thenBlock = undefined) {
    super("DOUNTIL", pos);
    this.condition = condition;
    this.body = body;
    this.thenBlock = thenBlock;
  }

  validate() {
    // Check that condition only has ONE line
    if (this.condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.condition.value.length > 1) throw new expectedSyntaxError(')', peek(this.condition.value[0].tokens));
    this.body.breakable = 1;
    this.body.prepare();
    this.condition.prepare();
    if (this.thenBlock) this.thenBlock.prepare();
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
      if (bool.toPrimitive("bool")) {
        if (this.thenBlock) await this.thenBlock.eval(obj);
        if (obj.action === 3) propagateEvalObj(obj, evalObj);
        break;
      }
    }
  }
}

class ForStructure extends Structure {
  constructor(pos, loop, body, thenBlock = undefined) {
    super("FOR", pos);
    this.loop = loop;
    this.body = body;
    this.thenBlock = thenBlock;
  }

  validate() {
    // LOOP must have 3 items
    if (this.loop.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got ) (FOR loop)`);
    if (this.loop.value.length < 2) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got end of input (FOR loop)`); // If step is empty, there will only be two TokenLine objects
    if (this.loop.value.length > 3) throw new expectedSyntaxError(')', peek(this.loop.value[2].tokens));
    this.loop.value.forEach(line => line.prepare());
    this.body.breakable = 1;
    this.body.prepare();
    if (this.thenBlock) this.thenBlock.prepare();
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
        if (!cond.toPrimitive("bool")) {
          if (this.thenBlock) await this.thenBlock.eval(obj);
          if (obj.action === 3) propagateEvalObj(obj, evalObj);
          break;
        }
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
    this.thenBlock = undefined;
  }

  validate() {
    this.iter.prepare();
    this.body.breakable = 1;
    this.body.prepare();
    if (this.thenBlock) this.thenBlock.prepare();
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
        let i = 0;
        while (true) {
          if (i >= collection.length) {
            if (this.thenBlock) await this.thenBlock.eval(obj);
            if (obj.action === 3) propagateEvalObj(obj, evalObj);
            break;
          }

          this.body.rs.defineVar(this.vars[0].value, new ArrayValue(this.body.rs, collection[i]));
          await this.body.eval(obj);

          if (obj.action === 1) break;
          else if (obj.action === 2) {
            obj.action = 0;
          } else if (obj.action === 3) {
            propagateEvalObj(obj, evalObj);
            break;
          }

          i++;
        }
      } else { // Map every item in array to a variable
        if (this.vars.length !== collection[0].length) throw new Error(`[${errors.SYNTAX}] Syntax Error: FOR-IN: variable count mismatch: got ${this.vars.length}, expected ${collection[0].length} for type ${iter.type()}`);
        let i = 0;
        while (true) {
          if (i >= collection.length) {
            if (this.thenBlock) await this.thenBlock.eval(obj);
            if (obj.action === 3) propagateEvalObj(obj, evalObj);
            break;
          }

          for (let a = 0; a < this.vars.length; a++) {
            this.body.rs.defineVar(this.vars[a].value, collection[i][a]);
          }
          await this.body.eval(obj);

          if (obj.action === 1) break;
          else if (obj.action === 2) {
            obj.action = 0;
          } else if (obj.action === 3) {
            propagateEvalObj(obj, evalObj);
            break;
          }

          i++;
        }
      }
    } else {
      // Single-value for-in
      if (this.vars.length !== 1) throw new Error(`[${errors.SYNTAX}] Syntax Error: FOR-IN: variable count mismatch: got ${this.vars.length}, expected 1 for type ${iter.type()}`);
      let i = 0;
      while (true) {
        if (i >= collection.length) {
          if (this.thenBlock) await this.thenBlock.eval(obj);
          if (obj.action === 3) propagateEvalObj(obj, evalObj);
          break;
        }

        this.body.rs.defineVar(this.vars[0].value, collection[i]);
        await this.body.eval(obj);

        if (obj.action === 1) break;
        else if (obj.action === 2) {
          obj.action = 0;
        } else if (obj.action === 3) {
          propagateEvalObj(obj, evalObj);
          break;
        }

        i++;
      }
    }
  }
}

class FuncStructure extends Structure {
  /** args - { [arg: string]: string }. body = Block */
  constructor(pos, rs, args, body, name = undefined) {
    super("FUNC", pos);
    this.rs = rs;
    this.name = name;
    this.args = args ?? {};
    this.body = body;
  }

  validate() {
    this.body.breakable = 0;
    this.body.returnable = 2; // Handle returns directly
    this.body.prepare();
  }

  async eval(evalObj) {
    let fn = new RunspaceUserFunction(this.rs, this.name ?? 'anonymous', this.args, this.body);
    let ref = new FunctionRefValue(this.rs, fn);
    let ret;

    if (this.name) { // Not anonymous - define function
      this.rs.defineVar(fn.name, ref);
    } else {
      ref.func = fn; // Bind to reference
      ret = ref; // Return reference
    }
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

class ReturnStructure extends Structure {
  /** expression -> TokenLine */
  constructor(pos, expression) {
    super("RETURN", pos);
    this.expr = expression;
  }

  validate() {
    this.expr.prepare();
  }

  async eval(evalObj) {
    let obj = createEvalObj(evalObj.blockID, evalObj.lineID);
    evalObj.action = 3; // Action for RETURN
    evalObj.actionValue = await this.expr.eval(obj);
  }
}

class SwitchStructure extends Structure {
  /**
   * @param query - query value in switch(<query>)
   * @param cases - array of [case: BracketedTokenLines, body: Block]
   * @param elseBlock - else block (Block)
   */
  constructor(pos, query, cases = [], elseBlock = undefined) {
    super("SWITCH", pos);
    this.query = query;
    this.cases = cases;
    this.elseBlock = elseBlock;
  }

  addCase(condition, block) {
    this.cases.push([condition, block]);
  }

  addElse(block) {
    this.elseBlock = block;
  }

  validate() {
    if (this.query.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.query.value.length > 1) throw new expectedSyntaxError(')', peek(this.query.value[0].tokens));
    this.query.prepare();

    // Check that each case condition only has ONE line
    for (const [condition, block] of this.cases) {
      if (condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
      if (condition.value.length > 1) throw new expectedSyntaxError(')', peek(condition.value[0].tokens));
      condition.prepare();
      block.breakable = 1;
      block.prepare();
    }
    if (this.elseBlock) this.elseBlock.prepare();
  }

  async eval(evalObj) {
    let query = await this.query.eval(evalObj);
    let enteredCase = false;
    let obj = createEvalObj(evalObj.blockID, evalObj.lineID);
    let lastVal;

    for (const [condition, block] of this.cases) {
      let value = await condition.eval(evalObj);
      if (equal(query, value)) {
        lastVal = await block.eval(obj);
        enteredCase = true;
      }

      if (enteredCase || obj.action === 1) break;
      else if (obj.action === 2) {
        obj.action = 0;
      } else if (obj.action === 3) {
        propagateEvalObj(obj, evalObj);
        break;
      }
    }

    if (this.elseBlock && !enteredCase) {
      lastVal = await this.elseBlock.eval(obj);
    }

    return lastVal;
  }
}

module.exports = {
  Structure,
  ArrayStructure, SetStructure, MapStructure,
  IfStructure, SwitchStructure,
  WhileStructure, DoWhileStructure, UntilStructure, DoUntilStructure, LoopStructure,
  ForStructure, ForInStructure,
  FuncStructure,
  BreakStructure, ContinueStructure, ReturnStructure,
};