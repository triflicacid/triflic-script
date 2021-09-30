const { CharValue, NumberValue } = require("./src/evaluation/values");

let val = new NumberValue(null, 69);
console.log(val);
let char = val.toPrimitive('char');
console.log(char);
console.log(char.toString());