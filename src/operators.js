const Complex = require("./Complex");
const { assertReal, factorial } = require("./utils");

module.exports = {
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
  "==": {
    precedence: 11,
    args: 2,
    fn: (a, b) => +Complex.assert(a).equals(b),
    desc: `a equal to b`,
    syntax: 'a == b',
  },
  "!=": {
    precedence: 11,
    args: 2,
    fn: (a, b) => +(!Complex.assert(a).equals(b)),
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