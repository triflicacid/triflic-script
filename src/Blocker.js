/** Class which indicates that the Blocke has been cancelled  */
export class BlockerCancelledError extends Error {
  constructor() {
    super(`CANCELLED`);
  }
}
/** Acts as a code block when called in async functions */
export class Blocker {
  constructor() {
    this._resolve = undefined;
    this._reject = undefined;
  }
  /** Are we currently blocking execution? */
  isBlocking() { return this._resolve !== undefined; }
  /** Use "await" on this line to block execution. */
  async block() {
    if (this.isBlocking()) {
      throw new Error(`#<Blocker>.block: cannot create new block as block is already in use`);
    }
    else {
      return new Promise((resolve, reject) => {
        this._resolve = resolve;
        this._reject = reject;
      });
    }
  }
  /** Forget what we were blocking (reject promise with special error) */
  forget() {
    this.error(new BlockerCancelledError());
  }
  /** Unblock code execution. Pass in value to blocked line. */
  unblock(value) {
    if (this.isBlocking()) {
      this._reject = undefined;
      this._resolve(value);
      this._resolve = undefined;
    }
    else {
      throw new Error(`#<Blocker>.unblock: nothing to unblock`);
    }
  }
  /** Throw an error at the block  */
  error(e) {
    if (this.isBlocking()) {
      this._resolve = undefined;
      this._reject(e);
      this._reject = undefined;
    }
    else {
      throw new Error(`#<Blocker>.error: no block available to throw error on`);
    }
  }
}

module.exports = { BlockerCancelledError, Blocker };