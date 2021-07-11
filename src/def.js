const Complex = require("./maths/Complex");
const { RunspaceBuiltinFunction } = require("./runspace/Function");
const operators = require("./evaluation/operators");
const { parseVariable } = require("./evaluation/parse");
const { OperatorToken, VariableToken, NumberToken, NonNumericalToken, FunctionRefToken, TokenString } = require("./evaluation/tokens");
const { lambertw, isPrime, LCF, primeFactors, factorial, generatePrimes } = require("./maths/functions");
const { print, assertReal, } = require("./utils");


/** Base definitions for an Environment */
function define(env, defVariables = true, defFuncs = true) {
  /****************** VARIABLES */
  if (defVariables) {
    env.var('pi', Math.PI, 'pi is equal to the circumference of any circle divided by its diameter'); // pi
    env.var('π', env.var('pi'));
    env.var('e', Math.E); // e
    env.var('omega', 0.56714329040978387299997, 'Principle solution to xe^x = 1 (= W(1))'); // W(1, 0)
    env.var('Ω', env.var('omega'));
    env.var('phi', 1.618033988749895, 'Phi, the golden ratio, approx (1 + √5)/2'); // phi, golden ratio
    env.var('φ', env.var('phi'));
    env.var('tau', 2 * Math.PI, 'A constant representing the ratio between circumference and radius of a circle'); // tau
    env.var('τ', env.var('tau'));
    env.var('i', Complex.I(), '√(-1)'); // i

    env.var('ln2', Math.LN2, 'Natural logarithm of 2');
    env.var('ln10', Math.LN10, 'Natural logarithm of 10');
    env.var('log2e', Math.LOG2E, 'Base-2 logarithm of e');
    env.var('log10e', Math.LOG10E, 'Base-10 logarithm of e');
    env.var('sqrt1_2', Math.SQRT1_2, 'Square root of 0.5');
    env.var('sqrt2', Math.SQRT2, 'Square root of 2');

    env.var('nan', NaN, 'Value representing Not A Number');
    env.var('inf', Infinity, 'Value representing Infinity');
    env.var('∞', env.var('inf'));
  }

  /****************** CORE FUNCTIONS */
  env.define(new RunspaceBuiltinFunction(env, 'help', { item: '?any' }, ({ item }) => {
    let help = '';
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
        let type = fn instanceof RunspaceBuiltinFunction ? 'built-in' : 'user-defined'
        help = `Type: function [${type}]\nDesc: ${fn.about()}\nSyntax: ${fn.defString()}`;
      }
    } else if (item instanceof VariableToken) {
      let v = env.var(item);
      help = `Type: variable\nDesc: ${v.desc}\nValue: ${v.eval('any')}`;
    } else if (item instanceof NumberToken) {
      help = `Type: number\nValue: ${item.eval('complex')}`;
    } else if (item instanceof NonNumericalToken) {
      if (operators[item.value] === undefined) {
        help = `Type: non-numerical (${typeof item.value})\nRaw Value: ${item.eval("any")}\nNum Value: ${item.eval("complex")}`;
      } else {
        let info = operators[item.value];
        return `Type: operator\nDesc: ${info.desc}\nPrecedence: ${info.precedence}\nSyntax: ${info.syntax}`;
      }
    } else {
      throw new Error(`Cannot retrieve help on given argument`);
    }
    return help;
  }, 'Get general help or help on a provided argument', false));
  env.define(new RunspaceBuiltinFunction(env, 'del', { item: 'any' }, ({ item }) => {
    if (item instanceof VariableToken) {
      return +env.var(item.value, null);
    } else if (item instanceof FunctionRefToken) {
      let fn = item.getFn();
      if (fn instanceof RunspaceBuiltinFunction) return 0;
      return +env.func(item.value, null);
    } else {
      // throw new Error(`Argument Error: Cannot remove provided symbol`);
      return 0;
    }
  }, 'attempt to delete provided symbol, returning 0 or 1 upon success', false));
  env.define(new RunspaceBuiltinFunction(env, 'exit', { c: '?real_int' }, ({ c }) => {
    if (c === undefined) c = 0;
    print(`Terminating with exit code ${c}`);
    process.exit(0);
  }, 'exit application with given code'));
  env.define(new RunspaceBuiltinFunction(env, 'clear', {}, () => +process.stdout.write('\033c'), 'clears the screen'));
  env.define(new RunspaceBuiltinFunction(env, 'funcs', {}, () => {
    let output = '';
    for (let func in env._funcs) {
      if (env._funcs.hasOwnProperty(func)) {
        let fn = env.func(func);
        output += `- [${fn instanceof RunspaceBuiltinFunction ? 'BUILT-IN' : 'USER-DEF'}] '${func}' \t ${fn.defString()}\n`;
      }
    }
    return output.substr(0, output.length - 1); // Remove final '\n'
  }, 'list all defined functions'));
  env.define(new RunspaceBuiltinFunction(env, 'vars', { s: '?real_int' }, ({ s }) => {
    let output = '';
    if (s === undefined) {
      env._vars.forEach((scope, i) => {
        for (let v in scope) {
          if (scope.hasOwnProperty(v)) {
            output += `- [${i}]  '${v}' \t = \t ${env._vars[i][v].eval('string')}\n`;
          }
        }
      });
    } else {
      if (env._vars[s] === undefined) throw new Error(`Argument Error: scope ${s} does not exist`);
      for (let v in env._vars[s]) {
        if (env._vars[s].hasOwnProperty(v)) {
          output += `- '${v}' \t = \t ${env._vars[s][v].eval('string')}\n`;
        }
      }
    }
    return output;
  }, 'list all defined variables in a given scope depth'));
  env.define(new RunspaceBuiltinFunction(env, 'operators', { h: '?real' }, ({ h }) => {
    let output = h === 0 ? '' : `Precedence | Operator | Syntax | Description\n`;
    for (let op in operators) {
      if (operators.hasOwnProperty(op)) {
        output += `- ${operators[op].precedence} \t '${op}' \t ${operators[op].syntax} \t ${operators[op].desc}\n`;
      }
    }
    return output.substr(0, output.length - 1); // Remove final '\n'
  }, 'list all available operators (<h>: show headers?)'));
  env.define(new RunspaceBuiltinFunction(env, 'cast', { o: 'any', type: 'string' }, ({ o, type }) => o.eval(type.eval("string")), 'attempt a direct cast from object <o> to type <type>', false));
  // env.define(new RunspaceBuiltinFunction(env, 'logical', ['?v'], ({ v }) => {
  //   if (v !== undefined) {
  //     assertReal(v);
  //     env.logical = !!v.a;
  //   }
  //   return `Logical Mode: ${env.v ? 'On' : 'Off'}`;
  // }, 'View or enable/disable logical mode. Logical mode changes the behaviour of some operators to be logical (e.g. "!" factorial <-> logical not'));

  /****************** MATHS FUNCTIONS */
  if (defFuncs) {
    env.define(new RunspaceBuiltinFunction(env, 'abs', { z: 'complex' }, ({ z }) => Complex.abs(z), 'calculate absolute value of z')); // abs
    env.define(new RunspaceBuiltinFunction(env, 'arccos', { z: 'complex' }, ({ z }) => Complex.arccos(z), 'return arccosine of z')); // arccosine
    env.define(new RunspaceBuiltinFunction(env, 'arccosh', { z: 'complex' }, ({ z }) => Complex.arccosh(z), 'return hyperbolic arccosine of z')); // hyperbolic arccosine
    env.define(new RunspaceBuiltinFunction(env, 'arcsin', { z: 'complex' }, ({ z }) => Complex.arcsin(z), 'return arcsine of z')); // arcsine
    env.define(new RunspaceBuiltinFunction(env, 'arcsinh', { z: 'complex' }, ({ z }) => Complex.arcsinh(z), 'return hyperbolic arcsine of z')); // hyperbolic arcsine
    env.define(new RunspaceBuiltinFunction(env, 'arctan', { z: 'complex' }, ({ z }) => Complex.arctan(z), 'return arctangent of z')); // arctangent
    env.define(new RunspaceBuiltinFunction(env, 'arctanh', { z: 'complex' }, ({ z }) => Complex.arctanh(z), 'return hyperbolic arctangent of z')); // hyperbolic arctangent
    env.define(new RunspaceBuiltinFunction(env, 'arg', { z: 'complex' }, ({ z }) => z.arg(), 'return the argument of z'));
    env.define(new RunspaceBuiltinFunction(env, 'cbrt', { z: 'complex' }, ({ z }) => Complex.cbrt(z), 'return cube root of x')); // cube root
    env.funcAlias('cbrt', '∛');
    env.define(new RunspaceBuiltinFunction(env, 'ceil', { z: 'complex' }, ({ z }) => Complex.ceil(z), 'round x up to the nearest integer')); // ceiling (round up)
    env.define(new RunspaceBuiltinFunction(env, 'conj', { z: 'complex' }, ({ z }) => z.conjugate(), 'return z* (the configate) of z'));
    env.define(new RunspaceBuiltinFunction(env, 'cos', { z: 'complex' }, ({ z }) => Complex.cos(z), 'return cosine of x')); // cosine
    env.define(new RunspaceBuiltinFunction(env, 'cosh', { z: 'complex' }, ({ z }) => Complex.cosh(z), 'return hyperbolic cosine of x')); // hyperbolic cosine
    env.define(new RunspaceBuiltinFunction(env, 'time', {}, () => Date.now(), 'returns the number of milliseconds elapsed since January 1, 1970 00:00:00 UTC'));
    env.define(new RunspaceBuiltinFunction(env, 'exp', { z: 'complex' }, ({ z }) => Complex.exp(z), 'return e^x')); // raise e to the x
    env.define(new RunspaceBuiltinFunction(env, 'floor', { z: 'complex' }, ({ z }) => Complex.floor(z), 'round x down to the nearest integer')); // floor (round down)
    env.define(new RunspaceBuiltinFunction(env, 'isnan', { z: 'complex' }, ({ z }) => +Complex.isNaN(z), 'return 0 or 1 depending on is x is NaN'));
    env.define(new RunspaceBuiltinFunction(env, 'isinf', { z: 'complex' }, ({ z }) => Complex.isFinite(z) ? 0 : 1, 'return 0 or 1 depending on is x is infinite'));
    env.define(new RunspaceBuiltinFunction(env, 'isprime', { x: 'real' }, ({ x }) => +isPrime(x), 'return 0 or 1 depending on if x is prime'));
    env.define(new RunspaceBuiltinFunction(env, 'primes', { limit: 'real' }, ({ limit }) => generatePrimes(limit), 'generate list of primes 0..limit'));

    env.define(new RunspaceBuiltinFunction(env, 'factors', { x: 'real' }, ({ x }) => primeFactors(x), 'return prime factors of x'));
    env.define(new RunspaceBuiltinFunction(env, 'factorial', { x: 'real' }, ({ x }) => factorial(x), 'calculate the factorial of x'));
    env.define(new RunspaceBuiltinFunction(env, 'len', { o: 'any' }, ({ o }) => {
      if (o instanceof VariableToken) o = o.getVar().value;
      if (o instanceof NonNumericalToken) {
        if (Array.isArray(o.value) || typeof o.value === 'string') {
          return o.value.length;
        }
      }
      return NaN;
    }, 'return length of argument', false));
    env.define(new RunspaceBuiltinFunction(env, 'get', { list: 'list', i: 'real_int' }, ({ list, i }) => {
      if (list instanceof VariableToken) list = list.getVar().value;
      if (list instanceof NonNumericalToken && Array.isArray(list.value)) return list.value[i] ?? NaN;
      throw new Error(`Argument Error: argument is not a list`);
    }, 'get item at <i> in list <list>', false));
    env.define(new RunspaceBuiltinFunction(env, 'ln', { z: 'complex' }, ({ z }) => Complex.log(z), 'calculate the natural logarithm of x')); // natural logarithm
    env.define(new RunspaceBuiltinFunction(env, 'log', { a: 'complex', b: '?complex' }, ({ a, b }) => {
      return b === undefined ?
        Complex.div(Complex.log(a), Math.LN10) :// log base 10 of <a>
        Complex.div(Complex.log(b), Complex.log(a));// log base <a> of <b>
    }, 'return log base <a> of <b>. If b is not provided, return log base 10 of <a>'));
    env.define(new RunspaceBuiltinFunction(env, 'lcf', { a: 'real', b: 'real' }, ({ a, b }) => LCF(a, b), 'return the lowest common factor of a and b'));
    env.define(new RunspaceBuiltinFunction(env, 'random', { a: '?real', b: '?real' }, ({ a, b }) => {
      if (a !== undefined && b === undefined) return Math.random() * a; // random(max)
      if (a !== undefined && b !== undefined) return (Math.random() * (b - a)) + a; // random(min, max)
      return Math.random();
    }, 'return a pseudo-random decimal number. Range: 0 arguments: 0-1. 1 argument: 0-a. 2 arguments: a-b'));
    env.define(new RunspaceBuiltinFunction(env, 'nPr', { n: 'real', r: 'real' }, ({ n, r }) => {
      if (r > n) throw new Error(`Argument Error: invalid argument size relationship: n=${n} and r=${r}`);
      return factorial(n) / factorial(n - r);
    }, 'Return the probability of selecting an ordered set of <r> objects from a group of <n> number of objects'));
    env.define(new RunspaceBuiltinFunction(env, 'nCr', { n: 'real', r: 'real' }, ({ n, r }) => {
      if (r > n) throw new Error(`Argument Error: invalid argument size relationship: n=${n} and r=${r}`);
      return factorial(n) / (factorial(r) * factorial(n - r));
    }, 'Represents the selection of objects from a group of objects where order of objects does not matter'));
    env.define(new RunspaceBuiltinFunction(env, 'round', { x: 'complex', dp: '?real_int' }, ({ x, dp }) => {
      if (dp === undefined) return Complex.round(x);
      return Complex.roundDp(x, dp);
    }, 'round x to the nearest integer, or to <dp> decimal places')); // round
    env.define(new RunspaceBuiltinFunction(env, 'isreal', { z: 'complex' }, ({ z }) => +z.isReal(), 'return 0 or 1 depending on if z is real'));
    env.define(new RunspaceBuiltinFunction(env, 'Re', { z: 'complex' }, ({ z }) => z.a, 'return real component of z'));
    env.define(new RunspaceBuiltinFunction(env, 'Im', { z: 'complex' }, ({ z }) => z.b, 'return imaginary component of z'));
    env.define(new RunspaceBuiltinFunction(env, 'sin', { z: 'complex' }, ({ z }) => Complex.sin(z), 'return sine of z')); // sine
    env.define(new RunspaceBuiltinFunction(env, 'sinh', { z: 'complex' }, ({ z }) => Complex.sinh(z), 'return hyperbolic sine of z')); // hyperbolic sine
    env.define(new RunspaceBuiltinFunction(env, 'sqrt', { z: 'complex' }, ({ z }) => Complex.sqrt(z), 'return square root of z')); // cube root
    env.funcAlias('sqrt', '√');
    env.define(new RunspaceBuiltinFunction(env, 'summation', { start: 'any', limit: 'any', action: 'any', svar: '?any' }, ({ start, limit, action, svar }) => {
      let sumVar = 'x', sum = new Complex(0);
      start = start.eval('real_int');
      limit = limit.eval('real_int');
      if (svar !== undefined) {
        if (svar instanceof NonNumericalToken) {
          sumVar = svar.value;
          let extract = parseVariable(sumVar);
          if (sumVar !== extract) throw new Error(`Argument Error: Invalid variable provided '${sumVar}'`);
        } else throw new Error(`Argument Error: Invalid value for <svar>: ${svar}`);
      }
      if (action instanceof FunctionRefToken) { // Execute action as a function
        const fn = action.getFn();
        for (let i = start; i <= limit; i++) {
          try {
            sum.add(fn.eval([i]));
          } catch (e) {
            throw new Error(`${fn.defString()}:\n${e}`);
          }
        }
      } else if (action instanceof NumberToken || action instanceof VariableToken) { // Stored value
        sum = Complex.mult(action.eval(), Complex.sub(limit, start).add(1));
      } else if (action instanceof NonNumericalToken) { // Evaluate action as a TokenString
        let ts;
        try {
          ts = new TokenString(env, action.value);
        } catch (e) {
          throw new Error(`Summation action: ${action.value}:\n${e}`);
        }

        ts.env.pushScope();
        for (let i = start; i <= limit; i++) {
          try {
            ts.env.var(sumVar, i);
            sum.add(ts.eval().eval('complex'));
          } catch (e) {
            throw new Error(`${action.value} when ${sumVar} = ${i}:\n${e}`);
          }
        }
        ts.env.popScope();
      } else {
        throw new Error(`Argument Error: invalid summation action`);
      }
      return sum;
    }, 'Calculate a summation series between <start> and <limit>, executing <action> (may be constant, function or string). Use variable <svar> as counter.', false));
    env.funcAlias('summation', '∑');
    env.define(new RunspaceBuiltinFunction(env, 'tan', { z: 'complex' }, ({ z }) => Complex.tan(z), 'return tangent of z')); // tangent
    env.define(new RunspaceBuiltinFunction(env, 'tanh', { z: 'complex' }, ({ z }) => Complex.tanh(z), 'return hyperbolic tangent of z')); // hyperbolic tangent
    env.define(new RunspaceBuiltinFunction(env, 'W', { z: 'complex', k: '?real', tol: '?real' }, ({ z, k, tol }) => lambertw(z, k, tol), 'return approximation of the Lambert W function at <k> branch with <tol> tolerance'));
  }

  return env;
}

module.exports = { define };