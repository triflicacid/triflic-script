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
    this.prepare();
  }

  /** Prepare lines */
  prepare() {
    this.tokenLines.forEach(line => {
      line.block = this;
      line.parse();
    });
  }

  async eval() {
    // console.log("Evaluate block %s", this.id)
    let lastVal;
    for (const line of this.tokenLines) {
      lastVal = await line.eval();
    }
    return lastVal ?? new UndefinedValue(this.rs);
  }

  createChild(tokenLines, pos) {
    return new Block(this.rs, tokenLines, pos, this);
  }
}

module.exports = { Block };