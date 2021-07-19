const { factorial } = require("../maths/functions");
const Complex = require("../maths/Complex");
const { isNumericType } = require("./types");
const { arraysEqual } = require("../utils");
const { equal } = require("./values");

const operators = {
  "deg": { // !CUSTOM; degrees to radians
    precedence: 18,
    args: 1,
    fn: z => {
      const tz = z.type();
      if (isNumericType(tz)) return Complex.mult(z.eval('complex'), Math.PI / 180);
    },
    desc: `Take argument as degrees and convert to radians`,
    syntax: '<a>deg',
  },
  "~": {
    precedence: 17,
    args: 1,
    fn: x => {
      const tx = x.type();
      if (tx === 'real' || tx === 'bool') return ~x.eval('real');
    },
    desc: `Bitwise NOT`,
    syntax: '~x',
  },
  "**": {
    precedence: 16,
    args: 2,
    fn: (a, b) => {
      const ta = a.type(), tb = b.type();
      if (isNumericType(ta) && isNumericType(tb)) return Complex.pow(a.eval('complex'), b.eval('complex'));
    },
    desc: `exponentation: raise a to the b`,
    syntax: 'a ** b',
  },
  "*": {
    precedence: 15,
    args: 2,
    fn: (a, b) => {
      const ta = a.type(), tb = b.type();
      if (isNumericType(ta) && isNumericType(tb)) return Complex.mult(a.eval('complex'), b.eval('complex'));
      if (isNumericType(ta) && tb === 'string') return b.eval('string').repeat(a.eval('real'));
      if (isNumericType(tb) && ta === 'string') return a.eval('string').repeat(b.eval('real'));
    },
    desc: `a × b`,
    syntax: 'a * b',
  },
  "//": {
    precedence: 15,
    args: 2,
    fn: (a, b) => {
      const ta = a.type(), tb = b.type();
      if (isNumericType(ta) && isNumericType(tb)) return Complex.floor(Complex.div(a.eval('complex'), b.eval('complex')));
    },
    desc: `integer division a ÷ b`,
    syntax: 'a // b',
  },
  "/": {
    precedence: 15,
    args: 2,
    fn: (a, b) => {
      const ta = a.type(), tb = b.type();
      if (isNumericType(ta) && isNumericType(tb)) return Complex.div(a.eval('complex'), b.eval('complex'));
    },
    desc: `a ÷ b`,
    syntax: 'a / b',
  },
  "%": {
    precedence: 15,
    args: 2,
    fn: (a, b) => {
      const ta = a.type(), tb = b.type();
      if (isNumericType(ta) && isNumericType(tb)) return Complex.modulo(a.eval('complex'), b.eval('complex'));
    },
    desc: `a % b (remainder of a ÷ b)`,
    syntax: 'a % b',
  },
  "+": {
    precedence: 14,
    args: [2, 1],
    fn2: (a, b) => {
      const ta = a.type(), tb = b.type();
      if (isNumericType(ta) && isNumericType(tb)) return Complex.add(a.eval('complex'), b.eval('complex'));
      if (ta === 'array' && tb === 'array') return [...a.eval('array'), ...b.eval('array')];
      if (ta === 'set' && tb === 'set') return new Set([...a.eval('array'), ...b.eval('array')]);
      if (ta === 'string' && (tb === 'string' || isNumericType(tb))) return a.eval('string') + b.eval('string');
      if (ta === 'array') return [...a.eval('array'), b.eval('any')];
      if (ta === 'set') return new Set([...a.eval('array'), b.eval('any')]);
      if (tb === 'array') return [a.eval('any'), ...b.eval('array')];
      if (tb === 'set') return new Set([a.eval('any'), ...b.eval('array')]);
    },
    fn1: n => n.eval('complex'),
    desc: `a + b`,
    syntax: 'a + b',
  },
  "-": {
    precedence: 14,
    args: [2, 1],
    fn2: (a, b) => {
      const ta = a.type(), tb = b.type();
      if (isNumericType(ta) && isNumericType(tb)) return Complex.sub(a.eval('complex'), b.eval('complex'));
    },
    fn1: n => Complex.mult(n.eval('complex'), -1),
    desc: `a - b`,
    syntax: 'a - b',
  },
  "<<": {
    precedence: 13,
    args: 2,
    fn: (a, b) => {
      const ta = a.type(), tb = b.type();
      if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return a.eval('real') << b.eval('real');
    },
    desc: `Bitwise left shift a by b places`,
    syntax: 'a << b',
  },
  ">>": {
    precedence: 13,
    args: 2,
    fn: (a, b) => {
      const ta = a.type(), tb = b.type();
      if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return a.eval('real') >> b.eval('real');
    },
    desc: `Bitwise right shift a by b places`,
    syntax: 'a >> b',
  },
  "<=": {
    precedence: 12,
    args: 2,
    fn: (a, b) => {
      const ta = a.type(), tb = b.type();
      if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return a.eval('real') <= b.eval('real');
    },
    desc: `a less than or equal to b`,
    syntax: 'a <= b',
  },
  "<": {
    precedence: 12,
    args: 2,
    fn: (a, b) => {
      const ta = a.type(), tb = b.type();
      if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return a.eval('real') < b.eval('real');
    },
    desc: `a less than b`,
    syntax: 'a < b',
  },
  ">=": {
    precedence: 12,
    args: 2,
    fn: (a, b) => {
      const ta = a.type(), tb = b.type();
      if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return a.eval('real') >= b.eval('real');
    },
    desc: `a greater than or equal to b`,
    syntax: 'a >= b',
  },
  ">": {
    precedence: 12,
    args: 2,
    fn: (a, b) => {
      const ta = a.type(), tb = b.type();
      if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return a.eval('real') > b.eval('real');
    },
    desc: `a greater than b`,
    syntax: 'a > b',
  },
  "==": {
    precedence: 11,
    args: 2,
    fn: equal,
    desc: `a equal to b`,
    syntax: 'a == b',
  },
  "!=": {
    precedence: 11,
    args: 2,
    fn: (a, b) => !equal(a, b),
    desc: `a not equal to b`,
    syntax: 'a != b',
  },
  "&&": {
    precedence: 7,
    args: 2,
    fn: (a, b) => {
      const ta = a.type(), tb = b.type();
      if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return a.eval('bool') && b.eval('bool');
    },
    desc: `Logical AND`,
    syntax: 'a && b',
  },
  "&": {
    precedence: 10,
    args: 2,
    fn: (a, b) => {
      const ta = a.type(), tb = b.type();
      if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return a.eval('real') & b.eval('real');
    },
    desc: `Bitwise AND`,
    syntax: 'a & b',
  },
  "^": {
    precedence: 9,
    args: 2,
    fn: (a, b) => {
      const ta = a.type(), tb = b.type();
      if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return a.eval('real') ^ b.eval('real');
    },
    desc: `Bitwise XOR`,
    syntax: 'a ^ b',
  },
  "||": {
    precedence: 6,
    args: 2,
    fn: (a, b) => {
      const ta = a.type(), tb = b.type();
      if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return a.eval('bool') || b.eval('bool');
    },
    desc: `Logical OR`,
    syntax: 'a || b',
  },
  "|": {
    precedence: 8,
    args: 2,
    fn: (a, b) => {
      const ta = a.type(), tb = b.type();
      if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return a.eval('real') | b.eval('real');
    },
    desc: `Bitwise OR`,
    syntax: 'a | b',
  },
  "=": { // Used and processed internally
    precedence: 3,
    args: 2,
    fn: (symbol, v) => {
      throw new Error(`Invalid assignment`);
    },
    desc: 'Set symbol <symbol> equal to <v>',
    syntax: 'symbol = v',
  },

  "!": {
    precedence: 17,
    args: 1,
    fn: n => {
      const tx = n.type();
      if (tx === 'real') return factorial(n.value.a);
    },
    desc: `Calculate factorial of n. n must be a real, positive integer.`,
    syntax: 'a!',
  },
};

operators["!*"] = { // Internal multiplication for higher-precedence multiplication. Used for e.g. "2ln(2)" should be evaluated before "^"
  args: operators['*'].args,
  precedence: 100, // !CUSTOM
  fn: operators['*'].fn,
  desc: `Used internally for high-precedence multiplication`,
  syntax: 'a !* b',
};

module.exports = operators;