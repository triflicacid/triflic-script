const { errors } = require("../errors");
const { RunspaceUserFunction } = require("../runspace/Function");
const { expectedSyntaxError, peek, createEvalObj, propagateEvalObj, equal } = require("../utils");
const { FunctionRefValue, ArrayValue, SetValue, MapValue } = require("./values");

class Structure {
  constructor(rs, name, pos) {
    this.rs = rs;
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
    super(rs, "ARRAY", pos);
    this.elements = elements;
    this.assignment = false; // Is array being used in an assignment expression?
  }

  validate() {
    this.elements.forEach(e => e.prepare());
  }

  async eval(evalObj) {
    if (this.assignment) {
      let values = [];
      for (let i = 0; i < this.elements.length; i++) {
        let el = this.elements[i];
        if (el.tokens.length !== 1 || typeof el.tokens[0].getVarNoError !== 'function') throw new Error(`[${errors.SYNTAX}] Syntax Error: malformed array assignation expression. Expected array of symbols on lhs of expression at position ${this.pos}, member ${i}`);
        values.push(el.tokens[0]);
      }
      return new ArrayValue(this.rs, values, false);
    } else {
      let values = await Promise.all(this.elements.map(el => el.eval(evalObj)));
      return new ArrayValue(this.rs, values);
    }
  }
}

/** Structure to build a Map */
class MapStructure extends Structure {
  constructor(rs, pos) {
    super(rs, "MAP", pos);
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
      await map.__set__(evalObj, this.keys[i], await this.values[i].eval(evalObj));
    }
    return map;
  }
}

/** Structure to build a set */
class SetStructure extends Structure {
  constructor(rs, elements, pos) {
    super(rs, "SET", pos);
    this.elements = elements;
    this.assignment = false; // Is array being used in an assignment expression?
  }

  validate() {
    this.elements.forEach(e => e.prepare());
  }

  async eval(evalObj) {
    if (this.assignment) {
      let values = [];
      for (let i = 0; i < this.elements.length; i++) {
        let el = this.elements[i];
        if (el.tokens.length !== 1 || typeof el.tokens[0].getVarNoError !== 'function') throw new Error(`[${errors.SYNTAX}] Syntax Error: malformed map assignation expression. Expected set of symbols on lhs of expression at position ${this.pos}, member ${i}`);
        values.push(el.tokens[0]);
      }
      return new SetValue(this.rs, values);
    } else {
      let values = await Promise.all(this.elements.map(el => el.eval(evalObj)));
      return new SetValue(this.rs, values.map(v => v.castTo('any')));
    }
  }
}
class IfStructure extends Structure {
  /**
   * @param conditionals - array of [condition: BracketedTokenLines, body: Block]
   * @param thenBlock - else block (Block)
   */
  constructor(rs, pos, conditionals = [], thenBlock = undefined) {
    super(rs, "IF", pos);
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
    let foundTruthy = false, value, proc = this.rs.get_process(evalObj.pid);
    for (const [condition, block] of this.conditionals) {
      let cond = await condition.eval(evalObj);
      if (cond.toPrimitive("bool")) { // If conditon is truthy...
        foundTruthy = true;
        value = await block.eval(evalObj); // Evaluate code block
        break;
      }
      if (proc.state !== 1) return;
    }
    if (!foundTruthy && this.thenBlock) { // If no condition was truthy and there is an else block...
      value = await this.thenBlock.eval(evalObj);
    }
  }
}

class WhileStructure extends Structure {
  constructor(rs, pos, condition = undefined, body = undefined, thenBlock = undefined) {
    super(rs, "WHILE", pos);
    this.condition = condition;
    this.body = body;
    this.thenBlock = thenBlock;
  }

  validate() {
    // Check that condition only has ONE line
    if (this.condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.condition.value.length > 1) throw new expectedSyntaxError(')', peek(this.condition.value[0].tokens));
    this.body.breakable = 1;
    this.body.continueable = 1;
    this.body.prepare();
    this.condition.prepare();
    if (this.thenBlock) this.thenBlock.prepare();
  }

