const Matrix = require("./src/maths/Matrix");

const mat = Matrix.fromString("9 3 4; 4 3 4; 1 1 1;");
console.log("NORM:", mat.toString());
const mat2 = Matrix.toRowEchelonForm(mat);
console.log("REF: ", mat2.toString());
const mat3 = Matrix.toReducedRowEchelonForm(mat);
console.log("RREF:", mat3.toString());