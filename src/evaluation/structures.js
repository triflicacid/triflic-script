const { errors } = require("../errors");
const { expectedSyntaxError, peek } = require("../utils");

class Structure {
  constructor(name, pos) {
    this.name = name;
    this.pos = pos;
  }

  eval() { throw new Error(`${this}.eval: overload required`); }
  validate() { throw new Error(`${this}.validate: overload required`); }

  toString() { return `<Structure ${this.name}>`; }
}

class IfStructure extends Structure {
  /**
   * @param conditionals - array of [condition: BracketedTokenLines, body: BracketedTokenLines]
   * @param elseBlock - else block
   */
  constructor(pos, conditionals = [], elseBlock = undefined) {
    super("IF", pos);
    this.conditionals = conditionals;
    this.elseBlock = elseBlock;
  }

  addBranch(condition, body) {
    this.conditionals.push([condition, body]);
  }

  addElse(block) {
    this.elseBlock = block;
  }

  validate() {
    // Check that each condition only has ONE line
    for (const [condition, block] of this.conditionals) {
      if (condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
      if (condition.value.length > 1) throw new expectedSyntaxError(')', peek(condition.value[0].tokens));
    }
  }

  eval() {
    // Loop through conditionals...
    let foundTruthy = false;
    for (const [condition, block] of this.conditionals) {
      let ret = condition.eval(), bool = ret.castTo("bool"); // Execute condition
      if (bool.value) { // If conditon is truthy...
        foundTruthy = true;
        block.eval(); // Evaluate code block
        break;
      }
    }
    if (!foundTruthy && this.elseBlock) { // If no condition was truthy and there is an else block...
      this.elseBlock.eval();
    }
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
  }

  eval() {
    while (this.condition.eval().toPrimitive("bool")) {
      this.body.eval();
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
  }

  eval() {
    while (true) {
      this.body.eval();
      if (!this.condition.eval().toPrimitive("bool")) break;
    }
  }
}

module.exports = { Structure, IfStructure, WhileStructure, DoWhileStructure };