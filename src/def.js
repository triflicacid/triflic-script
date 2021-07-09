const Complex = require("./Complex");
const { EnvBuiltinFunction } = require("./function");
const lambertw = require("./lambertw");
const { OperatorToken, VariableToken, NumberToken, NonNumericalToken, FunctionRefToken } = require("./token");
const { operators, print, isPrime, LCF, primeFactors, assertReal, factorial } = require("./utils");

/** Base definitions for an Environment */
function define(env) {
  /****************** VARIABLES */
  env.var('pi', Math.PI, 'pi is equal to the circumference of any circle divided by its diameter'); // pi
  env.var('π', env.var('pi'));
  env.var('e', Math.E); // e
  env.var('omega', 0.56714329040978387299997, 'Principle solution to xe^x = 1 (= W(1))'); // W(1, 0)
  env.var('Ω', env.var('omega'));
  env.var('phi', 1.618033988749895, 'Phi, the golden ratio, approx (1 + √5)/2'); // phi, golden ratio
  env.var('φ', env.var('phi'));
  env.var('tau', 2 * Math.PI, 'A constant representing the ratio between circumference and radius of a circle'); // tau
  env.var('τ', env.var('tau'));
  env.var('i', Complex.I.copy(), '√(-1)'); // i

  env.var('ln2', Math.LN2, 'Natural logarithm of 2');
  env.var('ln10', Math.LN10, 'Natural logarithm of 10');
  env.var('log2e', Math.LOG2E, 'Base-2 logarithm of e');
  env.var('log10e', Math.LOG10E, 'Base-10 logarithm of e');
  env.var('sqrt1_2', Math.SQRT1_2, 'Square root of 0.5');
  env.var('sqrt2', Math.SQRT2, 'Square root of 2');

  env.var('nan', NaN, 'Value representing Not A Number');
  env.var('inf', Infinity, 'Value representing Infinity');
  env.var('∞', env.var('inf'));

  /****************** CORE FUNCTIONS */
  env.define(new EnvBuiltinFunction(env, 'help', ['?item'], ({ item }) => {
    let help = '0';
    if (item === undefined) {
      help = `help(?s) \t Get help on a specific symbol\nvars() \t List all variables\nfuncs() \t List all functions\noperators() \t List all operators\nexit() \t Terminate the program`;
    } else if (item instanceof OperatorToken) {
      let info = operators[item];
      help = `Type: operator\nDesc: ${info.desc}\nPrecedence: ${info.precedence}\nSyntax: ${info.syntax}`;
    } else if (item instanceof FunctionRefToken) {
      let fn = item.getFn();
      if (fn === undefined) {
        throw new Error(`Reference Error: null reference ${item} - unable to retrieve help`);
      } else {
        let type = fn instanceof EnvBuiltinFunction ? 'built-in' : 'user-defined'
        help = `Type: function [${type}]\nDesc: ${fn.about()}\nSyntax: ${fn.defString()}`;
      }
    } else if (item instanceof VariableToken) {
      let v = env.var(item);
      help = `Type: variable\nDesc: ${v.desc}\nValue: ${v.eval()}`;
    } else if (item instanceof NumberToken) {
      help = `Type: number\nValue: ${item.eval()}`;
    } else if (item instanceof NonNumericalToken) {
      if (operators[item.value] === undefined) {
        let nval;
        try { nval = item.eval(); } catch (e) { nval = '[failed]'; }
        help = `Type: non-numerical (${typeof item.value})\nRaw Value: ${item.value}\nNum Value: ${nval}`;
      } else {
        let info = operators[item.value];
        return `Type: operator\nDesc: ${info.desc}\nPrecedence: ${info.precedence}\nSyntax: ${info.syntax}`;
      }
    } else {
      throw new Error(`Cannot retrieve help on given argument`);
    }
    return help;
  }, 'Get general help or help on a provided argument', 1)); // evalState=1; get eval'd value from TokenString, still a Token though
  env.define(new EnvBuiltinFunction(env, 'del', ['item'], ({ item }) => {
    if (item instanceof VariableToken) {
      return +env.var(item.value, null);
    } else if (item instanceof FunctionRefToken) {
      let fn = item.getFn();
      if (fn instanceof EnvBuiltinFunction) return 0;
      return +env.func(item.value, null);
    } else {
      // throw new Error(`Argument Error: Cannot remove provided symbol`);
      return 0;
    }
  }, 'attempt to delete provided symbol, returning 0 or 1 upon success', 1));
  env.define(new EnvBuiltinFunction(env, 'exit', ['?c'], ({ c }) => {
    if (c === undefined) c = 0;
    print(`Terminating with exit code ${c}`);
    process.exit(0);
  }, 'exit application with given code'));
  env.define(new EnvBuiltinFunction(env, 'clear', [], () => {
    process.stdout.write('\033c');
  }, 'clears the screen'));
  env.define(new EnvBuiltinFunction(env, 'funcs', [], () => {
    let output = '';
    for (let func in env._funcs) {
      if (env._funcs.hasOwnProperty(func)) {
        let fn = env.func(func);
        output += `- [${fn instanceof EnvBuiltinFunction ? 'BUILT-IN' : 'USER-DEF'}] '${func}' \t ${fn.defString()}\n`;
      }
    }
    return output;
  }, 'list all defined functions'));
  env.define(new EnvBuiltinFunction(env, 'vars', ['?s'], ({ s }) => {
    let output = '';
    if (s === undefined) {
      env._vars.forEach((scope, i) => {
        for (let v in scope) {
          if (scope.hasOwnProperty(v)) {
            output += `- [${i}]  '${v}' \t = \t ${env._vars[i][v].eval()}\n`;
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
          output += `- '${v}' \t = \t ${env._vars[s][v].eval()}\n`;
        }
      }
    }
    return output;
  }, 'list all defined variables in a given scope depth'));
  env.define(new EnvBuiltinFunction(env, 'operators', [], () => {
    let output = `Precedence | Operator | Syntax | Description\n`;
    for (let op in operators) {
      if (operators.hasOwnProperty(op)) {
        output += `- ${operators[op].precedence} \t '${op}' \t ${operators[op].syntax} \t ${operators[op].desc}\n`;
      }
    }
    return output;
  }, 'list all available operators'));
  env.define(new EnvBuiltinFunction(env, 'logical', ['?v'], ({ v }) => {
    if (v !== undefined) {
      assertReal(v);
      env.logical = !!v.a;
    }
    return `Logical Mode: ${env.v ? 'On' : 'Off'}`;
  }, 'View or enable/disable logical mode. Logical mode changes the behaviour of some operators to be logical (e.g. "!" factorial <-> logical not'));

  /****************** MATHS FUNCTIONS */
  env.define(new EnvBuiltinFunction(env, 'abs', ['x'], ({ x }) => Complex.abs(x), 'calculate absolute value of x')); // abs
  env.define(new EnvBuiltinFunction(env, 'arccos', ['x'], ({ x }) => Complex.arccos(x), 'return arccosine of x')); // arccosine
  env.define(new EnvBuiltinFunction(env, 'arccosh', ['x'], ({ x }) => Complex.arccosh(x), 'return hyperbolic arccosine of x')); // hyperbolic arccosine
  env.define(new EnvBuiltinFunction(env, 'arcsin', ['x'], ({ x }) => Complex.arcsin(x), 'return arcsine of x')); // arcsine
  env.define(new EnvBuiltinFunction(env, 'arcsinh', ['x'], ({ x }) => Complex.arcsinh(x), 'return hyperbolic arcsine of x')); // hyperbolic arcsine
  env.define(new EnvBuiltinFunction(env, 'arctan', ['x'], ({ x }) => Complex.arctan(x), 'return arctangent of x')); // arctangent
  env.define(new EnvBuiltinFunction(env, 'arctanh', ['x'], ({ x }) => Complex.arctanh(x), 'return hyperbolic arctangent of x')); // hyperbolic arctangent
  env.define(new EnvBuiltinFunction(env, 'arg', ['z'], ({ z }) => z.arg(), 'return the argument of z'));
  env.define(new EnvBuiltinFunction(env, 'cbrt', ['x'], ({ x }) => Complex.cbrt(x), 'return cube root of x')); // cube root
  env.funcAlias('cbrt', '∛');
  env.define(new EnvBuiltinFunction(env, 'ceil', ['x'], ({ x }) => Complex.ceil(x), 'round x up to the nearest integer')); // ceiling (round up)
  env.define(new EnvBuiltinFunction(env, 'conj', ['z'], ({ z }) => Complex.assert(z).conjugate(), 'return z* (the configate) of z'));
  env.define(new EnvBuiltinFunction(env, 'cos', ['x'], ({ x }) => Complex.cos(x), 'return cosine of x')); // cosine
  env.define(new EnvBuiltinFunction(env, 'cosh', ['x'], ({ x }) => Complex.cosh(x), 'return hyperbolic cosine of x')); // hyperbolic cosine
  env.define(new EnvBuiltinFunction(env, 'time', [], () => Date.now(), 'returns the number of milliseconds elapsed since January 1, 1970 00:00:00 UTC'));
  env.define(new EnvBuiltinFunction(env, 'exp', ['x'], ({ x }) => Complex.exp(x), 'return e^x')); // raise e to the x
  env.define(new EnvBuiltinFunction(env, 'floor', ['x'], ({ x }) => Complex.floor(x), 'round x down to the nearest integer')); // floor (round down)
  env.define(new EnvBuiltinFunction(env, 'isnan', ['x'], ({ x }) => +Complex.isNaN(x), 'return 0 or 1 depending on is x is NaN'));
  env.define(new EnvBuiltinFunction(env, 'isinf', ['x'], ({ x }) => Complex.isFinite(x) ? 0 : 1, 'return 0 or 1 depending on is x is infinite'));
  env.define(new EnvBuiltinFunction(env, 'isprime', ['x'], ({ x }) => {
    assertReal(x);
    return +isPrime(x.a);
  }, 'return 0 or 1 depending on if x is prime'));
  env.define(new EnvBuiltinFunction(env, 'factors', ['x'], ({ x }) => {
    assertReal(x);
    let f = primeFactors(x.a);
    return f.length === 0 ? '[none]' : f.join(' * ');
  }, 'return prime factors of x'));
  env.define(new EnvBuiltinFunction(env, 'factorial', ['x'], ({ x }) => {
    assertReal(x);
    return new Complex(factorial(x.a));
  }, 'calculate the factorial of x'));
  env.define(new EnvBuiltinFunction(env, 'ln', ['x'], ({ x }) => Complex.log(x), 'calculate the natural logarithm of x')); // natural logarithm
  env.define(new EnvBuiltinFunction(env, 'log', ['a', '?b'], ({ a, b }) => {
    return b === undefined ?
      Complex.div(Complex.log(a), Math.LN10) :// log base 10 of <a>
      Complex.div(Complex.log(a), Complex.log(b));// log base <a> of <b>
  }, 'return log base <a> of <b>. If b is not provided, return log base 10 of <a>'));
  env.define(new EnvBuiltinFunction(env, 'lcf', ['a', 'b'], ({ a, b }) => {
    assertReal(a, b);
    return LCF(a.a, b.a);
  }, 'return the lowest common factor of a and b'));
  env.define(new EnvBuiltinFunction(env, 'random', ['?a', '?b'], ({ a, b }) => {
    if (a !== undefined && b === undefined) { assertReal(a); return Math.random() * a.a; } // random(max)
    if (a !== undefined && b !== undefined) { assertReal(a, b); return (Math.random() * (b.a - a.a)) + a.a; } // random(min, max)
    return Math.random();
  }, 'return a pseudo-random decimal number. Range: 0 arguments: 0-1. 1 argument: 0-a. 2 arguments: a-b'));
  env.define(new EnvBuiltinFunction(env, 'round', ['x', '?dp'], ({ x, dp }) => {
    if (dp === undefined) return Complex.round(x);
    assertReal(dp);
    return Complex.roundDp(x, Math.floor(dp.a));
  }, 'round x to the nearest integer, or to <dp> decimal places')); // round
  env.define(new EnvBuiltinFunction(env, 'isreal', ['x'], ({ x }) => +x.isReal(), 'return 0 or 1 depending on if z is real'));
  env.define(new EnvBuiltinFunction(env, 'Re', ['x'], ({ x }) => x.a, 'return real component of x'));
  env.define(new EnvBuiltinFunction(env, 'Im', ['x'], ({ x }) => x.b, 'return imaginary component of x'));
  env.define(new EnvBuiltinFunction(env, 'sin', ['x'], ({ x }) => Complex.sin(x), 'return sine of x')); // sine
  env.define(new EnvBuiltinFunction(env, 'sinh', ['x'], ({ x }) => Complex.sinh(x), 'return hyperbolic sine of x')); // hyperbolic sine
  env.define(new EnvBuiltinFunction(env, 'sqrt', ['x'], ({ x }) => Complex.sqrt(x), 'return square root of x')); // cube root
  env.funcAlias('sqrt', '√');
  env.define(new EnvBuiltinFunction(env, 'tan', ['x'], ({ x }) => Complex.tan(x), 'return tangent of x')); // tangent
  env.define(new EnvBuiltinFunction(env, 'tanh', ['x'], ({ x }) => Complex.tanh(x), 'return hyperbolic tangent of x')); // hyperbolic tangent
  env.define(new EnvBuiltinFunction(env, 'W', ['z', '?k', '?tol'], ({ z, k, tol }) => lambertw(z, k, tol), 'return approximation of the Lambert W function at <k> branch with <tol> tolerance'));
}

module.exports = { define };