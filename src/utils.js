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
    precedence: 10,
    args: 2,
    fn: (a, b) => Complex.mult(a, b),
    desc: `Used internally for high-precedence multiplication`,
    syntax: 'a !* b',
  },
  "!": {
    precedence: 5,
    args: 1,
    fn: n => {
      if (n.isReal()) return new Complex(factorial(n.a));
      throw new Error(`Argument Error: unexpected complex number`);
    },
    desc: `Calculate factorial of n. n must be a real, positive integer.`,
    syntax: 'a!',
  },
  "°": {
    precedence: 5,
    args: 1,
    fn: z => Complex.mult(z, Math.PI / 180), // Convert degrees to radians
    desc: `Take argument as degrees and convert to radians`,
    syntax: 'a°',
  },
  "^": {
    precedence: 4,
    args: 2,
    fn: (a, b) => Complex.pow(a, b),
    desc: `a ^ b`,
    syntax: 'a ^ b',
  },
  "*": {
    precedence: 3,
    args: 2,
    fn: (a, b) => Complex.mult(a, b),
    desc: `a × b`,
    syntax: 'a * b',
  },
  "//": {
    precedence: 3,
    args: 2,
    fn: (a, b) => Complex.floor(Complex.div(a, b)),
    desc: `integer division a ÷ b`,
    syntax: 'a // b',
  },
  "/": {
    precedence: 3,
    args: 2,
    fn: (a, b) => Complex.div(a, b),
    desc: `a ÷ b`,
    syntax: 'a / b',
  },
  "%": {
    precedence: 3,
    args: 2,
    fn: (a, b) => Complex.modulo(a, b),
    desc: `a % b (remainder of a ÷ b)`,
    syntax: 'a % b',
  },
  "+": {
    precedence: 2,
    args: 2,
    fn: (a, b) => Complex.add(a, b),
    desc: `a + b`,
    syntax: 'a + b',
  },
  "-": {
    precedence: 2,
    args: 2,
    fn: (a, b) => Complex.sub(a, b),
    desc: `a - b`,
    syntax: 'a - b',
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

function isMathError(n, emsg) {
  if (Complex.isNaN(n)) throw new Error(`Maths Error: ${emsg}`);
}

module.exports = {
  input, print, getMatchingBracket, peek, factorial,
  operators, bracketMap, bracketValues,
  parseNumber, parseOperator, parseVariable, parseFunction, isMathError,
};