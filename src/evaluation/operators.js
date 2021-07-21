const { factorial } = require("../maths/functions");
const Complex = require("../maths/Complex");
const { isNumericType } = require("./types");
const { NumberValue, StringValue, ArrayValue, SetValue, BoolValue } = require("./values");
const { equal, intersect, arrDifference, findIndex } = require("../utils");

// "<operator>": {
//   precedence: <int>,       // Precedence of operator
//   args: <int> | <int[]>,   // Argument count, or array of argument counts (for overloads)
//   fn: ...,                 // Function called if only one overload
//   fn<overload-n>: ...,     // Function called corresponding to arg length overload e.g. fn2, fn1
//   desc: <string>,          // Description of operator
//   syntax: <string>,        // Syntax of how operator is used
//   preservePosition: <bool> // Should this operator be preserved exactly (ignore precedence)
// },

const prepareOperators = rs => {
  const ops = {
    "deg": { // !CUSTOM; degrees to radians
      precedence: 18,
      args: 1,
      fn: z => {
        const tz = z.type();
        if (isNumericType(tz)) return new NumberValue(rs, Complex.mult(z.toPrimitive('complex'), Math.PI / 180));
      },
      desc: `Take argument as degrees and convert to radians`,
      syntax: '<a>deg',
      preservePosition: true,
    },
    "~": {
      precedence: 17,
      args: 1,
      fn: x => {
        const tx = x.type();
        if (tx === 'real' || tx === 'bool') return new NumberValue(rs, ~x.toPrimitive('real'));
      },
      desc: `Bitwise NOT`,
      syntax: '~x',
      preservePosition: true,
    },
    "'": {
      precedence: 17,
      args: 1,
      fn: x => {
        const tx = x.type();
        if (tx === 'set') {
          const us = rs.var('ε')?.eval('any');
          if (us == undefined || us.type() !== 'set') throw new Error(`Type Error: expected built-in variable 'universal set' [ε] to be of type set, got ${us?.type()}`);
          return new SetValue(rs, arrDifference(us.toPrimitive('array'), x.toPrimitive('array')));
        }
        return new BoolValue(rs, !x.toPrimitive('bool'));
      },
      desc: `logical not unless x is of type set. Then, find complement of x (using universal set, ε)`,
      syntax: 'x\'',
      preservePosition: true,
    },
    "**": {
      precedence: 16,
      args: 2,
      fn: (a, b) => {
        const ta = a.type(), tb = b.type();
        if (isNumericType(ta) && isNumericType(tb)) return new NumberValue(rs, Complex.pow(a.toPrimitive('complex'), b.toPrimitive('complex')));
      },
      desc: `exponentation: raise a to the b`,
      syntax: 'a ** b',
    },
    "*": {
      precedence: 15,
      args: 2,
      fn: (a, b) => {
        const ta = a.type(), tb = b.type();
        if (isNumericType(ta) && isNumericType(tb)) return new NumberValue(rs, Complex.mult(a.toPrimitive('complex'), b.toPrimitive('complex')));
        if (isNumericType(ta) && tb === 'string') return new StringValue(rs, b.toPrimitive('string').repeat(a.toPrimitive('real')));
        if (isNumericType(tb) && ta === 'string') return new StringValue(rs, a.toPrimitive('string').repeat(b.toPrimitive('real')));
        if (ta === 'array' && tb === 'array') return new ArrayValue(rs, intersect(a.toPrimitive('array'), b.toPrimitive('array')));
      },
      desc: `a × b`,
      syntax: 'a * b',
    },
    "∩": {
      precedence: 15,
      args: 2,
      fn: (a, b) => {
        const ta = a.type(), tb = b.type();
        if (ta === 'array' && tb === 'array') return new ArrayValue(rs, intersect(a.toPrimitive('array'), b.toPrimitive('array')));
        if (ta === 'set' && tb === 'set') return new SetValue(rs, intersect(a.toPrimitive('array'), b.toPrimitive('array')));
      },
      desc: `a ∩ b`,
      syntax: 'intersection of a and b',
    },
    "//": {
      precedence: 15,
      args: 2,
      fn: (a, b) => {
        const ta = a.type(), tb = b.type();
        if (isNumericType(ta) && isNumericType(tb)) return new NumberValue(rs, Complex.floor(Complex.div(a.toPrimitive('complex'), b.toPrimitive('complex'))));
      },
      desc: `integer division a ÷ b`,
      syntax: 'a // b',
    },
    "/": {
      precedence: 15,
      args: 2,
      fn: (a, b) => {
        const ta = a.type(), tb = b.type();
        if (isNumericType(ta) && isNumericType(tb)) return new NumberValue(rs, Complex.div(a.toPrimitive('complex'), b.toPrimitive('complex')));
      },
      desc: `a ÷ b`,
      syntax: 'a / b',
    },
    "%": {
      precedence: 15,
      args: 2,
      fn: (a, b) => {
        const ta = a.type(), tb = b.type();
        if (isNumericType(ta) && isNumericType(tb)) return new NumberValue(rs, Complex.modulo(a.toPrimitive('complex'), b.toPrimitive('complex')));
      },
      desc: `a % b (remainder of a ÷ b)`,
      syntax: 'a % b',
    },
    "+": {
      precedence: 14,
      args: [2, 1],
      fn2: (a, b) => {
        const ta = a.type(), tb = b.type();
        if (isNumericType(ta) && isNumericType(tb)) return new NumberValue(rs, Complex.add(a.toPrimitive('complex'), b.toPrimitive('complex')));
        if (ta === 'array' && tb === 'array') return new ArrayValue(rs, a.toPrimitive('array').concat(b.toPrimitive('array')));
        if (ta === 'set' && tb === 'set') return new SetValue(rs, a.toPrimitive('array').concat(b.toPrimitive('array')));
        if (ta === 'string' && (tb === 'string' || isNumericType(tb))) return new StringValue(rs, a.toPrimitive('string') + b.toPrimitive('string'));
        if (ta === 'array') return new ArrayValue(rs, a.toPrimitive('array').concat(b.toPrimitive('any')));
        if (ta === 'set') return new SetValue(rs, a.toPrimitive('array').concat(b.toPrimitive('any')));
        if (tb === 'array') return new ArrayValue(rs, [a.toPrimitive('any'), ...b.toPrimitive('array')]);
        if (tb === 'set') return new SetValue(rs, [a.toPrimitive('any'), ...b.toPrimitive('array')]);
      },
      fn1: n => new NumberValue(rs, n.toPrimitive('complex')),
      desc: `a + b`,
      syntax: 'a + b',
    },
    "∪": {
      precedence: 14,
      args: 2,
      fn: (a, b) => {
        const ta = a.type(), tb = b.type();
        if (ta === 'array' && tb === 'array') return new ArrayValue(rs, a.toPrimitive('array').concat(b.toPrimitive('array')));
        if (ta === 'set' && tb === 'set') return new SetValue(rs, a.toPrimitive('array').concat(b.toPrimitive('array')));
      },
      desc: `a ∪ b`,
      syntax: 'union of a and b',
    },
    "-": {
      precedence: 14,
      args: [2, 1],
      fn2: (a, b) => {
        const ta = a.type(), tb = b.type();
        if (isNumericType(ta) && isNumericType(tb)) return new NumberValue(rs, Complex.sub(a.toPrimitive('complex'), b.toPrimitive('complex')));
        if (ta === 'array' && tb === 'array') return new ArrayValue(rs, arrDifference(a.toPrimitive('array'), b.toPrimitive('array')));
        if (ta === 'set' && tb === 'set') return new SetValue(rs, arrDifference(a.toPrimitive('array'), b.toPrimitive('array')));
       },
      fn1: n => new NumberValue(rs, Complex.mult(n.toPrimitive('complex'), -1)),
      desc: `a - b`,
      syntax: 'a - b',
    },
    "<<": {
      precedence: 13,
      args: 2,
      fn: (a, b) => {
        const ta = a.type(), tb = b.type();
        if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return new NumberValue(rs, a.toPrimitive('real') << b.toPrimitive('real'));
      },
      desc: `Bitwise left shift a by b places`,
      syntax: 'a << b',
    },
    ">>": {
      precedence: 13,
      args: 2,
      fn: (a, b) => {
        const ta = a.type(), tb = b.type();
        if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return new NumberValue(rs, a.toPrimitive('real') >> b.toPrimitive('real'));
      },
      desc: `Bitwise right shift a by b places`,
      syntax: 'a >> b',
    },
    "<=": {
      precedence: 12,
      args: 2,
      fn: (a, b) => {
        const ta = a.type(), tb = b.type();
        if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return new BoolValue(rs, a.toPrimitive('real') <= b.toPrimitive('real'));
      },
      desc: `a less than or equal to b`,
      syntax: 'a <= b',
    },
    "<": {
      precedence: 12,
      args: 2,
      fn: (a, b) => {
        const ta = a.type(), tb = b.type();
        if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return new BoolValue(rs, a.toPrimitive('real') < b.toPrimitive('real'));
      },
      desc: `a less than b`,
      syntax: 'a < b',
    },
    ">=": {
      precedence: 12,
      args: 2,
      fn: (a, b) => {
        const ta = a.type(), tb = b.type();
        if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return new BoolValue(rs, a.toPrimitive('real') >= b.toPrimitive('real'));
      },
      desc: `a greater than or equal to b`,
      syntax: 'a >= b',
    },
    ">": {
      precedence: 12,
      args: 2,
      fn: (a, b) => {
        const ta = a.type(), tb = b.type();
        if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return new BoolValue(rs, a.toPrimitive('real') > b.toPrimitive('real'));
      },
      desc: `a greater than b`,
      syntax: 'a > b',
    },
    "in": {
      precedence: 12,
      args: 2,
      fn: (a, b) => {
        const tb = b.type();
        if (tb === 'array' || tb === 'set') return new BoolValue(rs, findIndex(a, b.toPrimitive('array')) !== -1);
        if (tb === 'string') return new BoolValue(rs, b.toString().indexOf(a.toString()) !== -1);
      },
      desc: `check if <a> is in <b>`,
      syntax: 'a in b',
    },
    "==": {
      precedence: 11,
      args: 2,
      fn: (a, b) => new BoolValue(rs, equal(a, b)),
      desc: `a equal to b`,
      syntax: 'a == b',
    },
    "!=": {
      precedence: 11,
      args: 2,
      fn: (a, b) => new BoolValue(rs, !equal(a, b)),
      desc: `a not equal to b`,
      syntax: 'a != b',
    },
    "&&": {
      precedence: 7,
      args: 2,
      fn: (a, b) => a.toPrimitive('bool') && b.toPrimitive('bool') ? b : new BoolValue(rs, false),
      desc: `Logical AND`,
      syntax: 'a && b',
    },
    "&": {
      precedence: 10,
      args: 2,
      fn: (a, b) => {
        const ta = a.type(), tb = b.type();
        if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return new NumberValue(rs, a.toPrimitive('real') & b.toPrimitive('real'));
      },
      desc: `Bitwise AND`,
      syntax: 'a & b',
    },
    "^": {
      precedence: 9,
      args: 2,
      fn: (a, b) => {
        const ta = a.type(), tb = b.type();
        if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return new NumberValue(rs, a.toPrimitive('real') ^ b.toPrimitive('real'));
      },
      desc: `Bitwise XOR`,
      syntax: 'a ^ b',
    },
    "||": {
      precedence: 6,
      args: 2,
      fn: (a, b) => {
        if (a.toPrimitive('bool')) return a;
        if (b.toPrimitive('bool')) return b;
        return new BoolValue(rs, false);
      },
      desc: `Logical OR`,
      syntax: 'a || b',
    },
    "|": {
      precedence: 8,
      args: 2,
      fn: (a, b) => {
        const ta = a.type(), tb = b.type();
        if ((ta === 'real' || ta === 'bool') && (tb === 'real' || tb === 'bool')) return new NumberValue(rs, a.toPrimitive('real') | b.toPrimitive('real'));
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
        if (tx === 'real') return new NumberValue(rs, factorial(n.value.a));
      },
      desc: `Calculate factorial of n. n must be a real, positive integer.`,
      syntax: 'a!',
      preservePosition: true,
    },
  };

  ops["!*"] = { // Internal multiplication for higher-precedence multiplication. Used for e.g. "2ln(2)" should be evaluated before "^"
    args: ops['*'].args,
    precedence: 100, // !CUSTOM
    fn: ops['*'].fn,
    desc: `Used internally for high-precedence multiplication`,
    syntax: 'a !* b',
  };

  return ops;
};


module.exports = { prepareOperators };