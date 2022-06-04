const { UndefinedValue } = require("./values");
const { createEvalObj, propagateEvalObj } = require("../utils");
const { errors } = require("../errors");

var currBlockID = 0;

/**
 * A Code block.
 * breakable & returnable - can these keywords be used?
 * 0 -> No. 1 -> Propagation. 2 -> Direct use.
 */
class Block {
  constructor(rs, tokenLines, pos, pid, parent = undefined) {
    this.id = currBlockID++;
    this.rs = rs;
    this.pid = pid;
    rs.get_process(pid).blocks.set(this.id, this); // Register Block as valid code object
    this.tokenLines = tokenLines;
    this.pos = pos;
    this.parent = parent;
    this.labels = new Map(); // Label lookup map

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
      let obj = this.createEvalObj(l);
      obj.pid = evalObj.pid;
      await this.tokenLines[l].preeval(obj);
      if (obj.action !== 0) {
        if (obj.action === 4) {
          // console.log("Bind label '%s' to block %d", obj.actionValue, this.id)
          this.bindLabel(obj.actionValue, this.id, l);
          obj = this.createEvalObj(l);
          obj.pid = evalObj.pid;
        } else {
          propagateEvalObj(obj, evalObj);
          break;
        }
      }
    }
  }

  async eval(evalObj, start = 0) {
    let lastVal, proc = this.rs.get_process(this.pid);
    for (let l = start; l < this.tokenLines.length; l++) {
      let obj = this.createEvalObj(l);
      obj.pid = evalObj.pid;
      lastVal = await this.tokenLines[l].eval(obj);

      if (proc.state === 3) { // SIGKILL
        evalObj.action = -1;
        evalObj.actionValue = proc.stateValue;
        break;
      } else if (proc.state === 2) { // Error
        evalObj.action = -1;
        break;
      }
      else if (obj.action === 0) continue;
      else if (obj.action === 1) {
        // console.log("Break line %d in block %s", l, this.id)
        if (this.breakable === 1) {
          evalObj.action = 1; // Propagate
          break; // break action
        }
      } else if (obj.action === 2 && this.breakable) {
        // console.log("Coninue line %d in block %s", l, this.id)
        if (this.breakable) {
          evalObj.action = 2;
          break;
        }
      } else if (obj.action === 3) {
        // console.log("Return line %d in block %s", l, this.id)
        if (this.returnable > 0) {
          if (this.returnable === 1) evalObj.action = 3; // If === 2, handle directly and dont propagate
          evalObj.actionValue = obj.actionValue;
          lastVal = obj.actionValue;
          break;
        }
      } else if (obj.action === 5) {
        // console.log("GOTO label '%s'", obj.actionValue);
        const labelInfo = this.seekLabel(obj.actionValue);
        if (labelInfo === undefined) throw new Error(`[${errors.NAME}] Name Error: unbound label '${obj.actionValue}'`);
        const [blockID, lineID] = labelInfo;
        const block = this.rs.get_process(this.pid).blocks.get(blockID);
        if (!block) throw new Error(`FATAL: block with ID ${blockID} does not exist (label '${obj.actionValue}')`);
        obj = this.createEvalObj(l);
        obj.pid = evalObj.pid;
        // await block.preeval(obj);
        lastVal = await block.eval(obj, lineID + 1);
        evalObj.action = -2;
        break;
      } else { // Any other exit code: break and propagate
        propagateEvalObj(obj, evalObj);
        break;
      }
    }
    return lastVal ?? new UndefinedValue(this.rs);
  }

  /** Create evaluation object , given a line number*/
  createEvalObj(lineNo) {
    return createEvalObj(this.id, lineNo, this.pid);
  }

  /** Create child block */
  createChild(tokenLines, pos) {
    return new Block(this.rs, tokenLines, pos, this.pid, this);
  }

  /** Bind a label */
  bindLabel(label, blockID, lineID) {
    this.labels.set(label, [blockID, lineID]);
    if (this.parent) this.parent.bindLabel(label, blockID, lineID);
  }

  /** Seek a label */
  seekLabel(label) {
    if (this.labels.has(label)) return this.labels.get(label);
    if (this.parent) return this.parent.seekLabel(label);
    return undefined;
  }

  /** Return map of all labels */
  getAllLabels(m = undefined) {
    if (m === undefined) m = new Map(this.labels);
    else m = new Map([...this.labels, ...m]);
    if (this.parent) this.parent.getAllLabels(m);
    return m;
  }
}

module.exports = { Block };