const { factorial } = require("../maths/functions");
const Complex = require("../maths/Complex");
const { assertReal } = require("../utils");

module.exports = {
  "!*": { // Internal multiplication for higher-precedence multiplication. Used for e.g. "2ln(2)" should be evaluated before "^"
    args: ['complex', 'complex'],
    precedence: 100, // !CUSTOM
    fn: (a, b) => Complex.mult(a, b),
    desc: `Used internally for high-precedence multiplication`,
    syntax: 'a !* b',
  },
  "deg": { // !CUSTOM
    precedence: 18,
    args: ['complex'],
    fn: z => Complex.mult(z, Math.PI / 180), // Convert degrees to radians
    desc: `Take argument as degrees and convert to radians`,
    syntax: '<a>deg',
  },
  "~": {
    precedence: 17,
    args: ['real'],
    fn: x => ~x,
    desc: `Bitwise NOT`,
    syntax: '~x',
  },
  "**": {
    precedence: 16,
    args: ['complex', 'complex'],
    fn: (a, b) => Complex.pow(a, b),
    desc: `exponentation: raise a to the b`,
    syntax: 'a ** b',
  },
  "*": {
    precedence: 15,
    args: ['complex', 'complex'],
    fn: (a, b) => Complex.mult(a, b),
    desc: `a × b`,
    syntax: 'a * b',
  },
  "//": {
    precedence: 15,
    args: ['complex', 'complex'],
    fn: (a, b) => Complex.floor(Complex.div(a, b)),
    desc: `integer division a ÷ b`,
    syntax: 'a // b',
  },
  "/": {
    precedence: 15,
    args: ['complex', 'complex'],
    fn: (a, b) => Complex.div(a, b),
    desc: `a ÷ b`,
    syntax: 'a / b',
  },
  "%": {
    precedence: 15,
    args: ['complex', 'complex'],
    fn: (a, b) => Complex.modulo(a, b),
    desc: `a % b (remainder of a ÷ b)`,
    syntax: 'a % b',
  },
  "+": {
    precedence: 14,
    args: ['complex', 'complex'],
    fn: (a, b) => Complex.add(a, b),
    desc: `a + b`,
    syntax: 'a + b',
  },
  "-": {
    precedence: 14,
    args: ['complex', 'complex'],
    fn: (a, b) => Complex.sub(a, b),
    desc: `a - b`,
    syntax: 'a - b',
  },
  "<<": {
    precedence: 13,
    args: ['real', 'real'],
    fn: (a, b) => a << b,
    desc: `Bitwise left shift a by b places`,
    syntax: 'a << b',
  },
  ">>": {
    precedence: 13,
    args: ['real', 'real'],
    fn: (a, b) => a >> b,
    desc: `Bitwise right shift a by b places`,
    syntax: 'a >> b',
  },
  "<=": {
    precedence: 12,
    args: ['real', 'real'],
    fn: (a, b) => +(a <= b),
    desc: `a less than or equal to b`,
    syntax: 'a <= b',
  },
  "<": {
    precedence: 12,
    args: ['real', 'real'],
    fn: (a, b) => +(a < b),
    desc: `a less than b`,
    syntax: 'a < b',
  },
  ">=": {
    precedence: 12,
    args: ['real', 'real'],
    fn: (a, b) => +(a >= b),
    desc: `a greater than or equal to b`,
    syntax: 'a >= b',
  },
  ">": {
    precedence: 12,
    args: ['real', 'real'],
    fn: (a, b) => +(a.a > b.a),
    desc: `a greater than b`,
    syntax: 'a > b',
  },
  "==": {
    precedence: 11,
    args: ['complex', 'complex'],
    fn: (a, b) => +a.equals(b),
    desc: `a equal to b`,
    syntax: 'a == b',
  },
  "!=": {
    precedence: 11,
    args: ['complex', 'complex'],
    fn: (a, b) => +(!a.equals(b)),
    desc: `a not equal to b`,
    syntax: 'a != b',
  },
  "&&": {
    precedence: 7,
    args: ['real', 'real'],
    fn: (a, b) => +(a && b),
    desc: `Logical AND`,
    syntax: 'a && b',
  },
  "&": {
    precedence: 10,
    args: ['real', 'real'],
    fn: (a, b) => a & b,
    desc: `Bitwise AND`,
    syntax: 'a & b',
  },
  "^": {
    precedence: 9,
    args: ['real', 'real'],
    fn: (a, b) => a & b,
    desc: `Bitwise XOR`,
    syntax: 'a ^ b',
  },
  "||": {
    precedence: 6,
    args: ['real', 'real'],
    fn: (a, b) => +(a || b),
    desc: `Logical OR`,
    syntax: 'a || b',
  },
  "|": {
    precedence: 8,
    args: ['real', 'real'],
    fn: (a, b) => a | b,
    desc: `Bitwise OR`,
    syntax: 'a | b',
  },
  "=": { // Used and processed internally
    precedence: 3,
    args: ['string', 'any'],
    fn: (symbol, v) => {
      throw new Error(`Invalid assignment`);
    },
    desc: 'Set symbol <symbol> equal to <v>',
    syntax: 'symbol = v',
  },

  "!": {
    precedence: 17,
    args: ['real'],
    fn: n => factorial(n),
    desc: `Calculate factorial of n. n must be a real, positive integer.`,
    syntax: 'a!',
  },
};