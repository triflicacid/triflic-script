// "<operator>": {
//   precedence: <int>,       // Precedence of operator
//   args: <int>,             // Argument count
//   fn: ...,                 // Function called: (evalObj, ...args, data)
//   desc: <string>,          // Description of operator
//   syntax: <string>,        // Syntax of how operator is used
//   unary: <string|null>     // If present, and if operator meets unary criteria, use this operator instead
//   assoc: "ltr" | "rtl"
//   hidden?: <boolean>       // Hide operator i.e. operator is not an option in parsing. Optional.
// },

const { errors } = require("../errors");
const { sortObjectByLongestKey } = require("../utils");
const { UndefinedValue, StringValue } = require("./values");

const operators = {
  ".": {
    name: 'member access',
    precedence: 20,
    args: 2,
    fn: async (evalObj, obj, prop) => {
      if (typeof prop.getVar !== 'function') throw new Error(`[${errors.PROP}] Key Error: type ${prop.type()} is not a valid key`);
      obj = obj.castTo("any", evalObj);
      if (!obj.__get__) throw new Error(`[${errors.PROP}] Key Error: Cannot access property ${prop.value} of type ${obj.type()}`);
      return await obj.__get__(evalObj, new StringValue(obj.rs, prop.value));
    },
    desc: `Access property <prop> of <obj>`,
    syntax: '<obj>.<prop>',
    assoc: 'ltr',
  },
  "[]": {
    name: 'computed member access',
    precedence: 20,
    args: 1,
    fn: async (evalObj, obj, prop) => {
      obj = obj.castTo("any", evalObj);
      prop = await prop.eval(evalObj);
      if (!obj.__get__) throw new Error(`[${errors.PROP}] Key Error: Cannot access property ${prop} of type ${obj.type()}`);
      return await obj.__get__(evalObj, prop);
    },
    desc: `Evaluate <prop> and access property <prop> of <obj>`,
    syntax: '<obj>[<prop>]',
    assoc: 'ltr',
    hidden: true,
  },
  "()": {
    name: 'call',
    precedence: 20,
    args: 1,
    fn: async (evalObj, fn, args) => {
      fn = fn.castTo("any", evalObj);
      if (!fn.__call__) throw new Error(`[${errors.NOT_CALLABLE}] Type Error: Type ${fn.type()} is not callable ("${fn}")`);
      args = args.filter(tl => tl.tokens.length > 0);
      let newArgs = [], kwargs = new Map();
      for (let i = 0; i < args.length; i++) {
        if (typeof args[i].tokens[0]?.getVar === "function" && typeof args[i].tokens[args[i].tokens.length - 1]?.priority === "function") { // Keyword arg
          // Standard keyword argument
          if (args[i].tokens[args[i].tokens.length - 1].value === '=') {
            let name = args[i].tokens[0].value;
            if (kwargs.has(name)) throw new Error(`[${errors.NAME}] Name Error: duplicate keyword argument '${name}' at position ${args[i].tokens[0].pos}`);
            let oldTokens = args[i].tokens;
            args[i].tokens = args[i].tokens.slice(1).slice(0, oldTokens.length - 2);
            kwargs.set(name, await (await args[i].eval(evalObj)).castTo("any", evalObj));
            args[i].tokens = oldTokens;
            continue;
          } else if (args[i].tokens.length === 3 && args[i].tokens[2].value === '=>') {
            // Keyword argument by ref
            let name = args[i].tokens[0].value;
            if (typeof args[i].tokens[1].getVar === "function") {
              if (kwargs.has(name)) throw new Error(`[${errors.NAME}] Name Error: duplicate keyword argument '${name}' at position ${args[i].tokens[0].pos}`);
              kwargs.set(name, args[i].tokens[1]);
            } else {
              throw new Error(`[${errors.SYNTAX}] Syntax Error: expected '<symbol> => <symbol>' at position ${args[i].tokens[0].pos}`);
            }
            continue;
          }
        }

        let ellipse = false;
        if (args[i].tokens[0]?.value === '...') { // '...' ?
          ellipse = args[i].tokens[0];
          args[i].tokens.splice(0, 1);
        }
        let newArg = await args[i].eval(evalObj);
        if (ellipse) { // Expand array-like
          let arr;
          try { arr = newArg.toPrimitive('array'); } catch { throw new Error(`[${errors.TYPE_ERROR}] Type Error: '...': cannot expand type ${newArg.type()} at position ${ellipse.pos + 4}`); }
          newArgs.push(...arr);
        } else {
          newArgs.push(newArg);
        }
      }
      return await fn.__call__(evalObj, newArgs, kwargs);
    },
    desc: `calls function with given arguments`,
    syntax: '<func>(<args>)',
    assoc: 'ltr',
    hidden: true,
  },
  "?.": {
    name: 'optional member access',
    precedence: 20,
    args: 2,
    fn: async (evalObj, obj, prop) => {
      obj = obj.castTo('any', evalObj);
      if (obj instanceof UndefinedValue) return new UndefinedValue(obj.rs);
      if (!obj.__get__) throw new Error(`[${errors.PROP}] Key Error: Cannot access property ${prop} of type ${obj.type()}`);
      return await obj.__get__(evalObj, new StringValue(obj.rs, prop.value));
    },
    desc: `Access property <prop> of <obj>`,
    syntax: '<obj>.<prop>',
    assoc: 'ltr',
  },
  "deg": { // !CUSTOM; degrees to radians
    name: 'degrees',
    precedence: 18,
    args: 1,
    fn: (evalObj, z) => z.castTo('any', evalObj).__deg__?.(evalObj),
    desc: `Take argument as degrees and convert to radians`,
    syntax: '<a>deg',
    assoc: 'rtl',
  },
  "!": {
    name: 'logical not',
    precedence: 17,
    args: 1,
    fn: (evalObj, x) => x.castTo('any', evalObj).__not__?.(evalObj),
    desc: `logical not unless x is of type set. Then, find complement of x (using universal set, ε)`,
    syntax: 'x!',
    assoc: 'rtl',
  },
  "~": {
    name: 'bitwise not',
    precedence: 17,
    args: 1,
    fn: (evalObj, x) => x.castTo('any', evalObj).__bitwiseNot__?.(evalObj),
    desc: `Bitwise NOT`,
    syntax: '~x',
    assoc: 'rtl',
  },
  "u+": {
    name: 'unary plus',
    precedence: 17,
    args: 1,
    fn: (eo, n) => n.castTo('any', eo).__pos__?.(eo),
    desc: 'cast n into a number',
    syntax: '+n',
    unary: "u+",
    assoc: 'rtl',
  },
  "u-": {
    name: 'unary minus',
    precedence: 17,
    args: 1,
    fn: (eo, n) => n.castTo('any', eo).__neg__?.(eo),
    desc: 'cast n into a negative number',
    syntax: '-n',
    unary: "u-",
    assoc: 'rtl',
  },
  "<cast>": {
    name: 'cast',
    precedence: 17,
    args: 1,
    fn: (evalObj, val, type) => val.castTo(type, evalObj),
    desc: `attempt to cast <val> to type <type>`,
    syntax: '<type> value',
    unary: "<cast>",
    assoc: 'rtl',
    hidden: true,
  },
  "?": {
    name: 'boolean cast',
    precedence: 17,
    args: 1,
    fn: (evalObj, val) => val.castTo("bool", evalObj),
    desc: `attempt to cast <val> to a boolean`,
    syntax: 'value?',
    unary: "?",
    assoc: 'ltr',
  },
  "**": {
    name: 'exponentation',
    precedence: 16,
    args: 2,
    fn: (evalObj, a, b) => a.castTo('any', evalObj).__pow__?.(evalObj, b.castTo('any', evalObj)),
    desc: `exponentation: raise a to the b`,
    syntax: 'a ** b',
    assoc: 'rtl',
  },
  ":": {
    name: 'sequence',
    precedence: 16,
    args: 2,
    fn: (evalObj, a, b) => a.castTo('any', evalObj).__seq__?.(evalObj, b.castTo('any', evalObj)),
    desc: `generates sequence a to b`,
    syntax: 'a:b',
    assoc: 'rtl',
  },
  "/": {
    name: 'division',
    precedence: 15,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__div__?.(eo, b.castTo('any', eo)),
    desc: `a ÷ b`,
    syntax: 'a / b',
    assoc: 'ltr',
  },
  "%": {
    name: 'modulo',
    precedence: 15,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__mod__?.(eo, b.castTo('any', eo)),
    desc: `a % b (remainder of a ÷ b)`,
    syntax: 'a % b',
    assoc: 'ltr',
  },
  "*": {
    name: 'multiplication',
    precedence: 15,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__mul__?.(eo, b.castTo('any', eo)),
    desc: `a × b`,
    syntax: 'a * b',
    assoc: 'ltr',
  },
  "+": {
    name: 'addition',
    precedence: 14,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__add__?.(eo, b.castTo('any', eo)),
    desc: `a + b`,
    syntax: 'a + b',
    unary: 'u+',
    assoc: 'ltr',
  },
  "-": {
    name: 'subtract',
    precedence: 14,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__sub__?.(eo, b.castTo('any', eo)),
    desc: `a - b`,
    syntax: 'a - b',
    unary: 'u-',
    assoc: 'ltr',
  },
  "<<": {
    name: 'left shift',
    precedence: 13,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__lshift__?.(eo, b.castTo('any', eo)),
    desc: `Bitwise left shift a by b places`,
    syntax: 'a << b',
    assoc: 'ltr',
  },
  ">>": {
    name: 'right shift',
    precedence: 13,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__rshift__?.(eo, b.castTo('any', eo)),
    desc: `Bitwise right shift a by b places`,
    syntax: 'a >> b',
    assoc: 'ltr',
  },
  "<=": {
    name: 'less than or equal to',
    precedence: 12,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__le__?.(eo, b.castTo('any', eo)),
    desc: `a less than or equal to b`,
    syntax: 'a <= b',
    assoc: 'ltr',
  },
  "<": {
    name: 'less than',
    precedence: 12,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__lt__?.(eo, b.castTo('any', eo)),
    desc: `a less than b`,
    syntax: 'a < b',
    assoc: 'ltr',
  },
  ">=": {
    name: 'greater than or equal to',
    precedence: 12,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__ge__?.(eo, b.castTo('any', eo)),
    desc: `a greater than or equal to b`,
    syntax: 'a >= b',
    assoc: 'ltr',
  },
  ">": {
    name: 'greater than',
    precedence: 12,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__gt__?.(eo, b.castTo('any', eo)),
    desc: `a greater than b`,
    syntax: 'a > b',
    assoc: 'ltr',
  },
  "in ": {
    name: 'in',
    precedence: 12,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__in__?.(eo, b.castTo('any', eo)),
    desc: `check if <a> is in <b>. (NB a space after 'in' is required)`,
    syntax: 'a in b',
    assoc: 'rtl',
  },
  "==": {
    name: 'equality',
    precedence: 11,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__eq__?.(eo, b.castTo('any', eo)),
    desc: `a equal to b`,
    syntax: 'a == b',
    assoc: 'ltr',
  },
  "!=": {
    name: 'inequality',
    precedence: 11,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__neq__?.(eo, b.castTo('any', eo)),
    desc: `a not equal to b`,
    syntax: 'a != b',
    assoc: 'ltr',
  },
  "&": {
    name: 'bitwise and',
    precedence: 10,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__bitwiseAnd__?.(eo, b.castTo('any', eo)),
    desc: `Bitwise AND`,
    syntax: 'a & b',
    assoc: 'ltr',
  },
  "^": {
    name: 'bitwise xor',
    precedence: 9,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__xor__?.(eo, b.castTo('any', eo)),
    desc: `Bitwise XOR`,
    syntax: 'a ^ b',
    assoc: 'ltr',
  },
  "|": {
    name: 'bitwise or',
    precedence: 8,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__bitwiseOr__?.(eo, b.castTo('any', eo)),
    desc: `Bitwise OR`,
    syntax: 'a | b',
    assoc: 'ltr',
  },
  "&&": {
    name: 'logical and',
    precedence: 7,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__and__?.(eo, b.castTo('any', eo)),
    desc: `Logical AND`,
    syntax: 'a && b',
    assoc: 'ltr',
  },
  "||": {
    name: 'logical or',
    precedence: 6,
    args: 2,
    fn: (eo, a, b) => a.castTo('any', eo).__or__?.(eo, b.castTo('any', eo)),
    desc: `Logical OR`,
    syntax: 'a || b',
    assoc: 'ltr',
  },
  "??": {
    name: 'nullish coalescing',
    precedence: 5,
    args: 2,
    fn: (eo, a, b) => a.castTo("any", eo) instanceof UndefinedValue ? b : a,
    desc: `Returns <a> unless it is undefined, in which case return <b>`,
    syntax: 'a ?? b',
    assoc: 'ltr',
  },
  "?:": {
    name: 'conditional',
    precedence: 4,
    args: 0,
    fn: async (evalObj, [cond, if1, if0]) => {
      let bool = await cond.eval(evalObj);
      bool = bool.castTo('bool', evalObj);
      if (bool.value) {
        return await if1.eval(evalObj);
      } else {
        return if0 ? await if0.eval(evalObj) : bool;
      }
    },
    desc: `Returns <b> if <a> is truthy, else <c> (or false)`,
    syntax: '(<a>) ? (<b>) [: <c>]',
    assoc: 'rtl',
    hidden: true
  },
  "=": {
    name: 'assignment',
    precedence: 3,
    args: 2,
    fn: (eo, symbol, value) => symbol.__assign__?.(eo, value),
    desc: 'Set symbol <symbol> equal to <v>',
    syntax: 'symbol = v',
    assoc: 'rtl',
  },
  "=>": {
    name: 'nonlocal assignment',
    precedence: 3,
    args: 2,
    fn: (eo, symbol, value) => symbol.__nonlocalAssign__?.(eo, value.castTo("any")),
    desc: 'Set symbol <symbol> in nonlocal scope equal to <v>',
    syntax: 'symbol => v',
    assoc: 'rtl',
  },
  "+=": {
    name: 'addition assignment',
    precedence: 3,
    args: 2,
    fn: (eo, symbol, value) => symbol.__assignAdd__?.(eo, value),
    desc: 'Add <v> to <symbol>',
    syntax: 'symbol += v',
    assoc: 'rtl',
  },
  "-=": {
    name: 'subtraction assignment',
    precedence: 3,
    args: 2,
    fn: (eo, symbol, value) => symbol.__assignSub__?.(eo, value),
    desc: 'Subtract <v> from <symbol>',
    syntax: 'symbol -= v',
    assoc: 'rtl',
  },
  "*=": {
    name: 'multiplication assignment',
    precedence: 3,
    args: 2,
    fn: (eo, symbol, value) => symbol.__assignMul__?.(eo, value),
    desc: 'Multiply <symbol> by <v>',
    syntax: 'symbol *= v',
    assoc: 'rtl',
  },
  "/=": {
    name: 'division assignment',
    precedence: 3,
    args: 2,
    fn: (eo, symbol, value) => symbol.__assignDiv__?.(eo, value),
    desc: 'Divide <symbol> by <v>',
    syntax: 'symbol /= v',
    assoc: 'rtl',
  },
  "%=": {
    name: 'modulus assignment',
    precedence: 3,
    args: 2,
    fn: (eo, symbol, value) => symbol.__assignMod__?.(eo, value),
    desc: 'Sets <symbol> to <symbol> % <v>',
    syntax: 'symbol %= v',
    assoc: 'rtl',
  },
  ",": {
    name: 'comma',
    precedence: 1,
    args: 2,
    fn: (eo, lhs, rhs) => rhs,
    desc: 'Used to seperate statements. Evaluates <lhs> and <rhs>, but only returns <rhs>',
    syntax: '<statement>, <statement>',
    assoc: 'ltr',
  }
};
module.exports = sortObjectByLongestKey(operators);