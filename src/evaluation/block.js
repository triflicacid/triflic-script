const { UndefinedValue, StringValue } = require("./values");
const { createEvalObj, propagateEvalObj } = require("../utils");

var currBlockID = 0;

/**
 * A Code block.
 * breakable & returnable - can these keywords be used?
 * 0 -> No. 1 -> Propagation. 2 -> Direct use.
 */
class Block {
  constructor(rs, tokenLines, pos, parent = undefined) {
    this.id = currBlockID++;
    this.rs = rs;
    this.rs.pushInstanceBlock(this);
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

  async preeval(evalObj) {
    for (let l = 0; l < this.tokenLines.length; l++) {
      const obj = this.createEvalObj(l);
      await this.tokenLines[l].preeval(obj);
      if (obj.action !== 0) {
        propagateEvalObj(obj, evalObj);
        break;
      }
    }
  }

  async eval(evalObj, start = 0) {
    let lastVal;
    for (let l = start; l < this.tokenLines.length; l++) {
      const obj = this.createEvalObj(l);
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
      } else if (obj.action === 3) {
        // console.log("Return line %d in block %s", l, this.id)
        if (this.returnable === 1) evalObj.action = 3;
        evalObj.actionValue = obj.actionValue;
        lastVal = obj.actionValue;
        break;
      } else if (obj.action === 4) {
        // console.log("Set label '%s'", obj.actionValue);
        evalObj.action = obj.action;
        evalObj.actionValue = obj.actionValue;
        break;
      }
      else throw new Error(`FATAL: Unknown action '${obj.action}' in block ${obj.blockID}, line ${obj.lineID}`);
    }
    return lastVal ?? new UndefinedValue(this.rs);
  }

  /** Create evaluation object , given a line number*/
  createEvalObj(lineNo) {
    return createEvalObj(this.id, lineNo);
  }

  /** Create child block */
  createChild(tokenLines, pos) {
    return new Block(this.rs, tokenLines, pos, this);
  }
}

module.exports = { Block };