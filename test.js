const Matrix = require("./src/maths/Matrix");

const mat = Matrix.fromString("1 3 -1; 0 1 7");
mat.toPrimitiveNumbers();
console.log("NORM:", mat.toString());
const mat2 = Matrix.toRowEchelonForm(mat);
console.log("REF: ", mat2.toString());
const mat3 = Matrix.toReducedRowEchelonForm(mat);
console.log("RREF:", mat3.toString());