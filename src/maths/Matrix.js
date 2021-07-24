const Complex = require("./Complex");

/**
 * Represents a matrix (this.matrix is a 2-D array)
 * Each element is an instance of Complex
 */
class Matrix {
  /**
   * To create a matrix, use Matrix['from'...] methods
   * Sets value given durectly to <#Matrix>.matrix
   */
  constructor(m = undefined) {
    this.matrix = m ?? [];
    if (!Matrix.isLegal(this.matrix)) throw new Error(`new Matrix() :: Invalid matrix ${this.matrix}`);
  }

  get rows() { return this.matrix.length; }
  get cols() { return this.matrix.length === 0 ? 0 : this.matrix[0].length; }

  /** Get number in (row, col) */
  get(r, c) {
    return this.matrix[r][c];
  }

  /** Flatten matrix -> returns array */
  flatten() { return this.matrix.flat(); }

  /** Is this a square matrix? */
  isSquare() { return this.rows === this.cols; }

  /** Check if two matrices are equal */
  equals(arg) {
    return arg instanceof Matrix ? this.toString() === arg.toString() : false;
  }

  /** Return copy of matrix */
  copy() {
    return new Matrix(this.matrix.map(row => row.map(n => n.copy())));
  }

  /**
   * Apply a function to each item in the matrix. 
   * @param {(n: Complex, row: number, col: number) => Complex} fn
   * @returns {Matrix} New matrix
   */
  apply(fn) {
    return new Matrix(this.matrix.map((_, r) => this.matrix[r].map((_, c) => Complex.assert(fn(this.matrix[r][c], r, c)))));
  }

  /** Scalar adition: returns new Matrix */
  scalarAdd(n) {
    return this.apply(z => Complex.add(z, n));
  }

  /** Scalar subtraction: returns new Matrix */
  scalarSub(n) {
    return this.apply(z => Complex.sub(z, n));
  }

  /** Scalar multiplication: returns new Matrix */
  scalarMult(n) {
    return this.apply(z => Complex.mult(z, n));
  }

  /** Scalar division: returns new Matrix */
  scalarDiv(n) {
    return this.apply(z => Complex.div(z, n));
  }

  /** Transpose this matrix: returns new Matrix */
  transpose() {
    const ans = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!ans[c]) ans[c] = [];
        ans[c][r] = this.matrix[r][c];
      }
    }
    return new Matrix(ans);
  }

  /** Calculate the determinant */
  determinant() {
    return Matrix.determinant(this);
  }

  /** Return string representation as a flat string e.g "0 0 0; 0 0 0;" */
  toString() {
    return this.matrix.map(a => a.join(' ')).join('; ') + ';';
  }

  /** Return string representation as an array e.g [[0,0,0],[0,0,0]] */
  toArrayString() {
    return '[' + this.matrix.map(a => '[' + a.join(',') + ']').join(',') + ']';
  }
}

/** Create a matrix from dimensions and a fill value */
Matrix.fromDimensions = (rows, cols, value = 0) => new Matrix(Array.from({ length: cols }, () => new Array(rows).fill(value)));

/** Create a matrix from string: "v v v; v v v;" */
Matrix.fromString = string => {
  let arr = string.split(';').map(a => a.split(/\s/g).filter(a => a.length > 0).map(n => Complex.assert(n))).filter(a => a.length > 0);
  if (arr.length === 0) return new Matrix();
  let allNotNaN = arr.map(arr => arr.map(x => !Complex.isNaN(x)).every(x => x)).every(x => x);
  if (!allNotNaN) throw new Error(`Matrix string '${string}' :: invalid matrix string (found NaN value)`);
  let sameLength = arr.every(a => a.length === arr[0].length);
  if (!sameLength) throw new Error(`Matrix string '${string}' :: each row must be same length`);
  return new Matrix(arr);
};

/** Create a matrix from 1-D array */
Matrix.fromArray = (array, rows, cols) => {
  let marr = [], tmp = [];
  for (let i = 0, c = 1; i < array.length && marr.length < rows; i++) {
    tmp.push(array[i]);
    if (c === cols) {
      c = 1;
      marr.push(tmp);
      tmp = [];
    } else {
      c++;
    }
  }
  if (tmp.length > 0) marr.push(tmp);
  return new Matrix(marr);
};

/** Check if an array is a legal matrix? <array> allows caller to control what is defined as an array */
Matrix.isLegal = (arr, isArray = Array.isArray) => {
  if (isArray(arr)) {
    for (let ar of arr) {
      if (isArray(ar)) {
        if (!ar.every(x => !isArray(x))) return false;
      } else {
        return false;
      }
    }
    return arr.every(a => a.length === arr[0].length);
  } else {
    return false;
  }
};

/** Add two matrices: a + b */
Matrix.add = (a, b) => {
  if (a.rows === b.rows && a.cols === b.cols) {
    return new Matrix(a.matrix.map((_, r) => a.matrix[r].map((_, c) => Complex.add(a.matrix[r][c], b.matrix[r][c]))));
  } else {
    throw E_SAMESIZE;
  }
};

/** Subtract two matrices: a - b */
Matrix.sub = (a, b) => {
  if (a.rows === b.rows && a.cols === b.cols) {
    return new Matrix(a.matrix.map((_, r) => a.matrix[r].map((_, c) => Complex.sub(a.matrix[r][c], b.matrix[r][c]))));
  } else {
    throw E_SAMESIZE;
  }
};

/** Multiply two matrices together */
Matrix.mult = (a, b) => {
  if (a.cols === b.rows) {
    let aNumbers = [], bNumbers = [], bTmp = [], flat = [];

    // Expand matrix A and place values in array
    // [a, b; c, d] => [a, b, a, b, c, d, c, d]
    for (let c1 = 0; c1 < a.rows; c1++) {
      for (let c2 = 0; c2 < b.cols; c2++) {
        for (let c3 = 0; c3 < a.cols; c3++) {
          aNumbers.push(a.get(c1, c3));
        }
      }
    }

    // Expand matrix B and place in array
    // [a, b; c, d] -> [a, b, c, d, a, b, c, d]
    for (let c2 = 0; c2 < b.cols; c2++) {
      for (let c3 = 0; c3 < b.rows; c3++) {
        bTmp.push(b.get(c3, c2));
      }
    }
    for (let c1 = 0; c1 < b.cols; c1++) {
      for (let n of bTmp) {
        bNumbers.push(n);
      }
    }

    // Multiply corresponding elements of aNumbers and bNumbers together
    for (let c1 = 0, i = 0; c1 < aNumbers.length; c1 += b.rows) {
      let sum = new Complex(0);
      for (let c2 = 0; c2 < b.rows; c2++, i++) {
        sum.add(Complex.mult(aNumbers[i], bNumbers[i]));
      }
      flat.push(sum);
    }

    // Transform flat array into matrix
    return Matrix.fromArray(flat, a.rows, b.cols);
  } else {
    throw new Error(`Matrix: unable to multiply (a.cols != b.rows)`);
  }
};

/** Calculate the determinant of a matrix */
Matrix.determinant = (matrix, size = null) => {
  if (matrix.isSquare()) {
    size = size ?? matrix.rows;
    throw new Error(`Not Implemented`);
  } else {
    throw E_SQUARE;
  }
};

const E_SAMESIZE = new Error(`Matrix: given matrices must be the same size`);
const E_SQUARE = new Error(`Matrix: matrix must be square`);

/** Create an identity matrix */
Matrix.identity = size => new Matrix(Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => new Complex(r === c ? 1 : 0))));

module.exports = Matrix;