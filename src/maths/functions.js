const { sum } = require("../utils");
const Complex = require("./Complex");
const { lambertw_scalar } = require("./lambertw");


/**
 * @param {Complex} z 
 * @param {number} k 
 * @param {number} tol 
 * @returns {Complex}
 */
function lambertw(z, k = 0, tol = 1e-8) {
  z = Complex.assert(z);
  k = Complex.assert(k);
  tol = Complex.assert(tol);
  return lambertw_scalar(z, k.a, tol.a);
}

function factorial(n) {
  if (n === 0) return 1; // 0! = 1
  if (n < 1 || Math.floor(n) !== n) throw new Error(`Argument Error: factorial expects a positive integer, got ${n}`);
  let x = n--;
  for (; n > 1; n--) x *= n;
  return x;
}

/** Return LCF of the two numbers */
function LCF(n1, n2) {
  while (n1 !== n2) {
    if (n1 > n2) {
      n1 = n1 - n2;
    } else {
      n2 = n2 - n1;
    }
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

module.exports = { lambertw, factorial, LCF, primeFactors, isPrime, generatePrimes, mean, PMCC, variance, };