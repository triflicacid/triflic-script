// "<operator>": {
//   precedence: <int>,       // Precedence of operator
//   args: <int> | <int[]>,   // Argument count, or array of argument counts (for overloads)
//   fn: ...,                 // Function called if only one overload
//   fn<overload-n>: ...,     // Function called corresponding to arg length overload e.g. fn2, fn1
//   desc: <string>,          // Description of operator
//   syntax: <string>,        // Syntax of how operator is used
//   preservePosition: <bool> // Should this operator be preserved exactly (ignore precedence)
//   unary: <string|null>     // If present, and if operator meets unary criteria, use this operator instead
// },

const operators = {
  "deg": { // !CUSTOM; degrees to radians
    precedence: 18,
    args: 1,
    fn: z => z.eval('any').__deg__(),
    desc: `Take argument as degrees and convert to radians`,
    syntax: '<a>deg',
    preservePosition: true,
  },
  "~": {
    precedence: 17,
    args: 1,
    fn: x => x.eval('any').__bitwiseNot__(),
    desc: `Bitwise NOT`,
    syntax: '~x',
  },
  "u+": {
    precedence: 17,
    args: 1,
    fn: n => n.eval('any').__pos__(),
    desc: 'cast n into a number',
    syntax: '+n',
    unary: "u+",
  },
  "u-": {
    precedence: 17,
    args: 1,
    fn: n => n.eval('any').__neg__(),
    desc: 'cast n into a negative number',
    syntax: '-n',
    unary: "u-",
  },
  "'": {
    precedence: 17,
    args: 1,
    fn: x => x.eval('any').__not__(),
    desc: `logical not unless x is of type set. Then, find complement of x (using universal set, ε)`,
    syntax: 'x\'',
    preservePosition: true,
  },
  "**": {
    precedence: 16,
    args: 2,
    fn: (a, b) => a.eval('any').__pow__(b.eval('any')),
    desc: `exponentation: raise a to the b`,
    syntax: 'a ** b',
  },
  "//": {
    precedence: 15,
    args: 2,
    fn: (a, b) => a.eval('any').__intDiv__(b.eval('any')),
    desc: `integer division a ÷ b`,
    syntax: 'a // b',
  },
  "/": {
    precedence: 15,
    args: 2,
    fn: (a, b) => a.eval('any').__div__(b.eval('any')),
    desc: `a ÷ b`,
    syntax: 'a / b',
  },
  "%": {
    precedence: 15,
    args: 2,
    fn: (a, b) => a.eval('any').__mod__(b.eval('any')),
    desc: `a % b (remainder of a ÷ b)`,
    syntax: 'a % b',
  },
  "*": {
    precedence: 15,
    args: 2,
    fn: (a, b) => a.eval('any').__mul__(b.eval('any')),
    desc: `a × b`,
    syntax: 'a * b',
  },
  "∩": {
    precedence: 15,
    args: 2,
    fn: (a, b) => a.eval('any').__intersect__(b.eval('any')),
    desc: `a ∩ b`,
    syntax: 'intersection of a and b',
  },
  "+": {
    precedence: 14,
    args: 2,
    fn: (a, b) => a.eval('any').__add__(b.eval('any')),
    desc: `a + b`,
    syntax: 'a + b',
    unary: 'u+',
  },
  "∪": {
    precedence: 14,
    args: 2,
    fn: (a, b) => a.eval('any').__union__(b.eval('any')),
    desc: `a ∪ b`,
    syntax: 'union of a and b',
  },
  "-": {
    precedence: 14,
    args: 2,
    fn: (a, b) => a.eval('any').__sub__(b.eval('any')),
    desc: `a - b`,
    syntax: 'a - b',
    unary: 'u-',
  },
  "<<": {
    precedence: 13,
    args: 2,
    fn: (a, b) => a.eval('any').__lshift__(b.eval('any')),
    desc: `Bitwise left shift a by b places`,
    syntax: 'a << b',
  },
  ">>": {
    precedence: 13,
    args: 2,
    fn: (a, b) => a.eval('any').__rshift__(b.eval('any')),
    desc: `Bitwise right shift a by b places`,
    syntax: 'a >> b',
  },
  "<=": {
    precedence: 12,
    args: 2,
    fn: (a, b) => a.eval('any').__le__(b.eval('any')),
    desc: `a less than or equal to b`,
    syntax: 'a <= b',
  },
  "<": {
    precedence: 12,
    args: 2,
    fn: (a, b) => a.eval('any').__lt__(b.eval('any')),
    desc: `a less than b`,
    syntax: 'a < b',
  },
  ">=": {
    precedence: 12,
    args: 2,
    fn: (a, b) => a.eval('any').__ge__(b.eval('any')),
    desc: `a greater than or equal to b`,
    syntax: 'a >= b',
  },
  ">": {
    precedence: 12,
    args: 2,
    fn: (a, b) => a.eval('any').__gt__(b.eval('any')),
    desc: `a greater than b`,
    syntax: 'a > b',
  },
  "in ": {
    precedence: 12,
    args: 2,
    fn: (a, b) => a.eval('any').__in__(b.eval('any')),
    desc: `check if <a> is in <b>. (NB a space after 'in' is required)`,
    syntax: 'a in b',
  },
  "==": {
    precedence: 11,
    args: 2,
    fn: (a, b) => a.eval('any').__eq__(b.eval('any')),
    desc: `a equal to b`,
    syntax: 'a == b',
  },
  "!=": {
    precedence: 11,
    args: 2,
    fn: (a, b) => a.eval('any').__neq__(b.eval('any')),
    desc: `a not equal to b`,
    syntax: 'a != b',
  },
  "&&": {
    precedence: 7,
    args: 2,
    fn: (a, b) => a.eval('any').__and__(b.eval('any')),
    desc: `Logical AND`,
    syntax: 'a && b',
  },
  "&": {
    precedence: 10,
    args: 2,
    fn: (a, b) => a.eval('any').__bitwiseAnd__(b.eval('any')),
    desc: `Bitwise AND`,
    syntax: 'a & b',
  },
  "^": {
    precedence: 9,
    args: 2,
    fn: (a, b) => a.eval('any').__xor__(b.eval('any')),
    desc: `Bitwise XOR`,
    syntax: 'a ^ b',
  },
  "||": {
    precedence: 6,
    args: 2,
    fn: (a, b) => a.eval('any').__or__(b.eval('any')),
    desc: `Logical OR`,
    syntax: 'a || b',
  },
  "|": {
    precedence: 8,
    args: 2,
    fn: (a, b) => a.eval('any').__bitwiseOr__(b.eval('any')),
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
    fn: n => n.eval('any').__excl__(),
    desc: `Calculate factorial of n. n must be a real, positive integer.`,
    syntax: 'a!',
    preservePosition: true,
  },
  ",": {
    precedence: 1,
    args: 2,
    fn: (lhs, rhs) => rhs,
    desc: 'Used to seperate statements. Evaluates <lhs> and <rhs>, but only returns <rhs>',
    syntax: '<statement>, <statement>',
  }
};

operators["!*"] = { // Internal multiplication for higher-precedence multiplication. Used for e.g. "2ln(2)" should be evaluated before "^"
  args: operators['*'].args,
  precedence: 100, // !CUSTOM
  fn: operators['*'].fn,
  desc: `Used internally for high-precedence multiplication`,
  syntax: 'a !* b',
};

module.exports = operators;