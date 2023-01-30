class RunspaceVariable {
  constructor(name, value, desc = undefined) {
    this.name = name;
    this.value = value;
    this.desc = desc ?? '[no information]';
    this.type = undefined; // Type assertion
    this.strict = false; // Is type assertion strict?
    this.refFor = undefined; // What is this a reference to? (update this variable on __assign__) (this is a RunspaceVariable)
  }
  castTo(type, evalObj) { return (this.refFor ? this.refFor : this.value).castTo(type, evalObj); }
  toPrimitive(type, evalObj) { return (this.refFor ? this.refFor : this.value).toPrimitive(type, evalObj); }
  copy() {
    const v = new RunspaceVariable(this.name, this.value, this.desc);
    v.type = this.type;
    v.refFor = this.refFor;
    return v;
  }
  deepCopy() { return new RunspaceVariable(this.name, this.value.__copy__(), this.desc); }
}

module.exports = RunspaceVariable;