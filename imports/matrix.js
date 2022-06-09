const { errors } = require("../src/errors");
const { isNumericType, isRealType, addType } = require("../src/evaluation/types");
const { Value, StringValue, NumberValue, BoolValue, ArrayValue, UndefinedValue } = require("../src/evaluation/values");
const Complex = require("../src/maths/Complex");
const { random } = require("../src/maths/functions");
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

  /** get() function */
  __get__(i) {
    let arr = i.toPrimitive('array').map(n => n.toPrimitive('real_int'));
    if (arr.length !== 2) throw new Error(`Matrix: expected [row, col] index, got array of length ${arr}`);
    if (arr[0] < 0) arr[0] = this.value.rows + arr[0];
    if (arr[1] < 0) arr[1] = this.value.cols + arr[1];
    let val = this.value.get(...arr);
    if (val === undefined) return new UndefinedValue(this.rs);
    val = new NumberValue(this.rs, val);
    val.onAssign = value => {
      this.value.set(...arr, value.toPrimitive('complex'));
      return value;
    };
    val.getAssignVal = () => this.value.get(...arr);
    return val;
  }

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
    if (isNumericType(t)) return new MatrixValue(this.rs, this.value.scalarDiv(arg.toPrimitive('complex')));
  }

  /** operator: ** */
  __pow__(exp) {
    if (isRealType(exp.type())) {
      exp = exp.toPrimitive("real_int");
      let mat = this.value.pow(exp);
      if (mat === undefined) throw new Error(`Matrix: cannot raise to negative powers bar -1`);
      return new MatrixValue(this.rs, mat);
    }
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

module.exports = (rs, pid) => {
  Value.typeMap[TYPE] = MatrixValue;
  addType(TYPE);

  ArrayValue.castMap.matrix = o => {
    if (isLegal(o)) {
      return new MatrixValue(o.rs, new Matrix(o.value.map(arr => arr.value.map(x => x.toPrimitive('complex')))));
    } else {
      throw new Error(`[${errors.TYPE}] Type Error: array is not a valid matrix - unable to cast to type matrix`);
    }
  };

  StringValue.castMap.matrix = o => new MatrixValue(o.rs, Matrix.fromString(o.toString()));

  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mrows', { m: 'matrix' }, ({ m }) => new NumberValue(rs, m.toPrimitive('matrix').rows), 'Matrix: get number of rows'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mcols', { m: 'matrix' }, ({ m }) => new NumberValue(rs, m.toPrimitive('matrix').cols), 'Matrix: get number of cols'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'morder', { m: 'matrix' }, ({ m }) => new ArrayValue(rs, [new NumberValue(rs, m.value.rows), new NumberValue(rs, m.value.cols)]), 'Matrix: return array [rows, cols]'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'midentity', { size: 'real_int' }, ({ size }) => new MatrixValue(rs, Matrix.identity(size.toPrimitive('real_int'))), 'Matrix: create new identity matrix'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mzeroes', { rows: 'real_int', cols: '?real_int' }, ({ rows, cols }) => {
    rows = rows.toPrimitive("real_int");
    return new MatrixValue(rs, cols === undefined ? Matrix.zeroes(rows, rows) : Matrix.zeroes(rows, cols.toPrimitive("real_int")));
  }, 'Matrix: create new zero-matrix'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mflatten', { m: 'matrix' }, ({ m }) => new ArrayValue(rs, m.toPrimitive('matrix').flatten().map(n => new NumberValue(rs, n))), 'Matrix: flatten a matrix into 1-D array'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mtrans', { m: 'matrix' }, ({ m }) => new MatrixValue(rs, m.toPrimitive('matrix').transpose()), 'Matrix: transpose (flip) a matrix'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mdet', { m: 'matrix' }, ({ m }) => new NumberValue(rs, m.toPrimitive('matrix').determinant()), 'Matrix: calculate determinant of given matrix'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mminor', { m: 'matrix', row: 'real_int', col: 'real_int' }, ({ m, row, col }) => {
    m = m.toPrimitive('matrix');
    row = row.toPrimitive('real_int');
    col = col.toPrimitive('real_int');
    let at = m.get(row, col);
    if (at === undefined) return new UndefinedValue(rs);
    return new MatrixValue(rs, m.getMinor(row, col));
  }, 'Matrix: get minor matrix from the current (row, col) position in matrix m'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mminors', { m: 'matrix' }, ({ m }) => new MatrixValue(rs, m.toPrimitive("matrix").getMinors()), 'Matrix: get matrix of minors from m'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mcheckerboard', { m: 'matrix', startSign: '?real_int' }, ({ m, startSign }) => new MatrixValue(rs, m.toPrimitive("matrix").checkerboard(startSign ? startSign.toPrimitive('real_int') : undefined)), 'Matrix: get checkerboard matrix (multiply by +, -, +, - ... throughout)'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mcofac', { m: 'matrix' }, ({ m }) => new MatrixValue(rs, m.toPrimitive('matrix').cofactors()), 'Matrix: calculate matrix of cofactors'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'minv', { m: 'matrix' }, ({ m }) => new MatrixValue(rs, m.toPrimitive('matrix').inverse()), 'Matrix: calculate inverse matrix'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mref', { m: 'matrix' }, ({ m }) => new MatrixValue(rs, Matrix.toRowEchelonForm(m.toPrimitive('matrix').toPrimitiveNumbers()).toComplexNumbers()), 'Matrix: transform to Row Echelon Form'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mrref', { m: 'matrix' }, ({ m }) => new MatrixValue(rs, Matrix.toReducedRowEchelonForm(m.toPrimitive('matrix').toPrimitiveNumbers()).toComplexNumbers()), 'Matrix: transform to Reduced Row Echelon Form'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mrneq', { m: 'matrix', value: '?complex' }, ({ m, value }) => new NumberValue(rs, m.toPrimitive('matrix').countNotRows(value ? value.toPrimitive("complex") : 0)), 'Matrix: count rows which do not contain <value> (default = 0)'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mrank', { m: 'matrix' }, ({ m }) => new NumberValue(rs, m.toPrimitive('matrix').rank()), 'Matrix: return rank of matrix (number of non-zero rows in matrix in RREF)'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mdot', { a: 'matrix', b: 'matrix' }, ({ a, b }) => new NumberValue(rs, Matrix.dot(a.toPrimitive("matrix"), b.toPrimitive("matrix"))), 'Matrix: Return dot product of two matrices'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mrand', { rows: 'real_int', cols: 'real_int', rMin: '?real', rMax: '?real' }, ({ rows, cols, rMin, rMax }) => {
    rows = rows.toPrimitive("real_int");
    cols = cols.toPrimitive("real_int");
    rMin = rMin ? rMin.toPrimitive("real") : undefined;
    rMax = rMax ? rMax.toPrimitive("real") : undefined;
    let arr = [];
    for (let r = 0; r < rows; ++r) {
      arr[r] = [];
      for (let c = 0; c < cols; ++c) {
        arr[r][c] = random(rMin, rMax);
      }
    }
    return new MatrixValue(rs, new Matrix(arr));
  }, 'Matrix: Return <rows>*<cols> matrix filled with random numbers equivalent to random(<rMin>, <rMax>)'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mmap', { m: 'matrix', fn: 'func' }, async ({ m, fn }, evalObj) => {
    m = m.toPrimitive("matrix");
    fn = fn.castTo("func").getFn();
    if (fn.argMin !== 1 && fn.argMin !== 3) throw new Error(`${errors.ARG_COUNT} Argument Error: expectf fn to take 1 or 3 arguments, got ${fn.signature()}`);
    const mat = m.copy();
    for (let r = 0; r < mat.rows; ++r) {
      const row = new NumberValue(rs, new Complex(r));
      for (let c = 0; c < mat.cols; ++c) {
        const col = new NumberValue(rs, new Complex(c));
        let ret = await fn.call(evalObj, fn.argMin === 1 ? [new NumberValue(rs, mat.get(r, c))] : [row, col, new NumberValue(rs, mat.get(r, c))]);
        mat.set(r, c, ret.toPrimitive('complex'));
      }
    }
    return new MatrixValue(rs, mat);
  }, 'Matrix: Go through each row/col of matrix and set to <complex>fn(currentValue) or <complex>fn(row, col, currentValue)'), pid);

  rs.defineVar('id2', new MatrixValue(rs, Matrix.identity(2)), '2 by 2 identity matrix', pid);
};