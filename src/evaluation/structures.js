class Structure {
  constructor(name, pos) {
    this.name = name;
    this.pos = pos;
  }

  eval() { throw new Error(`Structure.eval: overload required`); }

  toString() { return `<Structure ${this.name}>`; }
}

class IfStructure extends Structure {
  /**
   * @param conditionals - array of [condition, body]
   * @param elseBlock - else block
   */
  constructor(pos, conditionals = [], elseBlock = undefined) {
    super("IF", pos);
    this.conditionals = conditionals;
    this.elseBlock = elseBlock;
  }

  addBranch(condition, block) {
    this.conditionals.push([condition, block]);
  }

  addElse(block) {
    this.elseBlock = block;
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

  eval() {
    while (true) {
      this.body.eval();
      if (!this.condition.eval().toPrimitive("bool")) break;
    }
  }
}

module.exports = { Structure, IfStructure, WhileStructure, DoWhileStructure };