  async eval(evalObj) {
    let obj = createEvalObj(evalObj.blockID, evalObj.lineID, evalObj.pid), proc = this.rs.get_process(evalObj.pid);
    while (true) {
      let bool = await this.condition.eval(obj);
      if (!bool.toPrimitive("bool")) {
        if (this.thenBlock) await this.thenBlock.eval(obj);
        if (obj.action === 3) propagateEvalObj(obj, evalObj);
        break;
      }
      await this.body.eval(obj);

      if (proc.state !== 1) break;
      else if (obj.action === 1) {
        if (obj.actionValue) { // Propagate label'd breaks
          evalObj.action = 1;
          evalObj.actionValue = obj.actionValue;
        }
        break;
      } else if (obj.action === 2) {
        obj.action = 0;
      } else if (obj.action === 3) {
        propagateEvalObj(obj, evalObj);
        break;
      }
    }
  }
}

class DoWhileStructure extends Structure {
  constructor(rs, pos, condition = undefined, body = undefined, thenBlock = undefined) {
    super(rs, "DOWHILE", pos);
    this.condition = condition;
    this.body = body;
    this.thenBlock = thenBlock;
  }

  validate() {
    // Check that condition only has ONE line
    if (this.condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.condition.value.length > 1) throw new expectedSyntaxError(')', peek(this.condition.value[0].tokens));
    this.body.breakable = 1;
    this.body.continueable = 1;
    this.body.prepare();
    this.condition.prepare();
    if (this.thenBlock) this.thenBlock.prepare();
  }

