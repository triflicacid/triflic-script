const { UndefinedValue } = require("./values");
const { v4 } = require("uuid");
const { createEvalObj } = require("../utils");

/**
 * A Code block.
 * breakable & returnable - can these keywords be used?
 * 0 -> No. 1 -> Propagation. 2 -> Direct use.
 */
class Block {
  constructor(rs, tokenLines, pos, parent = undefined) {
    this.id = v4();
    this.rs = rs;
    this.rs._blocks.set(this.id, this);
    this.tokenLines = tokenLines;
    this.pos = pos;
    this.parent = parent;

    this.breakable = (this.parent?.breakable) ? 1 : 0;
    this.returnable = (this.parent?.returnable) ? 1 : 0;
  }

  /** Prepare lines */
  prepare() {
    this.tokenLines.forEach(line => {
      line.block = this;
      line.prepare();
    });
  }

  async eval(evalObj, start = 0) {
    // console.log("Evaluate block %s", this.id)
    let lastVal;
    for (let l = start; l < this.tokenLines.length; l++) {
      let obj = createEvalObj(this.id, l);
      lastVal = await this.tokenLines[l].eval(obj);

      if (obj.action === 0) continue;
      else if (obj.action === 1) {
        // console.log("Break line %d in block %s", l, this.id)
        if (this.breakable === 1) evalObj.action = 1; // Propagate
        break; // break action
      } else if (obj.action === 2) {
        // console.log("Coninue line %d in block %s", l, this.id)
        if (this.breakable === 1) evalObj.action = 2;
        break;
      }
      else throw new Error(`FATAL: Unknown action '${obj.action}' in blockID=${obj.blockID}, lineID=${obj.lineID}`);
    }
    return lastVal ?? new UndefinedValue(this.rs);
  }

  createChild(tokenLines, pos) {
    return new Block(this.rs, tokenLines, pos, this);
  }
}

module.exports = { Block };