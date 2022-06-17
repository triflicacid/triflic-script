const { RunspaceBuiltinFunction } = require("../src/runspace/Function");
const { MapValue, FunctionRefValue, ObjectValue, Value, StringValue } = require("../src/evaluation/values.js");
const { addType } = require("../src/evaluation/types");

module.exports = (rs, pid) => {
  class NumValue extends ObjectValue {
    constructor(rs, n) {
      super(rs);
      this.num = +n;
      this.instanceOf = NumObject;
    }
  }

  addType('number');
  Value.typeMap.number = NumValue;
  NumValue.castMap = {
    'string': x => new StringValue(rs, x.num.toString()),
  };
  let props = new Map();

  props.set("__call__", new FunctionRefValue(rs, new RunspaceBuiltinFunction(rs, "__call__", { arg: '?any' }, async ({ arg }, eo) => {
    return new NumValue(rs, arg ? await arg.toPrimitive('real', eo) : 0);
  })));
  props.set("__add__", new FunctionRefValue(rs, new RunspaceBuiltinFunction(rs, "__add__", { self: { type: 'number', }, a: { type: 'real' } }, async ({ self, a }, eo) => {
    return new NumValue(rs, self.num + a.value);
  })));
  let NumObject = new ObjectValue(rs, props);
  rs.defineVar('num', NumObject, undefined, pid);
};