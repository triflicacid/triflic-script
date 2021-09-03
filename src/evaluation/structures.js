const { errors } = require("../errors");
const { RunspaceUserFunction } = require("../runspace/Function");
const { expectedSyntaxError, peek } = require("../utils");
const { parseSymbol } = require("./parse");
const { FunctionRefValue } = require("./values");

class Structure {
  constructor(name, pos) {
    this.name = name;
    this.pos = pos;
  }

  eval(rs) { throw new Error(`${this}.eval: overload required`); }
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
  }

  eval() {
    while (!this.condition.eval().toPrimitive("bool")) {
      this.body.eval();
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
  }

  eval() {
    while (true) {
      this.body.eval();
      if (this.condition.eval().toPrimitive("bool")) break;
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
    if (this.loop.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.loop.value.length > 3) throw new expectedSyntaxError(')', peek(this.loop.value[2].tokens));
  }

  eval() {
    this.loop.value[0].eval();
    while (this.loop.value[1].eval().toPrimitive("bool")) {
      this.body.eval();
      this.loop.value[2].eval();
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
  }

  eval() {
    let argObj = {};
    if (this.args.value.length === 1) {
      let args = this.args.value[0].splitByCommas();
      for (let arg of args) {
        if (arg.tokens[0] === undefined || arg.tokens[0].constructor.name !== 'VariableToken') throw new Error(`[${errors.SYNTAX}] Syntax Error: expected parameter name, got ${arg.tokens[0]} at position ${arg.tokens[0]?.pos}`);
        if (arg.tokens.length === 1) { // "<arg>"
          argObj[arg.tokens[0].value] = 'any';
        } else if (arg.tokens.length === 3) { // "<arg>" ":" "<type>"
          if (arg.tokens[1].constructor.name === 'OperatorToken' && arg.tokens[1].value === ':' && arg.tokens[2].constructor.name === 'VariableToken') {
            argObj[arg.tokens[0].value] = arg.tokens[2].value;
          } else {
            throw new Error(`[${errors.SYNTAX}] Syntax Error: invalid syntax`);
          }
        }
      }
    }

    let ref = new FunctionRefValue(this.rs, this.name ?? 'anonymous');
    let fn = new RunspaceUserFunction(this.rs, ref.value, argObj, this.body);

    if (this.name) { // Not anonymous - define function
      this.rs.func(ref.value, fn);
      return;
    } else {
      ref.func = fn; // Bind to reference
      return ref; // Return reference
    }

  }
}

module.exports = { Structure, IfStructure, WhileStructure, DoWhileStructure, UntilStructure, DoUntilStructure, ForStructure, FuncStructure, };