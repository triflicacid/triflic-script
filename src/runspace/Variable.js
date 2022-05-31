class RunspaceVariable {
  constructor(name, value, desc = undefined) {
    this.name = name;
    this.value = value;
    this.desc = desc ?? '[no information]';
    this.refFor = undefined; // What is this a reference to? (update this variable on __assign__) (this is a RunspaceVariable)
  }
  castTo(type) { return this.value.castTo(type); }
  toPrimitive(type) { return this.value.toPrimitive(type); }
  copy() { return new RunspaceVariable(this.name, this.value, this.desc); }
}

module.exports = RunspaceVariable;