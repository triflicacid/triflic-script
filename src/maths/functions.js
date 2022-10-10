const { sum } = require("../utils");
const Complex = require("./Complex");
const { TWO_PI } = require("./constants");
const { lambertw_scalar } = require("./lambertw");
const { wrightomega_ext } = require("./wright-omega");
const { zeta2 } = require("./zeta");

/**
 * @param {Complex} z 
 * @param {number} k 
 * @param {number} tol 
 * @returns {Complex}
 */
function lambertw(z, k = 0, tol = 1e-8) {
  z = Complex.parse(z);
  k = Complex.parse(k);
  tol = Complex.parse(tol);
  return lambertw_scalar(z, k.a, tol.a);
}

/**
 * @param {Complex} z 
 * @returns {Complex}
 */
function wrightomega(z) {
  const o = wrightomega_ext(z);
  return o.w;
}

/**
 * @param {number} x 
 * @param {number} q 
 */
function zeta(x, q = undefined) {
  return q === undefined ? NaN : zeta2(x, q);
}

/** Find the factorial of a REAL INTEGER using the classic algorithm */
function factorialReal(n) {
  if (n === 0) return 1; // 0! = 1
  if (n < 1 || Math.floor(n) !== n) throw new Error(`Argument Error: factorial expects a positive integer, got ${n}`);
  let x = n--;
  for (; n > 1; n--) x *= n;
  return x;
}

/** Return LCF of the two numbers */
function LCF(n1, n2) {
  let i = 0;
  while (n1 !== n2) {
    if (n1 > n2) {
      n1 = n1 - n2;
    } else {
      n2 = n2 - n1;
    }
    ++i;
    if (i > 1e7) return 1;
  }
  return n1;
}

/** Determine if the argument is prime */
function isPrime(n) {
  if (n === 1 || n === 0 || (n % 2 === 0 && Math.abs(n) > 2)) return false;
  const lim = Math.floor(Math.sqrt(n));
  for (let i = 3; i < lim; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

/** Generate prime factors of n */
function primeFactors(n) {
  let i = 2, factors = [];
  while (i * i <= n) {
    if (n % i) {
      i++;
    } else {
      n = Math.floor(n / i);
      factors.push(i);
    }
  }
  if (n > 1) factors.push(n);
  return factors;
}

/** Generate array of primes 0..limit */
function generatePrimes(limit) {
  const marks = new Array(limit + 1).fill(false);
  for (let i = 2; i * i <= limit; i++) {
    if (!marks[i]) { // If not prime...
      // Mark all multiples as non-prime
      for (let j = i * i; j <= limit; j += i) {
        marks[j] = true;
      }
    }
  }
  const primes = [];
  for (let i = 0; i <= limit; i++) {
    if (i > 1 && !marks[i]) {
      primes.push(i);
    }
  }
  return primes;
}

function random(a = undefined, b = undefined) {
  if (a === undefined && b === undefined) return Math.random();
  if (b === undefined) return Math.random() * a;
  return a + Math.random() * (b - a);
}

const mean = arr => sum(arr) / arr.length;
const PMCC = (x, y) => {
  if (x.length !== y.length) throw new Error(`Argument Error: input arrays must be same size`);
  const n = x.length;

  const ux = sum(x), uy = sum(y);
  const vx = sum(x.map(a => a * a)), vy = sum(y.map(a => a * a));
  const wxy = sum(x.map((_, i) => x[i] * y[i]));

  return (n * wxy - ux * uy) / Math.sqrt((n * vx - ux * ux) * (n * vy - uy * uy));
};
const variance = arr => {
  const m = mean(arr);
  return sum(arr.map(x => Math.pow(x - m, 2))) / arr.length;
};

// Constants for gamma()
const p = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

const gamma = (z, EPSILON = 1e-7) => {
  z = Complex.parse(z);
  let y;

  if (z.a < 0.5) {
    y = Complex.div(Math.PI, Complex.mult(Complex.sin(Complex.mult(Math.PI, z)), gamma(Complex.sub(1, z))));
  } else {
    z = Complex.sub(z, 1);
    let x = new Complex(0.99999999999980993);
    for (let i = 0; i < p.length; i++) {
      x.add(Complex.div(p[i], Complex.add(z, i).add(1)));
    }
    let t = Complex.add(z, p.length).sub(0.5);
    y = Complex.sqrt(2 * Math.PI).mult(Complex.pow(t, Complex.add(z, 0.5))).mult(Complex.exp(Complex.mult(t, -1))).mult(x);
  }

  return y.b <= EPSILON ? new Complex(y.a) : y; // Remove imaginary component is too small
};

const B = [1, 0.5];

function bernoulli(n) {
    if (B[n] !== undefined) return B[n];
    let sum = 1;
    let nfac = gamma(n + 1);
    for (let k = 0; k < n; k++) {
        sum -= (nfac / (gamma(k + 1) * gamma((n - k) + 1))) * (bernoulli(k) / (n - k + 1));
    }
    B[n] = sum;
    return sum;
}

/** Factorial using gamma function */
const factorial = n => gamma(Complex.add(n, 1));

/** Stirling's factorial */
const stirling = n => Complex.mult(Complex.sqrt(Complex.mult(TWO_PI, n)), Complex.pow(Complex.div(n, Math.E), n));

/* Return the next representable double from value towards next */
// https://stackoverflow.com/questions/27659675/get-next-smallest-nearest-number-to-a-decimal
function nextNearest(value, next) {
  if (isNaN(value) || isNaN(next)) return NaN;
  if (!isFinite(value)) return value;
  if (value === next) return value;

  let buffer = new ArrayBuffer(8);
  let f64 = new Float64Array(buffer);
  let u32 = new Uint32Array(buffer);

  f64[0] = value;

  if (value === 0) {
    u32[0] = 1;
    u32[1] = next < 0 ? 1 << 31 : 0;
  } else if ((value > 0) && (value < next) || (value < 0) && (value > next)) {
    if (u32[0]++ === 0xFFFFFFFF)
      u32[1]++;
  } else {
    if (u32[0]-- === 0)
      u32[1]--;
  }

  return f64[0];
}

/** Generate range between a..b */
function range(a, b, step = 1) {
  let range = [];
  if (a < b) {
    for (let n = a; n < b; n += step) range.push(n);
  } else {
    for (let n = a; n > b; n -= step) range.push(n);
  }
  return range;
}

module.exports = { bernoulli, lambertw, zeta, factorialReal, LCF, primeFactors, isPrime, generatePrimes, random, mean, PMCC, variance, gamma, factorial, stirling, nextNearest, wrightomega, range };