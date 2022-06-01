const { RunspaceBuiltinFunction } = require("../src/runspace/Function");
const { NumberValue, ArrayValue } = require("../src/evaluation/values.js");
const Complex = require("../src/maths/Complex");
const { sum } = require("../src/utils");

module.exports = (rs, ei) => {
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'logsumexp', { arr: 'array', w: '?any' }, ({ arr, w }) => {
    arr = arr.toPrimitive('array');
    w = w.castTo("any");
    let weights;
    if (w instanceof ArrayValue) {
      weights = w.toPrimitive('array').map(x => x.toPrimitive('complex'));
      if (weights.length !== arr.length) throw new Error(`Argument Error: <arr> and <w> must be of same array length`);
    } else {
      weights = new Array(arr.length).fill(w === undefined ? 1 : w.toPrimitive('complex'));
    }

    let array = arr.map((x, i) => Complex.exp(x.toPrimitive('complex')).mult(weights[i]));
    let total = sum(array);
    let log = Complex.log(total);
    return new NumberValue(rs, log);
  }, 'Calculate the logaithm of the sum of all elements in array raised to e and multiplied by a weight. <w> may be single number or an equal-sized array.'), ei.pid);
};