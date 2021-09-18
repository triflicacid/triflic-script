// let fs = require('fs');

const { sortObjectByLongestKey } = require("./src/utils");

// function getChar() {
//     let buffer = Buffer.alloc(1);
//     fs.readSync(0, buffer, 0, 1);
//     return buffer.toString('utf8');
// }

// console.log("--- START ---")
// console.log(getChar());
// console.log("--- END ---")

let obj = { a: 1, aaa: 2, aa: 3 };
console.log(obj);
obj = sortObjectByLongestKey(obj);
console.log(obj);