const { UndefinedValue } = require("./values");
const { v4 } = require("uuid");

/** A Code block. */
class Block {
  constructor(rs, tokenLines, pos, parent = undefined) {
    this.id = v4();
    this.rs = rs;
    this.tokenLines = tokenLines;
    this.pos = pos;
    this.parent = parent;
  }

  eval() {
    // console.log("Evaluate block %s", this.id)
    let lastVal;
    for (let line of this.tokenLines) {
      line.block = this;
      line.parse();
      lastVal = line.eval();
    }
    return lastVal ?? new UndefinedValue(this.rs);
  }

  createChild(tokenLines, pos) {
    return new Block(this.rs, tokenLines, pos, this);
  }
}

module.exports = { Block };