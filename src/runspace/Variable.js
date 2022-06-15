class RunspaceVariable {
  constructor(name, value, desc = undefined) {
    this.name = name;
    this.value = value;
    this.desc = desc ?? '[no information]';
    this.refFor = undefined; // What is this a reference to? (update this variable on __assign__) (this is a RunspaceVariable)
  }
  castTo(type, evalObj) { return this.value.castTo(type, evalObj); }
  toPrimitive(type, evalObj) { return this.value.toPrimitive(type, evalObj); }
  copy() { return new RunspaceVariable(this.name, this.value, this.desc); }
  deepCopy() { return new RunspaceVariable(this.name, this.value.__copy__(), this.desc); }
}

module.exports = RunspaceVariable;