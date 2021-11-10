const Matrix = require("./src/maths/Matrix");

const a = Matrix.fromString("1 2 3");
const b = Matrix.fromString("2 4 6");
const result = Matrix.dot(a, b);
console.log(result.toString());