const { RunspaceBuiltinFunction } = require("../src/runspace/Function");
const { NumberValue } = require('../src/evaluation/values');
const { sum } = require("../src/utils");

module.exports = (rs, pid) => {
    rs.defineFunc(new RunspaceBuiltinFunction(rs, 'sum', { arr: 'array' }, ({ arr }) => new NumberValue(rs, sum(arr.toPrimitive('array').map(n => n.toPrimitive('complex')))), 'Find sum of an array of numbers'), pid);
};