  async eval(evalObj) {
    let obj = createEvalObj(evalObj.blockID, evalObj.lineID, evalObj.pid), proc = this.rs.get_process(evalObj.pid);
    while (true) {
      await this.body.eval(obj);

      if (proc.state !== 1) break;
      else if (obj.action === 1) {
        if (obj.actionValue) { // Propagate label'd breaks
          evalObj.action = 1;
          evalObj.actionValue = obj.actionValue;
        }
        break;
      } else if (obj.action === 2) {
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
  constructor(rs, pos, condition = undefined, body = undefined, thenBlock = undefined) {
    super(rs, "UNTIL", pos);
    this.condition = condition;
    this.body = body;
    this.thenBlock = thenBlock;
  }

  validate() {
    // Check that condition only has ONE line
    if (this.condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.condition.value.length > 1) throw new expectedSyntaxError(')', peek(this.condition.value[0].tokens));
    this.body.breakable = 1;
    this.body.continueable = 1;
    this.body.prepare();
    this.condition.prepare();
    if (this.thenBlock) this.thenBlock.prepare();
  }

  async eval(evalObj) {
    let obj = createEvalObj(evalObj.blockID, evalObj.lineID, evalObj.pid), proc = this.rs.get_process(evalObj.pid);
    while (true) {
      let bool = await this.condition.eval(obj);
      if (bool.toPrimitive("bool")) {
        if (this.thenBlock) await this.thenBlock.eval(obj);
        if (obj.action === 3) propagateEvalObj(obj, evalObj);
        break;
      }
      await this.body.eval(obj);

      if (proc.state !== 1) break;
      else if (obj.action === 1) {
        if (obj.actionValue) { // Propagate label'd breaks
          evalObj.action = 1;
          evalObj.actionValue = obj.actionValue;
        }
        break;
      } else if (obj.action === 2) {
        obj.action = 0;
      } else if (obj.action === 3) {
        propagateEvalObj(obj, evalObj);
        break;
      }
    }
  }
}

class DoUntilStructure extends Structure {
  constructor(rs, pos, condition = undefined, body = undefined, thenBlock = undefined) {
    super(rs, "DOUNTIL", pos);
    this.condition = condition;
    this.body = body;
    this.thenBlock = thenBlock;
  }

  validate() {
    // Check that condition only has ONE line
    if (this.condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.condition.value.length > 1) throw new expectedSyntaxError(')', peek(this.condition.value[0].tokens));
    this.body.breakable = 1;
    this.body.continueable = 1;
    this.body.prepare();
    this.condition.prepare();
    if (this.thenBlock) this.thenBlock.prepare();
  }

  async eval(evalObj) {
    let obj = createEvalObj(evalObj.blockID, evalObj.lineID, evalObj.pid), proc = this.rs.get_process(evalObj.pid);
    while (true) {
      await this.body.eval(obj);

      if (proc.state !== 1) break;
      else if (obj.action === 1) {
        if (obj.actionValue) { // Propagate label'd breaks
          evalObj.action = 1;
          evalObj.actionValue = obj.actionValue;
        }
        break;
      } else if (obj.action === 2) {
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
  constructor(rs, pos, loop, body, thenBlock = undefined) {
    super(rs, "FOR", pos);
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
    this.body.continueable = 1;
    this.body.prepare();
    if (this.thenBlock) this.thenBlock.prepare();
  }

  async eval(evalObj) {
    let obj = createEvalObj(evalObj.blockID, evalObj.lineID, evalObj.pid), proc = this.rs.get_process(evalObj.pid);
    await this.loop.value[0].eval(obj);
    if (this.loop.value[1].tokens.length <= 1) { // If empty (contains only ';') - infinite loop
      while (true) {
        await this.body.eval(obj);

        if (proc.state !== 1) break;
        else if (obj.action === 1) {
          if (obj.actionValue) { // Propagate label'd breaks
            evalObj.action = 1;
            evalObj.actionValue = obj.actionValue;
          }
          break;
        } else if (obj.action === 2) {
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

        if (proc.state !== 1) break;
        else if (obj.action === 1) {
          if (obj.actionValue) { // Propagate label'd breaks
            evalObj.action = 1;
            evalObj.actionValue = obj.actionValue;
          }
          break;
        }
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
  constructor(rs, pos, vars, iter, body) {
    super(rs, "FORIN", pos);
    this.vars = vars;
    this.iter = iter;
    this.body = body;
    this.thenBlock = undefined;
  }

  validate() {
    this.iter.prepare();
    this.body.breakable = 1;
    this.body.continueable = 1;
    this.body.prepare();
    if (this.thenBlock) this.thenBlock.prepare();
  }

  async eval(evalObj) {
    let iter, obj = createEvalObj(evalObj.blockID, evalObj.lineID, evalObj.pid), proc = this.rs.get_process(evalObj.pid);
    try {
      iter = await this.iter.eval(obj);
      iter = iter.castTo("any");
    } catch (e) {
      throw new Error(`[${errors.SYNTAX}] FOR IN loop: error whilst evaluating iterator:\n${e}`);
    }

    let collection = iter.__iter__ ? await iter.__iter__(evalObj) : undefined;
    if (!(collection instanceof ArrayValue)) throw new Error(`[${errors.TYPE_ERROR}] Type Error: Type ${iter.type()} is not iterable`);
    try {
      collection = collection.toPrimitive("array");
    } catch (e) {
      throw new Error(`[${errors.TYPE_ERROR}] Type Error: Type ${iter.type()} is not iterable\n${e}`);
    }
    if (collection.length === 0);
    else if (collection[0] instanceof ArrayValue) {
      if (this.vars.length === 1) { // One var contains an array
        let i = 0;
        while (true) {
          if (i >= collection.length) {
            if (this.thenBlock) await this.thenBlock.eval(obj);
            if (obj.action === 3) propagateEvalObj(obj, evalObj);
            break;
          }

          this.body.rs.defineVar(this.vars[0].value, collection[i], undefined, evalObj.pid);
          await this.body.eval(obj);

          if (proc.state !== 1) break;
          else if (obj.action === 1) {
            if (obj.actionValue) { // Propagate label'd breaks
              evalObj.action = 1;
              evalObj.actionValue = obj.actionValue;
            }
            break;
          } else if (obj.action === 2) {
            obj.action = 0;
          } else if (obj.action === 3) {
            propagateEvalObj(obj, evalObj);
            break;
          }

          i++;
        }
      } else { // Map every item in array to a variable
        try {
          collection = collection.map(a => a.toPrimitive("array"));
        } catch (e) {
          throw new Error(`[${errors.TYPE_ERROR}] Type Error: invalid iterator for type ${iter.type()}:\n${e}`);
        }
        if (this.vars.length !== collection[0].length) throw new Error(`[${errors.SYNTAX}] Syntax Error: FOR-IN: variable count mismatch: got ${this.vars.length}, expected ${collection[0].length} for type ${iter.type()}`);
        let i = 0;
        while (true) {
          if (i >= collection.length) {
            if (this.thenBlock) await this.thenBlock.eval(obj);
            if (obj.action === 3) propagateEvalObj(obj, evalObj);
            break;
          }

          for (let a = 0; a < this.vars.length; a++) {
            this.body.rs.defineVar(this.vars[a].value, collection[i][a], undefined, evalObj.pid);
          }
          await this.body.eval(obj);

          if (proc.state !== 1) break;
          else if (obj.action === 1) {
            if (obj.actionValue) { // Propagate label'd breaks
              evalObj.action = 1;
              evalObj.actionValue = obj.actionValue;
            }
            break;
          } else if (obj.action === 2) {
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

        this.body.rs.defineVar(this.vars[0].value, collection[i], undefined, evalObj.pid);
        await this.body.eval(obj);

        if (proc.state !== 1) break;
        else if (obj.action === 1) {
          if (obj.actionValue) { // Propagate label'd breaks
            evalObj.action = 1;
            evalObj.actionValue = obj.actionValue;
          }
          break;
        } else if (obj.action === 2) {
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
    super(rs, "FUNC", pos);
    this.name = name;
    this.args = args ?? {};
    this.body = body;
    this.returnType = 'any';
  }

  validate() {
    this.body.breakable = 0;
    this.body.continueable = 0;
    this.body.returnable = 2; // Handle returns directly
    this.body.prepare();
  }

  async eval(evalObj) {
    let fn = new RunspaceUserFunction(this.rs, this.name ?? 'anonymous', this.args, this.body, undefined, this.returnType);
    let ref = new FunctionRefValue(this.rs, fn);
    let ret;

    if (this.name) { // Not anonymous - define function
      this.rs.defineVar(fn.name, ref, undefined, evalObj.pid);
    } else {
      ref.func = fn; // Bind to reference
      ret = ref; // Return reference
    }
    return ret;
  }
}

class LoopStructure extends Structure {
  constructor(rs, pos, body) {
    super(rs, "LOOP", pos);
    this.body = body;
  }

  validate() {
    this.body.breakable = 1;
    this.body.continueable = 1;
    this.body.prepare();
  }

  async eval(evalObj) {
    const obj = createEvalObj(evalObj.blockID, evalObj.lineID, evalObj.pid), proc = this.rs.get_process(evalObj.pid);

    while (true) {
      await this.body.eval(obj);

      if (proc.state !== 1) break;
      else if (obj.action === 1) {
        if (obj.actionValue) { // Propagate label'd breaks
          evalObj.action = 1;
          evalObj.actionValue = obj.actionValue;
        }
        break;
      } else if (obj.action === 2) {
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
    this.label = undefined;
  }

  validate() { }

  async eval(evalObj) {
    evalObj.action = 1; // Action for BREAK
    evalObj.actionValue = this.label;
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
    let obj = createEvalObj(evalObj.blockID, evalObj.lineID, evalObj.pid);
    evalObj.action = 3; // Action for RETURN
    evalObj.actionValue = await this.expr.eval(obj);
  }
}

class SwitchStructure extends Structure {
  /**
   * @param query - query value in switch(<query>)
   * @param cases - array of [cases: BracketedTokenLines[], body: Block]
   * @param elseBlock - else block (Block)
   */
  constructor(rs, pos, query, cases = [], elseBlock = undefined) {
    super(rs, "SWITCH", pos);
    this.query = query;
    this.cases = cases;
    this.elseBlock = elseBlock;
  }

  addCase(conditions, block) {
    this.cases.push([conditions, block]);
  }

  addElse(block) {
    this.elseBlock = block;
  }

  validate() {
    if (this.query.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.query.value.length > 1) throw new expectedSyntaxError(')', peek(this.query.value[0].tokens));
    this.query.prepare();

    // Check that each case condition only has ONE line
    for (const [conditions, block] of this.cases) {
      for (const condition of conditions) {
        if (condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
        if (condition.value.length > 1) throw new expectedSyntaxError(')', peek(condition.value[0].tokens));
        condition.prepare();
      }
      block.breakable = 2;
      block.prepare();
    }
    if (this.elseBlock) this.elseBlock.prepare();
  }

  async eval(evalObj) {
    let query = await this.query.eval(evalObj), proc = this.rs.get_process(evalObj.pid);
    let enteredCase = false;
    let obj = createEvalObj(evalObj.blockID, evalObj.lineID, evalObj.pid);
    let lastVal;

    for (const [conditions, block] of this.cases) {
      for (const condition of conditions) {
        let value = await condition.eval(evalObj);
        if (equal(query, value)) {
          lastVal = await block.eval(obj);
          enteredCase = true;
        }

        if (enteredCase || proc.state !== 1) break;
        else if (obj.action === 1) {
          if (obj.actionValue) { // Propagate label'd breaks
            evalObj.action = 1;
            evalObj.actionValue = obj.actionValue;
          }
          break;
        } else if (obj.action === 2) {
          obj.action = 0;
        } else if (obj.action === 3) {
          propagateEvalObj(obj, evalObj);
          break;
        }
      }
    }

    if (this.elseBlock && !enteredCase) {
      lastVal = await this.elseBlock.eval(obj);
    }

    return lastVal;
  }
}

class LabelStructure extends Structure {
  /** label -> string */
  constructor(pos, rs, label) {
    super("LABEL", pos);
    this.rs = rs;
    this.label = label;
    this.bound = false;
  }

  validate() { }

  /** Define label in pre-evaluation */
  preeval(evalObj) {
    if (!this.bound) {
      evalObj.action = 4;
      evalObj.actionValue = this.label;
      this.bound = true;
    }
  }

  eval(evalObj) { }
}

class GotoStructure extends Structure {
  /** label -> string */
  constructor(pos, rs, label) {
    super("GOTO", pos);
    this.rs = rs;
    this.label = label;
  }

  validate() { }

  eval(evalObj) {
    evalObj.action = 5;
    evalObj.actionValue = this.label;
  }
}

/** Variable declartion: let */
class LetStructure extends Structure {
  /** symbol -> VariableToken */
  constructor(pos, rs, symbol) {
    super("LET", pos);
    this.rs = rs;
    this.symbol = symbol;
    this.type = undefined; // Type assertion
    this.variation = "single"; // single / array / set
  }

  validate() { }

  async eval(evalObj) {
    switch (this.variation) {
      case "array":
        for (let i = 0; i < this.symbol.length; i++) this.rs.defineVar(this.symbol[i].value, undefined, undefined, evalObj.pid);
        return new ArrayValue(this.rs, this.symbol, false); // Return array of un-evaluated symbols for expression purposes
      case "set":
        for (let i = 0; i < this.symbol.length; i++) this.rs.defineVar(this.symbol[i].value, undefined, undefined, evalObj.pid);
        return new SetValue(this.rs, this.symbol); // Return array of un-evaluated symbols for expression purposes
      default: {
        const v = this.rs.defineVar(this.symbol.value, undefined, undefined, evalObj.pid);
        v.type = this.type;
        return this.symbol;
      }
    }
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
  LabelStructure, GotoStructure,
  LetStructure,
};