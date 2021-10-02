const { toBinary, fromBinary } = require("./src/utils");

let n = 11, t = 'float64', bin = toBinary(n, t);
console.log("<%s> %s --> %s", t, n, bin);
n = fromBinary(bin, t);
console.log("%s --> <%s> %s", bin, t, n);