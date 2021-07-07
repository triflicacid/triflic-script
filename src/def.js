const Complex = require("./Complex");
const { EnvBuiltinFunction } = require("./function");
const { operators } = require("./utils");

/** Base definitions for an Environment */
function define(env) {
  /****************** VARIABLES */
  env.var('π', Math.PI); // pi
  env.var('pi', Math.PI); // pi
  env.var('e', Math.E); // e
  env.var('Ω', 0.56714329040978387299997); // W(1, 0)
  env.var('φ', 1.618033988749895); // phi, golden ratio
  env.var('phi', env.var('φ')); // phi, golden ratio
  env.var('τ', 2 * Math.PI); // tau
  env.var('i', Complex.I.copy()); // i

  env.var('ln2', Math.LN2);
  env.var('ln10', Math.LN10);
  env.var('log2e', Math.LOG2E);
  env.var('log10e', Math.LOG10E);
  env.var('√1_2', Math.SQRT1_2);
  env.var('√2', Math.SQRT2);

  env.var('nan', NaN);
  env.var('∞', Infinity);
  env.var('inf', Infinity);

  /****************** CORE FUNCTIONS */
  env.define(new EnvBuiltinFunction(env, 'exit', ['?c'], ({ c }) => {
    if (c === undefined) c = 0;
    console.log(`Terminating with exit code ${c}`);
    process.exit(0);
  }, 'exit application with given code'));
  env.define(new EnvBuiltinFunction(env, 'clear', [], () => {
    process.stdout.write('\033c');
  }, 'clears the screen'));
  env.define(new EnvBuiltinFunction(env, 'funcs', [], () => {
    for (let func in env._funcs) {
      if (env._funcs.hasOwnProperty(func)) {
        console.log(`- '${func}' \t ${env.func(func).defString()}`);
      }
    }
  }, 'list all defined functions'));
  env.define(new EnvBuiltinFunction(env, 'vars', ['?s'], ({ s }) => {
    if (s === undefined) {
      env._vars.forEach((scope, i) => {
        for (let v in scope) {
          if (scope.hasOwnProperty(v)) {
            console.log(`- [${i}]  '${v}' \t = \t ${env._vars[i][v]}`);
          }
        }
      });
    } else {
      if (s.isReal()) {
        s = s.a;
      } else {
        throw new Error(`Argument Error: unexpected complex number`);
      }
      if (env._vars[s] === undefined) throw new Error(`Argument Error: scope ${s} does not exist`);
      for (let v in env._vars[s]) {
        if (env._vars[s].hasOwnProperty(v)) {
          console.log(`- '${v}' \t = \t ${env._vars[s][v]}`);
        }
      }
    }
  }, 'list all defined variables in a given scope depth'));
  env.define(new EnvBuiltinFunction(env, 'operators', [], () => {
    console.log(` Operator | Syntax | Description`);
    for (let op in operators) {
      if (operators.hasOwnProperty(op)) {
        console.log(`- '${op}' \t ${operators[op].syntax} \t ${operators[op].desc}`);
      }
    }
  }, 'list all available operators'));

  /****************** MATHS FUNCTIONS */
  env.define(new EnvBuiltinFunction(env, 'abs', ['x'], ({ x }) => Complex.abs(x), 'calculate absolute value of x')); // abs
  env.define(new EnvBuiltinFunction(env, 'arccos', ['x'], ({ x }) => Complex.arccos(x), 'return arccosine of x')); // arccosine
  env.define(new EnvBuiltinFunction(env, 'arccosh', ['x'], ({ x }) => Complex.arccosh(x), 'return hyperbolic arccosine of x')); // hyperbolic arccosine
  env.define(new EnvBuiltinFunction(env, 'arcsin', ['x'], ({ x }) => Complex.arcsin(x), 'return arcsine of x')); // arcsine
  env.define(new EnvBuiltinFunction(env, 'arcsinh', ['x'], ({ x }) => Complex.arcsinh(x), 'return hyperbolic arcsine of x')); // hyperbolic arcsine
  env.define(new EnvBuiltinFunction(env, 'arctan', ['x'], ({ x }) => Complex.arctan(x), 'return arctangent of x')); // arctangent
  env.define(new EnvBuiltinFunction(env, 'arctanh', ['x'], ({ x }) => Complex.arctanh(x), 'return hyperbolic arctangent of x')); // hyperbolic arctangent
  env.define(new EnvBuiltinFunction(env, 'cbrt', ['x'], ({ x }) => Complex.cbrt(x), 'return cube root of x')); // cube root
  env.funcAlias('cbrt', '∛');
  env.define(new EnvBuiltinFunction(env, 'ceil', ['x'], ({ x }) => Complex.ceil(x), 'round x up to the nearest integer')); // ceiling (round up)
  env.define(new EnvBuiltinFunction(env, 'cos', ['x'], ({ x }) => Complex.cos(x), 'return cosine of x')); // cosine
  env.define(new EnvBuiltinFunction(env, 'cosh', ['x'], ({ x }) => Complex.cosh(x), 'return hyperbolic cosine of x')); // hyperbolic cosine
  env.define(new EnvBuiltinFunction(env, 'equals', ['a', 'b'], ({ a, b }) => +Complex.assert(a).equals(b), 'return 0 or 1 depending if a == b'));
  env.define(new EnvBuiltinFunction(env, 'exp', ['x'], ({ x }) => Complex.exp(x), 'return e^x')); // raise e to the x
  env.define(new EnvBuiltinFunction(env, 'floor', ['x'], ({ x }) => Complex.floor(x), 'round x down to the nearest integer')); // floor (round down)
  env.define(new EnvBuiltinFunction(env, 'isnan', ['x'], ({ x }) => +Complex.isNaN(x), 'return 0 or 1 depending on is x is NaN'));
  env.define(new EnvBuiltinFunction(env, 'isinf', ['x'], ({ x }) => Complex.isFinite(x) ? 0 : 1, 'return 0 or 1 depending on is x is infinite'));
  env.define(new EnvBuiltinFunction(env, 'ln', ['x'], ({ x }) => Complex.log(x), 'calculate the natural logarithm of x')); // natural logarithm
  env.define(new EnvBuiltinFunction(env, 'log', ['a', '?b'], ({ a, b }) => {
    if (b === undefined) { // log base 10 of <a>
      return Complex.div(Complex.log(a), Math.LN10);
    } else {
      return Complex.div(Complex.log(b), Complex.log(a)); // log base <a> of <b>
    }
  }, 'return log base <a> of <b>. If b is not provided, return log base 10 of <a>'));
  env.define(new EnvBuiltinFunction(env, 'random', ['?a', '?b'], ({ a, b }) => {
    if (a !== undefined && b === undefined) return Math.random() * a; // random(max)
    if (a !== undefined && b !== undefined) return (Math.random() * (b - a)) + b; // random(min, max)
    return Math.random();
  }, 'return a pseudo-random decimal number. Range: 0 arguments: 0-1. 1 argument: 0-a. 2 arguments: a-b'));
  env.define(new EnvBuiltinFunction(env, 'round', ['x'], ({ x }) => Complex.round(x), 'round x to the nearest integer')); // round
  env.define(new EnvBuiltinFunction(env, 'sin', ['x'], ({ x }) => Complex.sin(x), 'return sine of x')); // sine
  env.define(new EnvBuiltinFunction(env, 'sinh', ['x'], ({ x }) => Complex.sinh(x), 'return hyperbolic sine of x')); // hyperbolic sine
  env.define(new EnvBuiltinFunction(env, 'sqrt', ['x'], ({ x }) => Complex.sqrt(x), 'return square root of x')); // cube root
  env.funcAlias('sqrt', '√');
  env.define(new EnvBuiltinFunction(env, 'tan', ['x'], ({ x }) => Complex.tan(x), 'return tangent of x')); // tangent
  env.define(new EnvBuiltinFunction(env, 'tanh', ['x'], ({ x }) => Complex.tanh(x), 'return hyperbolic tangent of x')); // hyperbolic tangent
}

module.exports = { define };