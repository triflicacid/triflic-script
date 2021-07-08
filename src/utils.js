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

const bracketMap = {
  "[": "]", "]": "[",
  "(": ")", ")": "(",
  "{": "}", "}": "{",
};
const bracketValues = {
  "[": 1, "]": -1,
  "(": 1, ")": -1,
  "{": 1, "}": -1,
};
/** Return position of matching bracket in program */
function getMatchingBracket(pos, program) {
  if (bracketMap[program[pos]] === undefined) {
    throw new Error("Unexpected token '" + program[pos] + "' at position " + pos + ": cannot match token");
  }
  let open_groups = 0, i = pos;
  let add = bracketValues[program[pos]]; // Look forward if hnting closing, else backwards
  let openingBracket, closingBracket;
  if (add === 1) {
    openingBracket = program[pos];
    closingBracket = bracketMap[openingBracket];
  } else {
    closingBracket = program[pos];
    openingBracket = bracketMap[closingBracket];
  }

  while (i > -1 && i < program.length) {
    if (program[i] == closingBracket)
      open_groups--;
    else if (program[i] == openingBracket)
      open_groups++;
    if (open_groups == 0)
      return i;
    i += add; // Move to next token
  }

  throw new Error("No matching bracket found for '" + program[pos] + "' in position " + pos);
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

/**
 * Like parseFloat
 * @param {string} string
 * @returns {{ n: number, pos: number }} Return number extracted and end pos
 */
function parseNumber(string) {
  // Stages 0 - start, 1 - encountered sign, 2 - encountered '.', 3 - encountered 'e'
  let nStr = '', stage = 0, i;
  for (i = 0; i < string.length; i++) {
    // Dot?
    if (string[i] === '.') {
      if (stage === 0 || stage === 1) {
        nStr += '.';
        stage = 2;
      } else {
        break;
      }
    }

    // Sign?
    else if (string[i] === '+' || string[i] === '-') {
      if (stage === 0 && nStr.length === 0) {
        nStr += string[i];
        stage = 1;
      } else {
        break;
      }
    }

    // 'e' ?
    else if (string[i] === 'e') {
      if (stage === 0) {
        break; // Here? What?
      } else if (stage >= 3) {
        break;
      } else {
        nStr += 'e';
        if (string[i + 1] === '+' || string[i + 1] === '-') nStr += string[++i];
        stage = 3;
      }
    }

    // Digit
    else if (isDigit(string[i])) {
      nStr += string[i];
    } else {
      break;
    }
  }

  // Check for incomplete 'e' power
  let last2 = nStr[nStr.length - 2] + nStr[nStr.length - 1];
  if (last2 === 'e-' || last2 === 'e+') {
    nStr = nStr.substr(0, nStr.length - 2);
    i -= 2;
  }
  // Incomplete decimal? Incomplete sign?
  if (nStr === '.' || nStr === '-' || nStr === '+') {
    nStr = "";
    i--;
  }
  return { nStr, n: +nStr, pos: i };
}
const operators = {
  "!*": { // Internal multiplication for higher-precedence multiplication. Used for e.g. "2ln(2)" should be evaluated before "^"
    precedence: 100, // !CUSTOM
    args: 2,
    fn: (a, b) => Complex.mult(a, b),
    desc: `Used internally for high-precedence multiplication`,
    syntax: 'a !* b',
  },
  "deg": { // !CUSTOM
    precedence: 18,
    args: 1,
    fn: z => Complex.mult(z, Math.PI / 180), // Convert degrees to radians
    desc: `Take argument as degrees and convert to radians`,
    syntax: '<a>deg',
  },
  "~": {
    precedence: 17,
    args: 1,
    fn: x => {
      assertReal(x);
      return ~x.a;
    },
    desc: `Bitwise NOT`,
    syntax: '~x',
  },
  "**": {
    precedence: 16,
    args: 2,
    fn: (a, b) => Complex.pow(a, b),
    desc: `exponentation: raise a to the b`,
    syntax: 'a ** b',
  },
  "*": {
    precedence: 15,
    args: 2,
    fn: (a, b) => Complex.mult(a, b),
    desc: `a × b`,
    syntax: 'a * b',
  },
  "//": {
    precedence: 15,
    args: 2,
    fn: (a, b) => Complex.floor(Complex.div(a, b)),
    desc: `integer division a ÷ b`,
    syntax: 'a // b',
  },
  "/": {
    precedence: 15,
    args: 2,
    fn: (a, b) => Complex.div(a, b),
    desc: `a ÷ b`,
    syntax: 'a / b',
  },
  "%": {
    precedence: 15,
    args: 2,
    fn: (a, b) => Complex.modulo(a, b),
    desc: `a % b (remainder of a ÷ b)`,
    syntax: 'a % b',
  },
  "+": {
    precedence: 14,
    args: 2,
    fn: (a, b) => Complex.add(a, b),
    desc: `a + b`,
    syntax: 'a + b',
  },
  "-": {
    precedence: 14,
    args: 2,
    fn: (a, b) => Complex.sub(a, b),
    desc: `a - b`,
    syntax: 'a - b',
  },
  "<<": {
    precedence: 13,
    args: 2,
    fn: (a, b) => {
      assertReal(a, b);
      return a.a << b.a;
    },
    desc: `Bitwise left shift a by b places`,
    syntax: 'a << b',
  },
  ">>": {
    precedence: 13,
    args: 2,
    fn: (a, b) => {
      assertReal(a, b);
      return a.a >> b.a;
    },
    desc: `Bitwise right shift a by b places`,
    syntax: 'a >> b',
  },
  "<": {
    precedence: 12,
    args: 2,
    fn: (a, b) => {
      assertReal(a, b);
      return +(a.a < b.a);
    },
    desc: `a less than b`,
    syntax: 'a < b',
  },
  "<=": {
    precedence: 12,
    args: 2,
    fn: (a, b) => {
      assertReal(a, b);
      return +(a.a <= b.a);
    },
    desc: `a less than or equal to b`,
    syntax: 'a <= b',
  },
  ">": {
    precedence: 12,
    args: 2,
    fn: (a, b) => {
      assertReal(a, b);
      return +(a.a > b.a);
    },
    desc: `a greater than b`,
    syntax: 'a > b',
  },
  ">=": {
    precedence: 12,
    args: 2,
    fn: (a, b) => {
      assertReal(a, b);
      return +(a.a >= b.a);
    },
    desc: `a greater than or equal to b`,
    syntax: 'a >= b',
  },
  "==": {
    precedence: 11,
    args: 2,
    fn: (a, b) => +a.equals(b),
    desc: `a equal to b`,
    syntax: 'a == b',
  },
  "!=": {
    precedence: 11,
    args: 2,
    fn: (a, b) => +(!a.equals(b)),
    desc: `a not equal to b`,
    syntax: 'a != b',
  },
  "&&": {
    precedence: 7,
    args: 2,
    fn: (a, b) => {
      assertReal(a, b);
      return +(a.a && b.a);
    },
    desc: `Logical AND`,
    syntax: 'a && b',
  },
  "&": {
    precedence: 10,
    args: 2,
    fn: (a, b) => {
      assertReal(a, b);
      return a.a & b.a;
    },
    desc: `Bitwise AND`,
    syntax: 'a & b',
  },
  "^": {
    precedence: 9,
    args: 2,
    fn: (a, b) => {
      assertReal(a, b);
      return a.a & b.a;
    },
    desc: `Bitwise XOR`,
    syntax: 'a ^ b',
  },
  "||": {
    precedence: 6,
    args: 2,
    fn: (a, b) => {
      assertReal(a, b);
      return +(a.a || b.a);
    },
    desc: `Logical OR`,
    syntax: 'a || b',
  },
  "|": {
    precedence: 8,
    args: 2,
    fn: (a, b) => {
      assertReal(a, b);
      return a.a | b.a;
    },
    desc: `Bitwise OR`,
    syntax: 'a | b',
  },

  "!": {
    precedence: 17,
    args: 1,
    fn: n => {
      assertReal(n);
      return new Complex(factorial(n.a));
    },
    desc: `Calculate factorial of n. n must be a real, positive integer.`,
    syntax: 'a!',
  },
};
function parseOperator(string) {
  for (let operator in operators) {
    if (operators.hasOwnProperty(operator)) {
      let snippet = string.substr(0, operator.length);
      if (operator === snippet) return operator;
    }
  }
  return null;
}

/** Parse a variable name */
function parseVariable(string) {
  const rStart = /[A-Za-z_$ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρςστυφχψω∞]/;
  const rRest = /[0-9]/;
  if (!rStart.test(string[0])) return null;
  let symbol = string[0];
  for (let i = 1; i < string.length; i++) {
    if (rStart.test(string[i]) || rRest.test(string[i])) {
      symbol += string[i];
    } else {
      break;
    }
  }
  return symbol;
}

/** Parse a function name */
function parseFunction(string) {
  const rStart = /[A-Za-z_$ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρςστυφχψω√∛]/;
  const rRest = /[0-9]/;
  if (!rStart.test(string[0])) return null;
  let symbol = string[0];
  for (let i = 1; i < string.length; i++) {
    if (rStart.test(string[i]) || rRest.test(string[i])) {
      symbol += string[i];
    } else {
      break;
    }
  }
  return symbol;
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

module.exports = {
  input, print, getMatchingBracket, peek, factorial,
  operators, bracketMap, bracketValues,
  parseNumber, parseOperator, parseVariable, parseFunction, assertReal,
  isPrime, LCF, primeFactors,
};