const Complex = require("../maths/Complex");
const { RunspaceBuiltinFunction } = require("../runspace/Function");
const operators = require("../evaluation/operators");
const { parseVariable } = require("../evaluation/parse");
const { OperatorToken, VariableToken, NumberToken, FunctionRefToken, TokenString, StringToken, ArrayToken, primitiveToTypeToken } = require("../evaluation/tokens");
const { lambertw, isPrime, LCF, primeFactors, factorial, generatePrimes } = require("../maths/functions");
const { print } = require("../utils");
const { typeOf } = require("../evaluation/types");


/** Base definitions for an Environment */
function define(rs, defVariables = true, defFuncs = true) {
  /****************** CORE VARIABLES */
  rs.var('NaN', NaN, 'Value representing Not A Number', true);
  rs.var('inf', Infinity, 'Value representing Infinity', true);
  rs.var('true', true, '\'true\' is a boolean value that represents mathematical and logical truth', true);
  rs.var('false', false, '\'false\' is a boolean value that is used when the result of a logical statement is false', true);

  /****************** VARIABLES */
  if (defVariables) {
    rs.var('pi', Math.PI, 'pi is equal to the circumference of any circle divided by its diameter', true); // pi
    rs.var('π', rs.var('pi'));
    rs.var('e', Math.E, 'Euler\'s constant', true); // e
    rs.var('omega', 0.5671432904097838, 'Principle solution to xe^x = 1 (= W(1))', true); // W(1, 0)
    rs.var('Ω', rs.var('omega'));
    rs.var('phi', 1.618033988749895, 'Phi, the golden ratio, approx (1 + √5)/2', true); // phi, golden ratio
    rs.var('φ', rs.var('phi'));
    rs.var('tau', 2 * Math.PI, 'A constant representing the ratio between circumference and radius of a circle', true); // tau
    rs.var('τ', rs.var('tau'));
    rs.var(Complex.imagLetter, Complex.I(), '√(-1)', true);

    rs.var('ln2', Math.LN2, 'Natural logarithm of 2');
    rs.var('ln10', Math.LN10, 'Natural logarithm of 10');
    rs.var('log2e', Math.LOG2E, 'Base-2 logarithm of e');
    rs.var('log10e', Math.LOG10E, 'Base-10 logarithm of e');
    rs.var('sqrt1_2', Math.SQRT1_2, 'Square root of 0.5');
    rs.var('sqrt2', Math.SQRT2, 'Square root of 2');
  }

  /****************** CORE FUNCTIONS */

  rs.define(new RunspaceBuiltinFunction(rs, 'help', { item: '?any' }, ({ item }) => {
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
        let type = (fn instanceof RunspaceBuiltinFunction ? 'built-in' : 'user-defined') + (fn.constant ? '; constant' : '');
        help = `Type: function [${type}]\nDesc: ${fn.about()}\nSyntax: ${fn.defString()}`;
      }
    } else if (item instanceof VariableToken) {
      let v = rs.var(item);
      help = `Type: variable${v.constant ? ' (constant)' : ''} - ${v.value.type()}\nDesc: ${v.desc}\nValue: ${v.eval('string')}`;
    } else if (item instanceof NumberToken) {
      help = `Type: number\nValue: ${item.eval('complex')}`;
    } else if (item instanceof StringToken && operators[item.value] !== undefined) {
      const info = operators[item.value];
      return `Type: string (operator)\nDesc: ${info.desc}\nArgs: ${info.args}\nPrecedence: ${info.precedence}\nSyntax: ${info.syntax}`;
    } else {
      return `Type: ${item.type()}\nValue: ${item.eval("string")}`;
    }
    return help;
  }, 'Get general help or help on a provided argument', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'del', { item: 'any' }, ({ item }) => {
    if (item instanceof VariableToken) {
      let obj = item.getVar();
      if (obj.constant) {
        if (rs.strict) throw new Error(`Argument Error: cannot delete constant variable ${item}`);
        return 0;
      }
      return +rs.var(item.value, null);
    } else if (item instanceof FunctionRefToken) {
      let fn = item.getFn();
      if (fn instanceof RunspaceBuiltinFunction) {
        if (rs.strict) throw new Error(`Argument Error: cannot delete built-in ${item}`);
        return 0;
      }
      if (fn.constant) {
        if (rs.strict) throw new Error(`Argument Error: cannot delete constant function ${item}`);
        return 0;
      }
      return +rs.func(item.value, null);
    } else {
      if (rs.strict) throw new Error(`Argument Error: Cannot remove provided symbol`);
      return 0;
    }
  }, 'attempt to delete provided symbol, returning 0 or 1 upon success', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'exit', { c: '?real_int' }, ({ c }) => {
    if (c === undefined) c = 0;
    print(`Terminating with exit code ${c}`);
    process.exit(0);
  }, 'exit application with given code'));
  rs.define(new RunspaceBuiltinFunction(rs, 'clear', {}, () => +process.stdout.write('\033c'), 'clears the screen'));
  rs.define(new RunspaceBuiltinFunction(rs, 'print', { o: 'any', newline: '?bool' }, ({ o, newline }) => {
    if (newline instanceof VariableToken) newline = newline.getVar();
    newline = newline?.eval?.('bool') ?? true;
    process.stdout.write(o.eval('string') + (newline ? '\n' : ''));
    return o.eval('any');
  }, 'print item to screen', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'funcs', {}, () => {
    let output = '';
    for (let func in rs._funcs) {
      if (rs._funcs.hasOwnProperty(func)) {
        let fn = rs.func(func);
        output += `- [${fn instanceof RunspaceBuiltinFunction ? 'BUILT-IN' : 'USER-DEF'}] '${func}' \t ${fn.defString()}\n`;
      }
    }
    return output.substr(0, output.length - 1); // Remove final '\n'
  }, 'list all defined functions'));
  rs.define(new RunspaceBuiltinFunction(rs, 'vars', { s: '?real_int' }, ({ s }) => {
    let output = '';
    if (s === undefined) {
      rs._vars.forEach((scope, i) => {
        for (let v in scope) {
          if (scope.hasOwnProperty(v)) {
            output += `- [${i}]  '${v}' \t = \t ${rs._vars[i][v].eval('string')}\n`;
          }
        }
      });
    } else {
      if (rs._vars[s] === undefined) throw new Error(`Argument Error: scope ${s} does not exist`);
      for (let v in rs._vars[s]) {
        if (rs._vars[s].hasOwnProperty(v)) {
          output += `- '${v}' \t = \t ${rs._vars[s][v].eval('string')}\n`;
        }
      }
    }
    return output;
  }, 'list all defined variables in a given scope depth'));
  rs.define(new RunspaceBuiltinFunction(rs, 'operators', { h: '?real' }, ({ h }) => {
    let output = h === 0 ? '' : `Precedence | Operator | Syntax | Description\n`;
    for (let op in operators) {
      if (operators.hasOwnProperty(op)) {
        output += `- ${operators[op].precedence} \t '${op}' \t ${operators[op].syntax} \t ${operators[op].desc}\n`;
      }
    }
    return output.substr(0, output.length - 1); // Remove final '\n'
  }, 'list all available operators (<h>: show headers?)'));
  rs.define(new RunspaceBuiltinFunction(rs, 'cast', { o: 'any', type: 'string' }, ({ o, type }) => o.eval(type.eval("string")), 'attempt a direct cast from object <o> to type <type>', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'type', { o: 'any' }, ({ o }) => typeOf(o), 'attempt a direct cast from object <o> to type <type>', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'complex', { a: 'real', b: 'real' }, ({ a, b }) => new Complex(a, b), 'create a complex number'));
  rs.define(new RunspaceBuiltinFunction(rs, 'array', {}, () => ([]), 'create empty array'));
  rs.define(new RunspaceBuiltinFunction(rs, 'range', { a: 'real', b: '?real', c: '?real' }, ({ a, b, c }) => {
    let start, end, step;
    if (b === undefined) { start = 0; end = a; step = 1; }
    else if (c === undefined) { start = a; end = b; step = 1; }
    else { start = a; end = b; step = c; }
    if (isNaN(start) || isNaN(end) || isNaN(step) || !isFinite(start) || !isFinite(end) || !isFinite(step) || Math.sign(end - start) !== Math.sign(step)) throw new Error(`Argument Error: range is infinite given arguments`);
    const range = [];
    for (let n = start; n < end; n += step) range.push(n);
    return range;
  }, 'Return array populated with numbers between <a>-<b> step <c>. 1 arg=range(0,<a>,1); 2 args=range(<a>,<b>,1); 3 args=range(<a>,<b>,<c>)'));
  rs.define(new RunspaceBuiltinFunction(rs, 'len', { o: 'any' }, ({ o }) => {
    const length = o.len?.();
    if (rs.strict && length === undefined) throw new Error(`Strict Mode: argument has no len()`);
    return length === undefined ? NaN : length;
  }, 'return length of argument', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'get', { arg: 'any', i: 'real_int' }, ({ arg, i }) => {
    let value;
    if (arg instanceof VariableToken) arg = arg.getVar().value;
    if (arg instanceof ArrayToken) value = arg.value?.[i]?.eval("any");
    else if (arg instanceof StringToken) value = arg.value?.[i];
    if (value != undefined) return value;
    throw new Error(`Argument Error: unable to retrieve index ${i} of type ${arg.type()}`);
  }, 'get item at <i> in <arg>', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'set', { arr: 'array', i: 'real_int', item: 'any' }, ({ arr, i, item }) => {
    if (arr instanceof VariableToken) arr = arr.getVar().value;
    if (arr instanceof ArrayToken) {
      arr.value[i] = item;
      return arr.value.length;
    }
    throw new Error(`Argument Error: unable to set index ${i} of type ${arr.type()}`);
  }, 'set item at <i> in array <arr> to <item>', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'push', { arr: 'array', item: 'any' }, ({ arr, item }) => {
    if (arr instanceof VariableToken) arr = arr.getVar().value;
    if (arr instanceof ArrayToken) return arr.value.push(item);
    throw new Error(`Argument Error: expected array`);
  }, 'push item <item> to array <arr>', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'pop', { arr: 'array' }, ({ arr }) => {
    if (arr instanceof VariableToken) arr = arr.getVar().value;
    if (arr instanceof ArrayToken) return arr.value.pop();
    throw new Error(`Argument Error: expected array`);
  }, 'pop item from array <arr>', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'reverse', { arg: 'any' }, ({ arg }) => {
    if (arg instanceof VariableToken) arg = arg.getVar().value;
    if (arg instanceof ArrayToken) arg.value.reverse();
    else if (arg instanceof StringToken) arg.value = arg.value.split('').reverse().join('');
    else throw new Error(`Argument Error: unable to reverse object of type ${arg.type()}`);
    return arg.eval('any');
  }, 'reverse argument <arg>', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'apply', { arr: 'array', action: 'any' }, ({ arr, action }) => {
    if (arr instanceof VariableToken) arr = arr.getVar().value;
    if (!(arr instanceof ArrayToken)) throw new Error(`Argument Error: expected array`);

    if (action instanceof StringToken && operators[action.value] !== undefined) {
      const op = operators[action.value];
      if (op.args.length === 1) {
        for (let i = 0; i < arr.value.length; i++) arr.value[i] = primitiveToTypeToken(op.fn(arr.value[i].eval(op.args[0])));
        return arr.value;
      } else if (op.args.length === 2) {
        let acc = new Complex(0);
        for (let i = 0; i < arr.value.length; i++) acc = op.fn(primitiveToTypeToken(acc).eval(op.args[0]), arr.value[i].eval(op.args[1]));
        return acc;
      } else {
        throw new Error(`Argument Error: cannot apply operator '${action.value}' to array`);
      }
    } else if (action instanceof FunctionRefToken) {
      const fn = action.getFn(), args = Object.entries(fn.args);
      for (let i = 0, ans; i < arr.value.length; i++) {
        try {
          if (args.length === 1) ans = fn.eval([arr.value[i].eval(args[0][1])]);
          else if (args.length === 2) ans = fn.eval([arr.value[i].eval(args[0][1]), primitiveToTypeToken(i).eval(args[1][1])]);
          else if (args.length === 3) ans = fn.eval([arr.value[i].eval(args[0][1]), primitiveToTypeToken(i).eval(args[1][1]), arr.eval(args[2][1])]);
          else throw new Error(`Argument Error: cannot apply ${action} to array: unsupported argument count ${args.length}`);
          arr.value[i] = primitiveToTypeToken(ans);
        } catch (e) {
          throw new Error(`${fn.defString()}:\n${e}`);
        }
      }
      return arr.value;
    } else {
      for (let i = 0; i < arr.value.length; i++) {
        arr.value[i] = action;
      }
      return arr.value;
    }
  }, 'Apply <action> to an array: operator, function [f(<item>) or f(<item>,<index>) or f(<item>,<index>,<array>)]. Else, eveything in array is set to <action>', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'eval', { str: 'string' }, ({ str }) => rs.eval(str), 'evaluate an input'));

  /****************** MATHS FUNCTIONS */
  if (defFuncs) {
    rs.define(new RunspaceBuiltinFunction(rs, 'abs', { z: 'complex' }, ({ z }) => Complex.abs(z), 'calculate absolute value of z')); // abs
    rs.define(new RunspaceBuiltinFunction(rs, 'arccos', { z: 'complex' }, ({ z }) => Complex.arccos(z), 'return arccosine of z')); // arccosine
    rs.define(new RunspaceBuiltinFunction(rs, 'arccosh', { z: 'complex' }, ({ z }) => Complex.arccosh(z), 'return hyperbolic arccosine of z')); // hyperbolic arccosine
    rs.define(new RunspaceBuiltinFunction(rs, 'arcsin', { z: 'complex' }, ({ z }) => Complex.arcsin(z), 'return arcsine of z')); // arcsine
    rs.define(new RunspaceBuiltinFunction(rs, 'arcsinh', { z: 'complex' }, ({ z }) => Complex.arcsinh(z), 'return hyperbolic arcsine of z')); // hyperbolic arcsine
    rs.define(new RunspaceBuiltinFunction(rs, 'arctan', { z: 'complex' }, ({ z }) => Complex.arctan(z), 'return arctangent of z')); // arctangent
    rs.define(new RunspaceBuiltinFunction(rs, 'arctanh', { z: 'complex' }, ({ z }) => Complex.arctanh(z), 'return hyperbolic arctangent of z')); // hyperbolic arctangent
    rs.define(new RunspaceBuiltinFunction(rs, 'arg', { z: 'complex' }, ({ z }) => z.arg(), 'return the argument of z'));
    rs.define(new RunspaceBuiltinFunction(rs, 'cbrt', { z: 'complex' }, ({ z }) => Complex.cbrt(z), 'return cube root of x')); // cube root
    rs.funcAlias('cbrt', '∛');
    rs.define(new RunspaceBuiltinFunction(rs, 'ceil', { z: 'complex' }, ({ z }) => Complex.ceil(z), 'round x up to the nearest integer')); // ceiling (round up)
    rs.define(new RunspaceBuiltinFunction(rs, 'conj', { z: 'complex' }, ({ z }) => z.conjugate(), 'return z* (the configate) of z'));
    rs.define(new RunspaceBuiltinFunction(rs, 'cos', { z: 'complex' }, ({ z }) => Complex.cos(z), 'return cosine of x')); // cosine
    rs.define(new RunspaceBuiltinFunction(rs, 'cosh', { z: 'complex' }, ({ z }) => Complex.cosh(z), 'return hyperbolic cosine of x')); // hyperbolic cosine
    rs.define(new RunspaceBuiltinFunction(rs, 'time', {}, () => Date.now(), 'returns the number of milliseconds elapsed since January 1, 1970 00:00:00 UTC'));
    rs.define(new RunspaceBuiltinFunction(rs, 'exp', { z: 'complex' }, ({ z }) => Complex.exp(z), 'return e^x')); // raise e to the x
    rs.define(new RunspaceBuiltinFunction(rs, 'floor', { z: 'complex' }, ({ z }) => Complex.floor(z), 'round x down to the nearest integer')); // floor (round down)
    rs.define(new RunspaceBuiltinFunction(rs, 'isnan', { z: 'complex' }, ({ z }) => +Complex.isNaN(z), 'return 0 or 1 depending on is x is NaN'));
    rs.define(new RunspaceBuiltinFunction(rs, 'isinf', { z: 'complex' }, ({ z }) => Complex.isFinite(z) ? 0 : 1, 'return 0 or 1 depending on is x is infinite'));
    rs.define(new RunspaceBuiltinFunction(rs, 'isprime', { x: 'real' }, ({ x }) => +isPrime(x), 'return 0 or 1 depending on if x is prime'));
    rs.define(new RunspaceBuiltinFunction(rs, 'primes', { limit: 'real' }, ({ limit }) => generatePrimes(limit), 'generate list of primes 0..limit'));

    rs.define(new RunspaceBuiltinFunction(rs, 'factors', { x: 'real' }, ({ x }) => primeFactors(x), 'return prime factors of x'));
    rs.define(new RunspaceBuiltinFunction(rs, 'factorial', { x: 'real' }, ({ x }) => factorial(x), 'calculate the factorial of x'));
    rs.define(new RunspaceBuiltinFunction(rs, 'ln', { z: 'complex' }, ({ z }) => Complex.log(z), 'calculate the natural logarithm of x')); // natural logarithm
    rs.define(new RunspaceBuiltinFunction(rs, 'log', { a: 'complex', b: '?complex' }, ({ a, b }) => {
      return b === undefined ?
        Complex.div(Complex.log(a), Math.LN10) :// log base 10 of <a>
        Complex.div(Complex.log(b), Complex.log(a));// log base <a> of <b>
    }, 'return log base <a> of <b>. If b is not provided, return log base 10 of <a>'));
    rs.define(new RunspaceBuiltinFunction(rs, 'lcf', { a: 'real', b: 'real' }, ({ a, b }) => LCF(a, b), 'return the lowest common factor of a and b'));
    rs.define(new RunspaceBuiltinFunction(rs, 'mean', { arr: 'array' }, ({ arr }) => {
      if (!Array.isArray(arr)) throw new Error(`Argument Error: expected array`);
      const m = new Complex(0);
      arr.forEach(x => m.add(x.eval('complex')));
      m.div(arr.length);
      return m;
    }, 'calculate mean value in an array'));
    rs.define(new RunspaceBuiltinFunction(rs, 'random', { a: '?real', b: '?real' }, ({ a, b }) => {
      if (a !== undefined && b === undefined) return Math.random() * a; // random(max)
      if (a !== undefined && b !== undefined) return (Math.random() * (b - a)) + a; // random(min, max)
      return Math.random();
    }, 'return a pseudo-random decimal number. Range: 0 arguments: 0-1. 1 argument: 0-a. 2 arguments: a-b'));
    rs.define(new RunspaceBuiltinFunction(rs, 'nPr', { n: 'real', r: 'real' }, ({ n, r }) => {
      if (r > n) throw new Error(`Argument Error: invalid argument size relationship: n=${n} and r=${r}`);
      return factorial(n) / factorial(n - r);
    }, 'Return the probability of selecting an ordered set of <r> objects from a group of <n> number of objects'));
    rs.define(new RunspaceBuiltinFunction(rs, 'nCr', { n: 'real', r: 'real' }, ({ n, r }) => {
      if (r > n) throw new Error(`Argument Error: invalid argument size relationship: n=${n} and r=${r}`);
      return factorial(n) / (factorial(r) * factorial(n - r));
    }, 'Represents the selection of objects from a group of objects where order of objects does not matter'));
    rs.define(new RunspaceBuiltinFunction(rs, 'round', { x: 'complex', dp: '?real_int' }, ({ x, dp }) => {
      if (dp === undefined) return Complex.round(x);
      return Complex.roundDp(x, dp);
    }, 'round x to the nearest integer, or to <dp> decimal places')); // round
    rs.define(new RunspaceBuiltinFunction(rs, 'isreal', { z: 'complex' }, ({ z }) => +z.isReal(), 'return 0 or 1 depending on if z is real'));
    rs.define(new RunspaceBuiltinFunction(rs, 'Re', { z: 'complex' }, ({ z }) => z.a, 'return real component of z'));
    rs.define(new RunspaceBuiltinFunction(rs, 'Im', { z: 'complex' }, ({ z }) => z.b, 'return imaginary component of z'));
    rs.define(new RunspaceBuiltinFunction(rs, 'sin', { z: 'complex' }, ({ z }) => Complex.sin(z), 'return sine of z')); // sine
    rs.define(new RunspaceBuiltinFunction(rs, 'sinh', { z: 'complex' }, ({ z }) => Complex.sinh(z), 'return hyperbolic sine of z')); // hyperbolic sine
    rs.define(new RunspaceBuiltinFunction(rs, 'sqrt', { z: 'complex' }, ({ z }) => Complex.sqrt(z), 'return square root of z')); // cube root
    rs.funcAlias('sqrt', '√');
    rs.define(new RunspaceBuiltinFunction(rs, 'summation', { start: 'any', limit: 'any', action: 'any', svar: '?any' }, ({ start, limit, action, svar }) => {
      let sumVar = 'x', sum = new Complex(0);
      start = start.eval('real_int');
      limit = limit.eval('real_int');
      if (svar !== undefined) {
        if (svar instanceof StringToken) {
          sumVar = svar.eval("string");
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
      } else if (action instanceof StringToken) { // Evaluate action as a TokenString
        let ts;
        try {
          ts = new TokenString(rs, action.value);
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
    rs.funcAlias('summation', '∑');
    rs.define(new RunspaceBuiltinFunction(rs, 'tan', { z: 'complex' }, ({ z }) => Complex.tan(z), 'return tangent of z')); // tangent
    rs.define(new RunspaceBuiltinFunction(rs, 'tanh', { z: 'complex' }, ({ z }) => Complex.tanh(z), 'return hyperbolic tangent of z')); // hyperbolic tangent
    rs.define(new RunspaceBuiltinFunction(rs, 'W', { z: 'complex', k: '?real', tol: '?real' }, ({ z, k, tol }) => lambertw(z, k, tol), 'return approximation of the Lambert W function at <k> branch with <tol> tolerance'));
  }

  return rs;
}

module.exports = { define };