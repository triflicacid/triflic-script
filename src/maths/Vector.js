const { errors } = require("../errors");
const Complex = require("./Complex");

class Vector {
    constructor(nums) {
        this.data = [];
        nums.forEach((n, i) => this.set(i, n));
    }

    /** Get value at index {i} */
    get(i) { return this.data[i]; }

    /** Set value at index {i} -> return boolean success */
    set(i, value) {
        if (i < 0) i = this.data.length + i;
        if (i < 0 || isNaN(i) || !isFinite(i)) return false;
        if (value === undefined) value = new Complex(0);
        else value = Complex.parse(value);
        if (i >= this.data.length) while (i >= this.data.length) this.data.push(new Complex(0));
        this.data[i] = value;
        return true;
    }

    /** Return size of vector */
    size() { return this.data.length; }

    /** Calculate absolute value */
    abs() {
        return Complex.sqrt(this.data.map(z => Complex.mult(z, z)).reduce((acc, curr) => Complex.add(acc, curr)));
    }

    toString() { return '{' + this.data.join(',') + '}'; }
}

/** Generate vector of size... */
Vector.create = function (size = 2) {
    return new Vector(Array.from({ length: size }).fill(0));
};

/** CHeck that vectors are the same size */
Vector.checkSize = function (v1, v2) {
    if (v1.size() !== v2.size()) throw new Error(`[${errors.BAD_ARG}] Vectors must be the same size`);
};

/** Add two vectors together: v1 + v2 */
Vector.add = function (v1, v2) {
    Vector.checkSize(v1, v2);
    return new Vector(v1.data.map((_, i) => Complex.add(v1.data[i], v2.data[i])));
};

/** Subtract two vectors: v1 - v2 */
Vector.sub = function (v1, v2) {
    Vector.checkSize(v1, v2);
    return new Vector(v1.data.map((_, i) => Complex.sub(v1.data[i], v2.data[i])));
};

/** Scalar multiplication */
Vector.scalarMult = function (v, n) {
    return new Vector(v.data.map(z => Complex.mult(z, n)));
};

module.exports = Vector;