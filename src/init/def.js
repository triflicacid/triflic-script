const Complex = require("../maths/Complex");
const { RunspaceBuiltinFunction } = require("../runspace/Function");
const { parseVariable } = require("../evaluation/parse");
const { OperatorToken, VariableToken, TokenString } = require("../evaluation/tokens");
const { lambertw, isPrime, LCF, primeFactors, factorial, generatePrimes } = require("../maths/functions");
const { print, bool, PMCC, mean, sort, variance } = require("../utils");
const { typeOf } = require("../evaluation/types");
const { FunctionRefValue, StringValue, Value, ArrayValue, NumberValue, SetValue, primitiveToValueClass, BoolValue } = require("../evaluation/values");


/** Core definitions !REQUIRED! */
function define(rs) {
  /****************** CORE VARIABLES */
  rs.var('NaN', NaN, 'Value representing Not A Number', true);
  rs.var('inf', Infinity, 'Value representing Infinity', true);
  rs.var('true', true, '\'true\' is a boolean value that represents mathematical and logical truth', true);
  rs.var('false', false, '\'false\' is a boolean value that is used when the result of a logical statement is false', true);
  rs.var('∅', new SetValue(rs, []), 'Empty set', true);
  rs.var('ε', new SetValue(rs, []), 'Universal set', false);

  /****************** CORE FUNCTIONS */

  rs.define(new RunspaceBuiltinFunction(rs, 'help', { item: '?any' }, ({ item }) => {
    let help = '';
    if (item === undefined) {
      help = `help(?s) \t Get help on a specific symbol\nvars() \t List all variables\nfuncs() \t List all functions\noperators() \t List all operators\nexit() \t Terminate the program`;
    } else if (item instanceof OperatorToken) {
      let info = rs.operators[item];
      help = `Type: operator\nDesc: ${info.desc}\nPrecedence: ${info.precedence}\nSyntax: ${info.syntax}`;
    } else if (item instanceof FunctionRefValue) {
      let fn = item.getFn();
      if (fn === undefined) {
        throw new Error(`Reference Error: null reference ${item} - unable to retrieve help`);
      } else {
        let type = (fn instanceof RunspaceBuiltinFunction ? 'built-in' : 'user-defined') + (fn.constant ? '; constant' : '');
        help = `Type: function [${type}]\nDesc: ${fn.about()}\nSyntax: ${fn.defString()}`;
      }
    } else if (item instanceof VariableToken) {
      let v = item.getVar();
      help = `Type: variable${v.constant ? ' (constant)' : ''} - ${v.value.type()}\nDesc: ${v.desc}\nValue: ${v.toString()}`;
    } else if (item instanceof StringValue && rs.operators[item.value] !== undefined) {
      const info = rs.operators[item.value];
      const argStr = Array.isArray(info.args) ? `${info.args.join(' or ')} (${info.args.length} overloads)` : info.args;
      help = `Type: string (operator)\nDesc: ${info.desc}\nArgs: ${argStr}\nPrecedence: ${info.precedence}\nSyntax: ${info.syntax}`;
    } else if (item instanceof Value) {
      help = `Type: ${item.type()}\nNumeric: ${item.toPrimitive('complex')}\nValue: ${item.toString()}`;
    } else {
      if (rs.strict) throw new Error(`Cannot get help on given argument`);
    }
    return new StringValue(rs, help);
  }, 'Get general help or help on a provided argument', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'del', { item: 'any' }, ({ item }) => {
    const zero = new NumberValue(rs, 0);
    if (item instanceof VariableToken) {
      let obj = item.getVar();
      if (obj.constant) {
        if (rs.strict) throw new Error(`Argument Error: cannot delete constant variable ${item}`);
        return zero;
      }
      return new NumberValue(rs, +rs.var(item.value, null));
    } else if (item instanceof FunctionRefValue) {
      let fn = item.getFn();
      if (fn.constant) {
        if (rs.strict) throw new Error(`Argument Error: cannot delete constant function ${item}`);
        return zero;
      }
      return new NumberValue(rs, +rs.func(item.value, null));
    } else {
      if (rs.strict) throw new Error(`Argument Error: Cannot remove provided symbol`);
      return zero;
    }
  }, 'attempt to delete provided symbol, returning 0 or 1 upon success', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'exit', { c: '?real_int' }, ({ c }) => {
    print(`Terminating with exit code ${c === undefined ? 0 : c.toString()}`);
    process.exit(0);
  }, 'exit application with given code'));
  rs.define(new RunspaceBuiltinFunction(rs, 'clear', {}, () => {
    process.stdout.write('\033c');
    return new StringValue(0, "");
  }, 'clears the screen'));
  rs.define(new RunspaceBuiltinFunction(rs, 'print', { o: 'any', newline: '?bool' }, ({ o, newline }) => {
    newline = newline === undefined ? true : newline.toPrimitive('bool');
    process.stdout.write(o.toString() + (newline ? '\n' : ''));
    return o;
  }, 'print item to screen'));
  rs.define(new RunspaceBuiltinFunction(rs, 'funcs', {}, () => {
    let output = '';
    for (let func in rs._funcs) {
      if (rs._funcs.hasOwnProperty(func)) {
        let fn = rs.func(func);
        output += `- [${fn instanceof RunspaceBuiltinFunction ? 'BUILT-IN' : 'USER-DEF'}] '${func}' \t ${fn.defString()}\n`;
      }
    }
    return new StringValue(rs, output.substr(0, output.length - 1)); // Remove final '\n'
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
    return new StringValue(rs, output);
  }, 'list all defined variables in a given scope depth'));
  rs.define(new RunspaceBuiltinFunction(rs, 'operators', { h: '?real' }, ({ h }) => {
    let output = h === 0 ? '' : `Precedence | Operator | Syntax | Description\n`;
    for (let op in rs.operators) {
      if (rs.operators.hasOwnProperty(op)) {
        output += `- ${rs.operators[op].precedence} \t '${op}' \t ${rs.operators[op].syntax} \t ${rs.operators[op].desc}\n`;
      }
    }
    return new StringValue(rs, output.substr(0, output.length - 1)); // Remove final '\n'
  }, 'list all available operators (<h>: show headers?)'));
  rs.define(new RunspaceBuiltinFunction(rs, 'cast', { o: 'any', type: 'string' }, ({ o, type }) => o.eval(type.toString()), 'attempt a direct cast from object <o> to type <type>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'type', { o: 'any' }, ({ o }) => new StringValue(rs, typeOf(o)), 'attempt a direct cast from object <o> to type <type>', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'complex', { a: 'real', b: 'real' }, ({ a, b }) => new NumberValue(rs, new Complex(a, b)), 'create a complex number'));
  rs.define(new RunspaceBuiltinFunction(rs, 'chr', { n: 'real_int' }, ({ n }) => new StringValue(rs, String.fromCharCode(n.toPrimitive("real"))), 'return character with ASCII code <n>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'ord', { chr: 'string' }, ({ chr }) => new NumberValue(rs, chr.toString().charCodeAt(0)), 'return character code of <chr>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'range', { a: 'real', b: '?real', c: '?real' }, ({ a, b, c }) => {
    let start, end, step;
    if (b === undefined) { start = 0; end = a; step = 1; }
    else if (c === undefined) { start = a; end = b; step = 1; }
    else { start = a; end = b; step = c; }
    if (isNaN(start) || isNaN(end) || isNaN(step) || !isFinite(start) || !isFinite(end) || !isFinite(step) || Math.sign(end - start) !== Math.sign(step)) throw new Error(`Argument Error: range is infinite given arguments`);
    const range = [];
    for (let n = start; n < end; n += step) range.push(new NumberValue(rs, n));
    return new ArrayValue(rs, range);
  }, 'Return array populated with numbers between <a>-<b> step <c>. 1 arg=range(0,<a>,1); 2 args=range(<a>,<b>,1); 3 args=range(<a>,<b>,<c>)'));
  rs.define(new RunspaceBuiltinFunction(rs, 'len', { o: 'any' }, ({ o }) => {
    const length = o.len?.();
    if (rs.strict && length === undefined) throw new Error(`Strict Mode: argument has no len()`);
    return new NumberValue(rs, length === undefined ? NaN : length);
  }, 'return length of argument'));
  rs.define(new RunspaceBuiltinFunction(rs, 'get', { arg: 'any', i: 'real_int' }, ({ arg, i }) => {
    let value;
    if (arg instanceof ArrayValue) value = arg.toPrimitive('array')[i];
    else if (arg instanceof StringValue) value = new StringValue(rs, arg.toString()[i]);
    if (value != undefined) return value;
    throw new Error(`Argument Error: unable to retrieve index ${i} of type ${arg.type()}`);
  }, 'get item at <i> in <arg>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'set', { arr: 'array', i: 'real_int', item: 'any' }, ({ arr, i, item }) => {
    if (arr instanceof ArrayValue) {
      arr.value[i] = item;
      return item;
    }
    throw new Error(`Argument Error: unable to set index ${i} of type ${arr.type()}`);
  }, 'set item at <i> in array <arr> to <item>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'push', { arr: 'array', item: 'any' }, ({ arr, item }) => {
    if (arr instanceof ArrayValue) return new NumberValue(rs, arr.value.push(item));
    if (arr instanceof SetValue) { arr.run(() => arr.value.push(item)); return new NumberValue(rs, arr.value.length); }
    throw new Error(`Argument Error: expected array`);
  }, 'push item <item> to array <arr>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'pop', { arr: 'array' }, ({ arr }) => {
    if (arr instanceof ArrayValue || arr instanceof SetValue) return arr.value.pop();
    throw new Error(`Argument Error: expected array`);
  }, 'pop item from array <arr>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'reverse', { arg: 'any' }, ({ arg }) => {
    if (arg instanceof ArrayValue || arg instanceof SetValue) arg.value.reverse();
    else if (arg instanceof StringValue) arg.value = arg.value.split('').reverse().join('');
    else throw new Error(`Argument Error: unable to reverse object of type ${arg.type()}`);
    return arg;
  }, 'reverse argument <arg>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'sort', { arr: 'array' }, ({ arr }) => {
    return new ArrayValue(rs, sort(arr.toPrimitive('array').map((v, i) => {
      if (v.type() !== 'real') throw new Error(`Type Error: expected array of real numbers, got ${v.type()} at index ${i}`);
      return v.toPrimitive('real');
    })).map(n => new NumberValue(rs, n)));
  }, 'sort array numerically'));
  rs.define(new RunspaceBuiltinFunction(rs, 'apply', { arr: 'array', action: 'any' }, ({ arr, action }) => {
    if (!(arr instanceof ArrayValue)) throw new Error(`Argument Error: expected array`);

    if (action instanceof StringValue) {
      const op = rs.operators[action.value];
      if (op) {
        if (op.args === 2 || (Array.isArray(op.args) && op.args.includes(2))) {
          let acc = new NumberValue(rs, 0);
          const func = op[Array.isArray(op.args) ? 'fn2' : 'fn'];
          for (let i = 0; i < arr.value.length; i++) acc = func(acc, arr.value[i]);
          return acc;
        } else if (op.args === 1 || (Array.isArray(op.args) && op.args.includes(1))) {
          for (let i = 0; i < arr.value.length; i++) {
            let tmp = op[Array.isArray(op.args) ? 'fn1' : 'fn'](arr.value[i]);
            if (tmp === undefined) throw new Error(`Syntax Error: no operator overload for '${action.value}' for { <${arr.value[i].type()}> ${arr.value[i].eval('string')} }`);
            arr.value[i] = tmp;
          }
          return arr;
        } else {
          throw new Error(`Argument Error: cannot apply operator '${action.value}' to array`);
        }
      } else {
        let ts;
        try {
          ts = new TokenString(rs, action.value);
        } catch (e) {
          throw new Error(`Apply action: ${action.value}:\n${e}`);
        }

        ts.rs.pushScope();
        for (let i = 0; i < arr.value.length; i++) {
          try {
            ts.rs.var('x', arr.value[i]);
            arr.value[i] = ts.eval();
          } catch (e) {
            throw new Error(`${action.value} when x = ${arr.value[i].eval('string')}:\n${e}`);
          }
        }
        ts.rs.popScope();
        return arr;
      }
    } else if (action instanceof FunctionRefValue) {
      const fn = action.getFn(), args = Object.entries(fn.args);
      for (let i = 0, ans; i < arr.value.length; i++) {
        try {
          if (args.length === 1) ans = fn.eval([arr.value[i].eval(args[0][1])]);
          else if (args.length === 2) ans = fn.eval([arr.value[i].eval(args[0][1]), new NumberValue(rs, i).eval(args[1][1])]);
          else if (args.length === 3) ans = fn.eval([arr.value[i].eval(args[0][1]), new NumberValue(rs, i).eval(args[1][1]), arr.eval(args[2][1])]);
          else throw new Error(`Argument Error: cannot apply ${action} to array: unsupported argument count ${args.length}`);
          arr.value[i] = ans;
        } catch (e) {
          throw new Error(`${fn.defString()}:\n${e}`);
        }
      }
      return arr;
    } else {
      for (let i = 0; i < arr.value.length; i++) {
        arr.value[i] = action;
      }
      return arr;
    }
  }, 'Apply <action> to an array: operator, function [f(<item>) or f(<item>,<index>) or f(<item>,<index>,<array>)]. Else, eveything in array is set to <action>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'filter', { arr: 'array', fn: 'func' }, ({ arr, fn }) => {
    const array = [];
    fn = fn.getFn();
    arr = arr.toPrimitive('array');
    for (let i = 0; i < arr.length; i++) {
      let b = fn.argCount === 1 ? fn.eval([arr[i]]) : fn.eval([arr[i], new NumberValue(rs, i)]);
      if (b.toPrimitive('bool')) array.push(arr[i]);
    }
    return new ArrayValue(rs, array);
  }, 'Remove all values from arr for which fn(value, ?index) is false'));
  rs.define(new RunspaceBuiltinFunction(rs, 'base', { arg: 'string', from: 'real_int', to: 'real_int'}, ({ arg, from, to }) => {
    from = from.toPrimitive('real_int');
    to = to.toPrimitive('real_int');
    if (from < 2 || from > 36) throw new Error(`Argument Error: invalid base: <from> = ${from}`);
    if (to < 2 || to > 36) throw new Error(`Argument Error: invalid base: <to> = ${to}`);
    return StringValue(rs, parseInt(arg.toString(), from).toString(to));
  }, 'Convert <arg> from base <from> to base <to>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'eval', { str: 'string' }, ({ str }) => rs.parseString(str.toString()).eval(), 'evaluate an input'));
    
  return rs;
}

/** Built-in Variables */
function defineVars(rs) {
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

/** Built-in functions */
function defineFuncs(rs) {
  rs.define(new RunspaceBuiltinFunction(rs, 'abs', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.abs(z.toPrimitive('complex'))), 'calculate absolute value of z')); // abs
  rs.define(new RunspaceBuiltinFunction(rs, 'arccos', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.arccos(z.toPrimitive('complex'))), 'return arccosine of z')); // arccosine
  rs.define(new RunspaceBuiltinFunction(rs, 'arccosh', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.arccosh(z.toPrimitive('complex'))), 'return hyperbolic arccosine of z')); // hyperbolic arccosine
  rs.define(new RunspaceBuiltinFunction(rs, 'arcsin', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.arcsin(z.toPrimitive('complex'))), 'return arcsine of z')); // arcsine
  rs.define(new RunspaceBuiltinFunction(rs, 'arcsinh', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.arcsinh(z.toPrimitive('complex'))), 'return hyperbolic arcsine of z')); // hyperbolic arcsine
  rs.define(new RunspaceBuiltinFunction(rs, 'arctan', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.arctan(z.toPrimitive('complex'))), 'return arctangent of z')); // arctangent
  rs.define(new RunspaceBuiltinFunction(rs, 'arctanh', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.arctanh(z.toPrimitive('complex'))), 'return hyperbolic arctangent of z')); // hyperbolic arctangent
  rs.define(new RunspaceBuiltinFunction(rs, 'arg', { z: 'complex' }, ({ z }) => new NumberValue(rs, z.toPrimitive('complex').arg()), 'return the argument of z'));
  rs.define(new RunspaceBuiltinFunction(rs, 'cbrt', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.cbrt(z.toPrimitive('complex'))), 'return cube root of x')); // cube root
  rs.define(new RunspaceBuiltinFunction(rs, 'ceil', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.ceil(z.toPrimitive('complex'))), 'round x up to the nearest integer')); // ceiling (round up)
  rs.define(new RunspaceBuiltinFunction(rs, 'conj', { z: 'complex' }, ({ z }) => new NumberValue(rs, z.toPrimitive('complex').conjugate()), 'return z* (the configate) of z'));
  rs.define(new RunspaceBuiltinFunction(rs, 'cos', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.cos(z.toPrimitive('complex'))), 'return cosine of x')); // cosine
  rs.define(new RunspaceBuiltinFunction(rs, 'cosh', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.cosh(z.toPrimitive('complex'))), 'return hyperbolic cosine of x')); // hyperbolic cosine
  rs.define(new RunspaceBuiltinFunction(rs, 'time', {}, () => new NumberValue(rs, Date.now()), 'returns the number of milliseconds elapsed since January 1, 1970 00:00:00 UTC'));
  rs.define(new RunspaceBuiltinFunction(rs, 'exp', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.exp(z.toPrimitive('complex'))), 'return e^x')); // raise e to the x
  rs.define(new RunspaceBuiltinFunction(rs, 'floor', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.floor(z.toPrimitive('complex'))), 'round x down to the nearest integer')); // floor (round down)
  rs.define(new RunspaceBuiltinFunction(rs, 'isNaN', { z: 'complex' }, ({ z }) => new BoolValue(rs, Complex.isNaN(z.toPrimitive('complex'))), 'return 0 or 1 depending on is x is NaN'));
  rs.define(new RunspaceBuiltinFunction(rs, 'isinf', { z: 'complex' }, ({ z }) => new BoolValue(rs, !Complex.isFinite(z.toPrimitive('complex'))), 'return 0 or 1 depending on is x is infinite'));
  rs.define(new RunspaceBuiltinFunction(rs, 'isprime', { x: 'real' }, ({ x }) => new BoolValue(rs, isPrime(x.toPrimitive('real'))), 'return 0 or 1 depending on if x is prime'));
  rs.define(new RunspaceBuiltinFunction(rs, 'primes', { limit: 'real_int' }, ({ limit }) => new ArrayValue(rs, generatePrimes(limit.toPrimitive('real'))), 'generate list of primes 0..limit'));

  rs.define(new RunspaceBuiltinFunction(rs, 'factors', { x: 'real' }, ({ x }) => new ArrayValue(rs, primeFactors(x.toPrimitive('real'))), 'return prime factors of x'));
  rs.define(new RunspaceBuiltinFunction(rs, 'factorial', { x: 'real_int' }, ({ x }) => new NumberValue(rs, factorial(x.toPrimitive('real'))), 'calculate the factorial of x'));
  rs.define(new RunspaceBuiltinFunction(rs, 'ln', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.log(z.toPrimitive('complex'))), 'calculate the natural logarithm of x')); // natural logarithm
  rs.define(new RunspaceBuiltinFunction(rs, 'log', { a: 'complex', b: '?complex' }, ({ a, b }) => {
    return b === undefined ?
      Complex.div(Complex.log(a), Math.LN10) :// log base 10 of <a>
      Complex.div(Complex.log(b), Complex.log(a));// log base <a> of <b>
  }, 'return log base <a> of <b>. If b is not provided, return log base 10 of <a>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'lcf', { a: 'real', b: 'real' }, ({ a, b }) => new NumberValue(rs, LCF(a.toPrimitive('real'), b.toPrimitive('real'))), 'return the lowest common factor of a and b'));
  rs.define(new RunspaceBuiltinFunction(rs, 'mean', { arr: 'array' }, ({ arr }) => new NumberValue(rs, mean(arr.toPrimitive('array').map(v => v.toPrimitive('real')))), 'calculate mean value in an array'));
  rs.define(new RunspaceBuiltinFunction(rs, 'PMCC', { x: 'array', y: 'array' }, ({ x, y }) => new NumberValue(rs, PMCC(x.toPrimitive('array').map(v => v.toPrimitive('real')), y.toPrimitive('array').map(v => v.toPrimitive('real')))), 'Calculate the Product Moment Correlation Coefficient between two data sets'));
  rs.define(new RunspaceBuiltinFunction(rs, 'variance', { arr: 'array' }, ({ arr }) => new NumberValue(rs, variance(arr.toPrimitive('array').map(v => v.toPrimitive('real')))), 'calculate variance in a dataset'));
  rs.define(new RunspaceBuiltinFunction(rs, 'random', { a: '?real', b: '?real' }, ({ a, b }) => {
    if (a !== undefined) a = a.toPrimitive('real');
    if (b !== undefined) b = b.toPrimitive('real');
    let n;
    if (a !== undefined && b === undefined) n = Math.random() * a; // random(max)
    else if (a !== undefined && b !== undefined) n = (Math.random() * (b - a)) + a; // random(min, max)
    else n = Math.random();
    return new NumberValue(rs, n);
  }, 'return a pseudo-random decimal number. Range: 0 arguments: 0-1. 1 argument: 0-a. 2 arguments: a-b'));
  rs.define(new RunspaceBuiltinFunction(rs, 'nPr', { n: 'real_int', r: 'real_int' }, ({ n, r }) => {
    n = n.toPrimitive('real');
    r = r.toPrimitive('real');
    if (r > n) throw new Error(`Argument Error: invalid argument size relationship: n=${n} and r=${r}`);
    return new NumberValue(rs, factorial(n) / factorial(n - r));
  }, 'Return the probability of selecting an ordered set of <r> objects from a group of <n> number of objects'));
  rs.define(new RunspaceBuiltinFunction(rs, 'nCr', { n: 'real_int', r: 'real_int' }, ({ n, r }) => {
    n = n.toPrimitive('real');
    r = r.toPrimitive('real');
    if (r > n) throw new Error(`Argument Error: invalid argument size relationship: n=${n} and r=${r}`);
    return new NumberValue(rs, factorial(n) / (factorial(r) * factorial(n - r)));
  }, 'Represents the selection of objects from a group of objects where order of objects does not matter'));
  rs.define(new RunspaceBuiltinFunction(rs, 'round', { x: 'complex', dp: '?real_int' }, ({ x, dp }) => {
    x = x.toPrimitive('complex');
    if (dp === undefined) return new NumberValue(rs, Complex.round(x));
    return new NumberValue(rs, Complex.roundDp(x, dp.toPrimitive('real')));
  }, 'round x to the nearest integer, or to <dp> decimal places')); // round
  rs.define(new RunspaceBuiltinFunction(rs, 'Re', { z: 'complex' }, ({ z }) => new NumberValue(rs, z.toPrimitive('complex').a), 'return real component of z'));
  rs.define(new RunspaceBuiltinFunction(rs, 'Im', { z: 'complex' }, ({ z }) => new NumberValue(rs, z.toPrimitive('complex').b), 'return imaginary component of z'));
  rs.define(new RunspaceBuiltinFunction(rs, 'sin', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.sin(z.toPrimitive('complex'))), 'return sine of z')); // sine
  rs.define(new RunspaceBuiltinFunction(rs, 'sinh', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.sinh(z.toPrimitive('complex'))), 'return hyperbolic sine of z')); // hyperbolic sine
  rs.define(new RunspaceBuiltinFunction(rs, 'sqrt', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.sqrt(z.toPrimitive('complex'))), 'return square root of z')); // cube root
  rs.funcAlias('sqrt', '√');
  rs.define(new RunspaceBuiltinFunction(rs, 'summation', { start: 'any', limit: 'any', action: 'any', svar: '?any' }, ({ start, limit, action, svar }) => {
    let sumVar = 'x', sum = new Complex(0);
    start = start.toPrimitive('real_int');
    limit = limit.toPrimitive('real_int');
    if (svar !== undefined) {
      if (svar instanceof StringValue) {
        sumVar = svar.toString();
        let extract = parseVariable(sumVar);
        if (sumVar !== extract) throw new Error(`Argument Error: Invalid variable provided '${sumVar}'`);
      } else throw new Error(`Argument Error: Invalid value for <svar>`);
    }
    if (action instanceof FunctionRefValue) { // Execute action as a function
      const fn = action.getFn();
      for (let i = start; i <= limit; i++) {
        try {
          sum.add(fn.eval([new NumberValue(rs, i)]).toPrimitive('complex'));
        } catch (e) {
          throw new Error(`${fn.defString()}:\n${e}`);
        }
      }
    } else if (action instanceof NumberValue) { // Stored value
      sum = Complex.mult(action.toPrimitive('complex'), Complex.sub(limit, start).add(1));
    } else if (action instanceof StringValue) { // Evaluate action as a TokenString
      let ts;
      try {
        ts = new TokenString(rs, action.value);
      } catch (e) {
        throw new Error(`Summation action: ${action.value}:\n${e}`);
      }

      ts.rs.pushScope();
      for (let i = start; i <= limit; i++) {
        try {
          ts.rs.var(sumVar, i);
          sum.add(ts.eval().toPrimitive('complex'));
        } catch (e) {
          throw new Error(`${action.value} when ${sumVar} = ${i}:\n${e}`);
        }
      }
      ts.rs.popScope();
    } else {
      throw new Error(`Argument Error: invalid summation action`);
    }
    return new NumberValue(rs, sum);
  }, 'Calculate a summation series between <start> and <limit>, executing <action> (may be constant, function or string). Use variable <svar> as counter.'));
  rs.funcAlias('summation', '∑');
  rs.define(new RunspaceBuiltinFunction(rs, 'tan', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.tan(z.toPrimitive('complex'))), 'return tangent of z')); // tangent
  rs.define(new RunspaceBuiltinFunction(rs, 'tanh', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.tanh(z.toPrimitive('complex'))), 'return hyperbolic tangent of z')); // hyperbolic tangent
  rs.define(new RunspaceBuiltinFunction(rs, 'W', { z: 'complex', k: '?real', tol: '?real' }, ({ z, k, tol }) => new NumberValue(rs, lambertw(z.toPrimitive('complex'), k?.toPrimitive('real'), tol?.toPrimitive('real'))), 'return approximation of the Lambert W function at <k> branch with <tol> tolerance'));
}

module.exports = { define, defineVars, defineFuncs };