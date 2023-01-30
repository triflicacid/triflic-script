/**
 * @prop a - Real component in 'a + bi' notation
 * @prop b - Imaginary component in 'a + bi' notation
 *
 * Thanks to http://scipp.ucsc.edu/~haber/archives/physics116A10/arc_10.pdf, https://en.wikipedia.org/wiki/Complex_number, https://www.youtube.com/channel/UC_SvYP0k05UKiJ_2ndB02IA
 */
class Complex {
  /**
   * Build a complex number in form 'a + bi', where a and b are real
   */
  constructor(a = 0, b = 0) {
    this.a = +a;
    this.b = +b;
  }
  /** Set oneself to value of argument */
  set(z_) {
    const z = Complex.parse(z_);
    this.a = z.a;
    this.b = z.b;
    return this;
  }
  /** Do we only have a real component? */
  isReal() {
    return this.b === 0;
  }
  /** Add a complex number to this: this = this + z */
  add(z_) {
    const z = Complex.parse(z_);
    this.a += z.a;
    this.b += z.b;
    return this;
  }
  /** Subtract a complex number from this: this = this - z */
  sub(z_) {
    const z = Complex.parse(z_);
    this.a -= z.a;
    this.b -= z.b;
    return this;
  }
  /** Return negation of this number. Return -a - bi */
  neg() {
    return new Complex(-this.a, -this.b);
  }
  /** Multiply by a complex number : this = this * z */
  mult(z_) {
    const z = Complex.parse(z_);
    let a = (this.a * z.a) - (this.b * z.b);
    let b = (this.a * z.b) + (this.b * z.a);
    this.a = a;
    this.b = b;
    return this;
  }
  /** Get magnitude of complex number on argand plane */
  getMag() {
    return Math.sqrt(Math.pow(this.a, 2) + Math.pow(this.b, 2));
  }
  /** Set magnitude of complex number on argand plane */
  setMag(r) {
    const θ = this.getArg();
    this.a = r * Math.cos(θ);
    this.b = r * Math.sin(θ);
    return this;
  }
  /** Get arg - angle between self and positive Real axis */
  getArg() {
    return Math.atan2(this.b, this.a);
  }
  /** Set arg - angle between self and positive Real axis */
  setArg(θ) {
    const r = this.getMag();
    this.a = r * Math.cos(θ);
    this.b = r * Math.sin(θ);
    return this;
  }
  /** Find complex conjugate (z*). Return as new Complex number. */
  conjugate() {
    return new Complex(this.a, -this.b);
  }
  /** Return reciprocal */
  reciprocal() {
    const a = this.a / (Math.pow(this.a, 2) + Math.pow(this.b, 2));
    const b = this.b / (Math.pow(this.a, 2) + Math.pow(this.b, 2));
    return new Complex(a, -b);
  }
  /** Divide by complex: this = this / w */
  div(z_) {
    const z = Complex.div(this, z_);
    this.a = z.a;
    this.b = z.b;
    return this;
  }
  /** CCalculate this % z */
  modulo(z_) {
    const z = Complex.modulo(this, z_);
    this.a = z.a;
    this.b = z.b;
    return this;
  }
  /** Raise to a power: this = this ^ z */
  pow(z_) {
    const z = Complex.pow(this, z_);
    this.a = z.a;
    this.b = z.b;
    return this;
  }
  /** Is this == z */
  equals(z_) {
    let z = Complex.parse(z_);
    return this.a === z.a && this.b === z.b;
  }
  toString(radix, ncase) {
    if (Complex.isNaN(this))
      return 'nan';
    if (this.a === 0 && this.b === 0)
      return '0';
    let str = '', string;
    if (ncase === "upper")
      string = z => z.toString(radix).toUpperCase();
    else if (ncase === "lower")
      string = z => z.toString(radix).toLowerCase();
    else
      string = z => z.toString(radix);
    if (this.a !== 0)
      str += isFinite(this.a) ? string(this.a) : 'inf';
    if (this.b !== 0) {
      if (this.b >= 0 && this.a !== 0)
        str += '+';
      if (this.b === -1)
        str += '-';
      else if (this.b !== 1)
        str += isFinite(this.b) ? string(this.b) : 'inf';
      str += Complex.imagLetter;
    }
    return str;
  }
  toLocaleString(locales, options) {
    if (Complex.isNaN(this))
      return 'nan';
    if (this.a === 0 && this.b === 0)
      return '0';
    let str = '';
    if (this.a !== 0)
      str += isFinite(this.a) ? this.a.toLocaleString(locales, options) : 'inf';
    if (this.b !== 0) {
      if (this.b >= 0 && this.a !== 0)
        str += '+';
      if (this.b === -1)
        str += '-';
      else if (this.b !== 1)
        str += isFinite(this.b) ? this.b.toLocaleString(locales, options) : 'inf';
      str += 'i';
    }
    return str;
  }
  toExponential(fdigits) {
    if (Complex.isNaN(this))
      return 'nan';
    if (this.a === 0 && this.b === 0)
      return '0';
    let str = '';
    if (this.a !== 0)
      str += isFinite(this.a) ? this.a.toExponential(fdigits) : 'inf';
    if (this.b !== 0) {
      if (this.b >= 0 && this.a !== 0)
        str += '+';
      if (this.b === -1)
        str += '-';
      else if (this.b !== 1)
        str += isFinite(this.b) ? this.b.toExponential(fdigits) : 'inf';
      str += 'i';
    }
    return str;
  }
  /** Return copy of this */
  copy() {
    return new Complex(this.a, this.b);
  }
  /** Is this truthy? */
  isTruthy() {
    if (this.b === 0)
      return !!this.a; // If b=0, truthiness depends on a
    if (this.a === 0)
      return !!this.b; // If b=0, truthiness depends on b
    return true; // Else, true
  }
  /** Return new complex number = a + b */
  static add(a_, b_) {
    const za = Complex.parse(a_);
    const zb = Complex.parse(b_);
    return new Complex(za.a + zb.a, za.b + zb.b);
  }
  /** Return new complex number = a - b */
  static sub(a_, b_) {
    const za = Complex.parse(a_);
    const zb = Complex.parse(b_);
    return new Complex(za.a - zb.a, za.b - zb.b);
  }
  /** Return new complex number = a * b */
  static mult(a_, b_) {
    const za = Complex.parse(a_);
    const zb = Complex.parse(b_);
    return new Complex((za.a * zb.a) - (za.b * zb.b), (za.a * zb.b) + (za.b * zb.a));
  }
  /** Return new complex number = a / b */
  static div(a_, b_) {
    const za = Complex.parse(a_);
    const zb = Complex.parse(b_);
    const denom = (zb.a * zb.a) + (zb.b * zb.b);
    let a = (za.a * zb.a) + (za.b * zb.b);
    let b = (za.b * zb.a) - (za.a * zb.b);
    return new Complex(a / denom, b / denom);
  }
  /** Return new complex number = a % b */
  static modulo(a, b) {
    const divb = Complex.div(a, b);
    const ans = Complex.sub(a, _zapply(divb, Math.floor).mult(b));
    return ans;
  }
  /** Return new complex number = a ^ b */
  static pow(a_, b_) {
    const za = Complex.parse(a_);
    const zb = Complex.parse(b_);
    // (a + bi) ^ (c + di)
    let a, b;
    if (zb.equals(0)) { // n^0
      a = 1;
      b = 0;
    }
    else if (zb.equals(1)) { // n^1
      a = za.a;
      b = za.b;
    }
    else if (za.equals(0) && zb.b === 0 && zb.a > 0) { // 0^n where n > 0 if 0 else NaN
      if (zb.b === 0 && zb.a > 0) {
        a = 0;
        b = 0;
      }
      else {
        a = NaN;
        b = NaN;
      }
    }
    else {
      const r = za.getMag(), θ = za.getArg();
      let common = Math.pow(r, zb.a) * Math.exp(-zb.b * θ); // Commong multiplier of both
      let value = (zb.a * θ) + (zb.b * Math.log(r)); // Commong value of trig functions
      a = common * Math.cos(value);
      b = common * Math.sin(value);
    }
    return new Complex(a, b);
  }
  /** Calculate sine of a complex number */
  static sin(z_) {
    let z = Complex.parse(z_);
    return new Complex(Math.sin(z.a) * Math.cosh(z.b), Math.cos(z.a) * Math.sinh(z.b));
  }
  /** Calculate hyperbolic sine of a complex number */
  static sinh(z_) {
    // sinh(a + bi) = sinh(a)cos(b) + cosh(a)sin(b)i
    const z = Complex.parse(z_);
    return new Complex(Math.sinh(z.a) * Math.cos(z.b), Math.cosh(z.a) * Math.sin(z.b));
  }
  /** Calculate hyperbolic arcsine of a number */
  static arcsinh(z_) {
    // arcsinh(z) = ln[z + |1 + z^2|^0.5 * e^((i/2) * arg(1 + z^2))]
    const z = Complex.parse(z_);
    let opz2 = Complex.add(1, Complex.mult(z, z)); // 1 + z^2
    return Complex.log(Complex.add(z, Complex.mult(Complex.pow(Complex.abs(opz2), 0.5), Complex.exp(Complex.div(Complex.I, 2).mult(opz2.getArg())))));
  }
  /** Calculate arcsine of a complex number */
  static arcsin(z_) {
    const z = Complex.parse(z_);
    let sqrt = new Complex(1 - Math.pow(z.a, 2) + Math.pow(z.b, 2), -2 * z.a * z.b).pow(0.5); // sqrt(1 - z^2)
    let ln = Complex.log(new Complex(-z.b + sqrt.a, z.a + sqrt.b)); // ln(iz + <sqrt>)
    let k = new Complex(0, -1); // -i
    return Complex.mult(k, ln); // <k> * <ln>
  }
  /** Calculate cosine of a complex number */
  static cos(z_) {
    const z = Complex.parse(z_);
    return new Complex(Math.cos(z.a) * Math.cosh(z.b), -1 * Math.sin(z.a) * Math.sinh(z.b));
  }
  /** Calculate hyperbolic cosine of a complex number */
  static cosh(z_) {
    // cosh(a + bi) = cosh(a)cos(b) + sinh(a)sin(b)i
    const z = Complex.parse(z_);
    return new Complex(Math.cosh(z.a) * Math.cos(z.b), Math.sinh(z.a) * Math.sin(z.b));
  }
  /** Calculate arccosine of a complex number */
  static arccos(z_) {
    const z = Complex.parse(z_);
    let sqrt = new Complex(Math.pow(z.a, 2) - Math.pow(z.b, 2) - 1, 2 * z.a * z.b).pow(0.5); // sqrt(z^2 - 1)
    let ln = Complex.log(new Complex(z.a + sqrt.a, z.b + sqrt.b)); // ln(z + <sqrt>)
    let k = new Complex(0, -1); // -i
    return Complex.mult(k, ln); // <k> * <ln>
  }
  /** Calculate hyperbolic arccosine of a number
  */
  static arccosh(z_) {
    // arccosh(z) = ln[z + |z^2 - 1|^0.5 * e^((i/2) * arg(z^2 - 1))]
    const z = Complex.parse(z_);
    let z2mo = Complex.sub(Complex.mult(z, z), 1); // z^2 - 1
    return Complex.log(Complex.add(z, Complex.mult(Complex.pow(Complex.abs(z2mo), 0.5), Complex.exp(Complex.div(Complex.I, 2).mult(z2mo.getArg())))));
  }
  /** Calculate tangent of a complex number */
  static tan(z_) {
    const z = Complex.parse(z_);
    return Complex.div(Complex.sin(z), Complex.cos(z));
  }
  /** Calculate hyperbolic tangent of a complex number */
  static tanh(z_) {
    // tanh(a + bi) = [sinh(2a) + sin(2b)i] / [cosh(2a) + cos(2b)]
    const z = Complex.parse(z_);
    return Complex.add(Math.sinh(2 * z.a), new Complex(0, Math.sin(2 * z.b))).div(Math.cosh(2 * z.a) + Math.cos(2 * z.b));
  }
  /** Calculate arctangent of a complex number */
  static arctan(z_) {
    // arctan(z) = 1/(2i) * ln[(1 + iz)/(1 - iz)]
    const z = Complex.parse(z_);
    const iz = Complex.mult(Complex.I, z);
    return Complex.mult(Complex.div(1, new Complex(0, 2)), Complex.log(Complex.div(Complex.add(1, iz), Complex.sub(1, iz))));
  }
  /** Calculate hyperbolic arctangent of a number */
  static arctanh(z_) {
    // arctanh(z) = (1/2)ln[(1+z)/(1-z)]
    const z = Complex.parse(z_);
    return Complex.mult(0.5, Complex.log(Complex.div(Complex.add(1, z), Complex.sub(1, z))));
  }
  /** Calculate log() of a complex number [natural log] */
  static log(z_) {
    const z = Complex.parse(z_);
    return new Complex(Math.log(z.getMag()), z.getArg());
  }
  /** Calculate log base a of b */
  static logab(a_, b_) {
    const a = Complex.parse(a_);
    const b = Complex.parse(b_);
    return Complex.div(Complex.log(b), Complex.log(a));
  }
  /** Is this not-a-number? */
  static isNaN(z_) {
    const z = Complex.parse(z_);
    return isNaN(z.a) || isNaN(z.b);
  }
  /** Is this finite? */
  static isFinite(z_) {
    const z = Complex.parse(z_);
    return isFinite(z.a) && isFinite(z.b);
  }
  /** Calculatemagnitude o a complex number */
  static abs(z_) {
    return Complex.parse(z_).getMag();
  }
  /** square root */
  static sqrt(z_) {
    const z = Complex.parse(z_);
    return Complex.pow(z, 0.5);
  }
  /** cube root */
  static cbrt(z_) {
    const z = Complex.parse(z_);
    return Complex.pow(z, 1 / 3);
  }
  /** Return ceiling of a number */
  static ceil(z_) {
    return _zapply(z_, Math.ceil);
  }
  /** Return floor of a number */
  static floor(z_) {
    return _zapply(z_, Math.floor);
  }
  /** Return rounded value of z to specified decimal places, or to whole integer */
  static round(z_, dp_) {
    if (dp_ === undefined)
      return _zapply(z_, Math.round);
    const z = Complex.parse(z_);
    const K = Math.pow(10, dp_);
    return new Complex(Math.round(z.a * K) / K, Math.round(z.b * K) / K);
  }
  /** Calculate Math.exp of a complex number */
  static exp(z_) {
    // exp(a + bi) = e^a * [ cos(b) + isin(b) ]
    const z = Complex.parse(z_);
    const ea = Math.exp(z.a); // e ^ a
    return new Complex(ea * Math.cos(z.b), ea * Math.sin(z.b));
  }
  /** Compare: is a == b? */
  static eq(a, b) {
    return a.a === b.a && a.b === b.b;
  }
  /**
   * Compare: is a > b?
   * - If Im(a) = Im(b) = 0, return Re(a) > Re(b)
   * - If Re(a) = Re(b) = 0, return Im(a) > Im(b)
   * - Else, return false
  */
  static gt(a, b) {
    if (a.b === 0 && b.b === 0)
      return a.a > b.a;
    if (a.a === 0 && b.a === 0)
      return a.b > b.b;
    return false;
  }
  /**
   * Compare: is a >= b?
   * - If Im(a) = Im(b) = 0, return Re(a) >= Re(b)
   * - If Re(a) = Re(b) = 0, return Im(a) >= Im(b)
   * - Else, return false
  */
  static ge(a, b) {
    if (a.b === 0 && b.b === 0)
      return a.a >= b.a;
    if (a.a === 0 && b.a === 0)
      return a.b >= b.b;
    return false;
  }
  /**
   * Compare: is a < b?
   * - If Im(a) = Im(b) = 0, return Re(a) < Re(b)
   * - If Re(a) = Re(b) = 0, return Im(a) < Im(b)
   * - Else, return false
  */
  static lt(a, b) {
    if (a.b === 0 && b.b === 0)
      return a.a < b.a;
    if (a.a === 0 && b.a === 0)
      return a.b < b.b;
    return false;
  }
  /**
   * Compare: is a <= b?
   * - If Im(a) = Im(b) = 0, return Re(a) <= Re(b)
   * - If Re(a) = Re(b) = 0, return Im(a) <= Im(b)
   * - Else, return false
  */
  static le(a, b) {
    if (a.b === 0 && b.b === 0)
      return a.a <= b.a;
    if (a.a === 0 && b.a === 0)
      return a.b <= b.b;
    return false;
  }
  /** Generate complex number from polar representation */
  static fromPolar(r, θ) {
    return new Complex(r * Math.cos(θ), r * Math.sin(θ));
  }
  /** Return complex unit */
  static get I() { return new Complex(0, 1); }
  /** Return not-a-number */
  static get NaN() { return new Complex(NaN, NaN); }
  /** Return infinity */
  static get Inf() { return new Complex(Infinity, Infinity); }
  /** Attempt to parse argument to a complex number */
  static parse(z) {
    if (z instanceof Complex)
      return z;
    if (typeof z === 'number' || typeof z === 'boolean')
      return new Complex(+z, 0);
    if (typeof z === 'bigint')
      return new Complex(Number(z), 0);
    if (typeof z === 'string') {
      let parts = z.split(/(?=[\-\+])/).map(x => x.trim()).filter(x => x.length > 0);
      let complex;
      if (parts.length === 1) {
        complex = new Complex(+parts[0], 0);
      }
      else if (parts.length === 2 && parts[1].indexOf('i') !== -1) {
        let imag = parts[1].replace('i', '');
        if (imag === '-' || imag === '+')
          imag += '1';
        complex = new Complex(+parts[0], +imag);
      }
      if (complex && !Complex.isNaN(complex))
        return complex;
    }
    throw new TypeError(`Expected Complex, got ${typeof z} ${z}`);
  }

  /** Make sure input may be casted to a complex number. Else, return false. */
  static is(value) {
    try {
      return Complex.parse(value);
    }
    catch (e) {
      return false;
    }
  }
}

// Apply a function to a complex number
function _zapply(arg, fn) {
  const z = Complex.parse(arg);
  z.a = fn(z.a);
  z.b = fn(z.b);
  return z;
}

Complex.imagLetter = "i";

module.exports = Complex;