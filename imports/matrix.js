const { types, isNumericType } = require("../src/evaluation/types");
const { Value, StringValue, NumberValue, BoolValue, ArrayValue } = require("../src/evaluation/values");
const Matrix = require("../src/maths/Matrix");
const { RunspaceBuiltinFunction } = require("../src/runspace/Function");

const TYPE = "matrix";

class MatrixValue extends Value {
  constructor(rs, matrix) {
    super(rs, matrix ?? new Matrix());
  }

  type() { return TYPE; }

  /** function: abs() */
  __abs__() { return this.toPrimitive('matrix').determinant(); }

  __copy__() { return new MatrixValue(this.rs, Matrix.fromString(this.value.toString())); }

  /** Return array of array of rows */
  __iter__() { return [...this.value.matrix]; }

  /** operator: == */
  __eq__(arg) { return new BoolValue(this.rs, arg.type() === TYPE ? this.value.equals(arg.toPrimitive('matrix')) : false); }

  /** operator: + */
  __add__(arg) {
    const t = arg.type();
    if (t === 'matrix') return new MatrixValue(this.rs, Matrix.add(this.value, arg.value));
    if (isNumericType(t)) return new MatrixValue(this.rs, this.value.scalarAdd(arg.toPrimitive('complex')));
  }

  /** operator: - */
  __sub__(arg) {
    const t = arg.type();
    if (t === 'matrix') return new MatrixValue(this.rs, Matrix.sub(this.value, arg.value));
    if (isNumericType(t)) return new MatrixValue(this.rs, this.value.scalarSub(arg.toPrimitive('complex')));
  }

  /** operator: * */
  __mul__(arg) {
    const t = arg.type();
    if (t === 'matrix') return new MatrixValue(this.rs, Matrix.mult(this.value, arg.value));
    if (isNumericType(t)) return new MatrixValue(this.rs, this.value.scalarMult(arg.toPrimitive('complex')));
  }

  /** operator: / */
  __div__(arg) {
    const t = arg.type();
    // if (t === 'matrix') return new MatrixValue(this.rs, Matrix.add(this.value, arg.value));
    if (isNumericType(t)) return new MatrixValue(this.rs, this.value.scalarDiv(arg.toPrimitive('complex')));
  }
}

MatrixValue.castMap = {
  matrix: o => o,
  string: o => new StringValue(o.rs, o.value.toString()),
  array: o => new ArrayValue(o.rs, o.value.matrix.map(arr => new ArrayValue(o.rs, arr.map(n => new NumberValue(o.rs, n))))),
};

/** Same as Matrix.isLegal, but for Value classes */
function isLegal(arr) {
  if (arr.type() === 'array') {
    const parr = arr.toPrimitive('array');
    for (let ar of parr) {
      if (ar.type() === 'array') {
        if (!ar.toPrimitive('array').every(x => isNumericType(x.type()))) return false;
      } else {
        return false;
      }
    }
    return parr.every(a => a.value.length === parr[0].value.length);
  } else {
    return false;
  }
}

module.exports = rs => {
  Value.typeMap[TYPE] = MatrixValue;
  types[TYPE] = 13;

  ArrayValue.castMap.matrix = o => {
    if (isLegal(o)) {
      return new MatrixValue(o.rs, new Matrix(o.value.map(arr => arr.value.map(x => x.toPrimitive('complex')))));
    } else {
      throw new Error(`Type Error: array is not a valid matrix - unable to cast to type matrix`);
    }
  };

  StringValue.castMap.matrix = o => new MatrixValue(o.rs, Matrix.fromString(o.toString()));

  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mrows', { m: 'matrix' }, ({ m }) => new NumberValue(rs, m.toPrimitive('matrix').rows), 'Matrix: get number of rows'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mcols', { m: 'matrix' }, ({ m }) => new NumberValue(rs, m.toPrimitive('matrix').cols), 'Matrix: get number of cols'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'morder', { m: 'matrix' }, ({ m }) => new ArrayValue(rs, [new NumberValue(rs, m.value.rows), new NumberValue(rs, m.value.cols)]), 'Matrix: return array [rows, cols]'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'midentity', { size: 'real_int' }, ({ size }) => new MatrixValue(rs, Matrix.identity(size.toPrimitive('real_int'))), 'Matrix: create new identity matrix'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mflatten', { m: 'matrix' }, ({ m }) => new ArrayValue(rs, m.toPrimitive('matrix').flatten().map(n => new NumberValue(rs, n))), 'Matrix: flatten a matrix into 1-D array'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mtrans', { m: 'matrix' }, ({ m }) => new MatrixValue(rs, m.toPrimitive('matrix').transpose()), 'Matrix: transpose (flip) a matrix'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mdet', { m: 'matrix' }, ({ m }) => new NumberValue(rs, m.toPrimitive('matrix').determinant()), 'Matrix: calculate determinant of given matrix'));

  rs.defineVar('id2', new MatrixValue(rs, Matrix.identity(2)), '2 by 2 identity matrix', true);
  rs.defineVar('m1', new MatrixValue(rs, Matrix.fromString('1 2; 3 4')));
  rs.defineVar('m2', new MatrixValue(rs, Matrix.fromString('3 4; 2 1')));
};