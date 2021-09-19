// let fs = require('fs');

const { arrDifference, findIndex } = require("./src/utils");

// function getChar() {
//     let buffer = Buffer.alloc(1);
//     fs.readSync(0, buffer, 0, 1);
//     return buffer.toString('utf8');
// }

// console.log("--- START ---")
// console.log(getChar());
// console.log("--- END ---")

console.log(findIndex(3, [0, 1, 2]));
console.log(arrDifference([0, 1, 2], [1, 2, 3, 10]));