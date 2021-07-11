const Complex = require("./Complex");
const readline = require("readline");

const STDIN = process.stdin, STDOUT = process.stdout;

/** Get user input from STDIN */
async function input(msg = '') {
  const instance = readline.createInterface({
    input: STDIN,
    output: STDOUT
  });
  return new Promise(function (resolve, reject) {
    instance.question(msg, x => {
      instance.close();
      resolve(x);
    });
  });
}

/** Print */
function print(...args) {
  console.log(...args);
}

const isDigit = x => x >= "0" && x <= "9";

const peek = a => a[a.length - 1];

function factorial(n) {
  if (n === 0) return 1; // 0! = 1
  if (n < 1 || Math.floor(n) !== n) throw new Error(`Argument Error: factorial expects a positive integer, got ${n}`);
  let x = n--;
  for (; n > 1; n--) x *= n;
  return x;
}

/** Check that all input variables are real */
function assertReal(...args) {
  for (let arg of args) {
    arg = Complex.assert(arg);
    if (!arg.isReal()) throw new Error(`Real number expected, got ${arg}`);
  }
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

function prefixLines(str, prefix) {
  return str.split('\n').map(x => prefix + x).join('\n');
}

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

/** Return boolean value of an argv argument */
function getArgvBool(argv, arg, defaultValue = true) {
  if (argv[arg] === undefined) return defaultValue;
  if (argv[arg] === "false" || argv[arg] === "0") return false;
  return !!argv[arg];
}

module.exports = {
  input, print, peek, isDigit, factorial, prefixLines, getArgvBool, assertReal,
  isPrime, LCF, primeFactors, generatePrimes,
};