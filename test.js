// let fs = require('fs');

// function getChar() {
//     let buffer = Buffer.alloc(1);
//     fs.readSync(0, buffer, 0, 1);
//     return buffer.toString('utf8');
// }

// console.log("--- START ---")
// console.log(getChar());
// console.log("--- END ---")

function func1(array, len) {
    let arr = [];
    for (let i = 0; i < len; i++) arr.unshift(array.pop());
    return arr;
}

function func2(array, len) {
    return array.splice(array.length - len);
}

let arr = Array.from({ length: 10 }, (_, i) => i);

for (let c = 1; c <= 3; c++) {
    console.log("*** %d ***", c);
    console.log(func1([...arr], c));
    console.log(func2([...arr], c));
}