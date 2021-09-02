const Complex = require("../maths/Complex");
const { RunspaceBuiltinFunction } = require("../runspace/Function");
const { parseVariable } = require("../evaluation/parse");
const { VariableToken, KeywordToken } = require("../evaluation/tokens");
const { lambertw, isPrime, LCF, primeFactors, factorialReal, factorial, generatePrimes, mean, variance, PMCC, gamma, wrightomega, nextNearest } = require("../maths/functions");
const { print, sort, findIndex } = require("../utils");
const { typeOf, types } = require("../evaluation/types");
const { FunctionRefValue, StringValue, Value, ArrayValue, NumberValue, SetValue, BoolValue, UndefinedValue } = require("../evaluation/values");
const { PI, E, OMEGA, PHI, TWO_PI, DBL_EPSILON } = require("../maths/constants");
const operators = require("../evaluation/operators");
const { errors, errorDesc } = require("../errors");

/** Core definitions !REQUIRED! */
function define(rs) {
  /****************** CORE VARIABLES */
  rs.var('NaN', NaN, 'Value representing Not A Number', true);
  rs.var('inf', Infinity, 'Value representing Infinity', true);
  rs.var('true', true, '\'true\' is a boolean value that represents mathematical and logical truth', true);
  rs.var('false', false, '\'false\' is a boolean value that is used when the result of a logical statement is false', true);
  rs.var('undefined', new UndefinedValue(rs), 'A variable that has not been assigned a value is of type undefined', true);
  rs.var('universal_set', new SetValue(rs, []), 'Universal set', false);

  /****************** ERROR CODES */
  for (const ecode in errors) {
    if (errors.hasOwnProperty(ecode)) {
      let short = errors[ecode];
      rs.var(short, new StringValue(rs, short), 'Error Code: ' + errorDesc[short], true);
    }
  }

  /****************** CORE FUNCTIONS */

  rs.define(new RunspaceBuiltinFunction(rs, 'help', { item: '?any' }, ({ item }) => {
    let help = '';
    if (item === undefined) {
      help = `help(?s) \t Get help on a specific symbol\nerror_code(code) \t Return brief help on a given error code\nvars() \t List all variables\nfuncs() \t List all functions\noperators() \t List all operators\nexit() \t Terminate the program`;
    } else if (item instanceof VariableToken) {
      let v = item.getVar();
      if (v.value instanceof FunctionRefValue) {
        let fn = v.value.getFn();
        if (fn === undefined) {
          item._throwNullRef();
        } else {
          let type = (fn instanceof RunspaceBuiltinFunction ? 'built-in' : 'user-defined') + (fn.constant ? '; constant' : '');
          help = `Type: function [${type}]\nDesc: ${fn.about()}\nSyntax: ${fn.defString()}`;
        }
      } else {
        help = `Type: variable${v.constant ? ' (constant)' : ''} - ${v.value.type()}\nDesc: ${v.desc}\nValue: ${v.toPrimitive('string')}`;
      }
    } else if (item instanceof StringValue && operators[item.value] !== undefined) { // Operator
      const info = operators[item.value];
      const argStr = Array.isArray(info.args) ? `${info.args.join(' or ')} (${info.args.length} overloads)` : info.args;
      help = `Type: string (operator)\nName: ${info.name}\nDesc: ${info.desc}\nArgs: ${argStr}\nPrecedence: ${info.precedence}\nUnary Overload: ${info.unary ? `yes (${info.unary})` : 'no'}\nSyntax: ${info.syntax}`;
    } else if (item instanceof Value) {
      help = `Type: ${item.type()}\nNumeric: ${item.toPrimitive('complex')}\nValue: ${item.toString()}`;
    } else {
      if (rs.opts.strict) throw new Error(`[${errors.BAD_ARG}] Argument Error: Cannot get help on given argument`);
    }
    return new StringValue(rs, help);
  }, 'Get general help or help on a provided argument', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'del', { obj: 'any', key: '?any' }, ({ obj, key }) => {
    if (obj instanceof VariableToken && key !== undefined) obj = obj.getVar().value;
    const v = obj.__del__?.(key);
    if (v === undefined) throw new Error(`[${errors.DEL}] Argument Error: cannot del() object of type ${obj.type()}`);
    return v;
  }, 'attempt to delete given object. If a key is given, attempts to delete that key from the given object.', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'exit', { c: '?real_int' }, ({ c }) => {
    print(`Terminating with exit code ${c === undefined ? 0 : c.toString()}`);
    process.exit(0);
  }, 'exit application with given code'));
  rs.define(new RunspaceBuiltinFunction(rs, 'funcs', { s: '?real_int' }, ({ s }) => {
    const funcs = [];
    if (s === undefined) {
      rs._funcs.forEach((scope, i) => {
        const sfuncs = [];
        for (let v in scope) {
          if (scope.hasOwnProperty(v)) sfuncs.push(v.toString());
        }
        funcs.push(new ArrayValue(rs, sfuncs));
      });
    } else {
      if (rs._funcs[s] === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: scope ${s} does not exist`);
      for (let v in rs._funcs[s]) {
        if (rs._funcs[s].hasOwnProperty(v)) {
          if (rs._funcs[s].hasOwnProperty(v)) funcs.push(v.toString());
        }
      }
    }
    return new ArrayValue(rs, funcs);
  }, 'return array of all defined functions'));
  rs.define(new RunspaceBuiltinFunction(rs, 'vars', { s: '?real_int' }, ({ s }) => {
    const vars = [];
    if (s === undefined) {
      rs._vars.forEach((scope, i) => {
        const svars = [];
        for (let v in scope) {
          if (scope.hasOwnProperty(v)) svars.push(v.toString());
        }
        vars.push(new ArrayValue(rs, svars));
      });
    } else {
      if (rs._vars[s] === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: scope ${s} does not exist`);
      for (let v in rs._vars[s]) {
        if (rs._vars[s].hasOwnProperty(v)) {
          if (rs._vars[s].hasOwnProperty(v)) vars.push(v.toString());
        }
      }
    }
    return new ArrayValue(rs, vars);
  }, 'list all defined variables in a given scope, or array of scopes'));
  rs.define(new RunspaceBuiltinFunction(rs, 'keywords', {}, () => new ArrayValue(rs, KeywordToken.keywords), 'list all keywords'));
  rs.define(new RunspaceBuiltinFunction(rs, 'operators', {}, () => new ArrayValue(rs, Object.keys(operators).map(op => new StringValue(rs, op))), 'return array all available operators'));
  rs.define(new RunspaceBuiltinFunction(rs, 'types', {}, () => new ArrayValue(rs, Object.keys(types).map(t => new StringValue(rs, t))), 'return array of all valid types'));
  rs.define(new RunspaceBuiltinFunction(rs, 'cast', { o: 'any', type: 'string' }, ({ o, type }) => o.castTo(type.toString()), 'attempt a direct cast from object <o> to type <type>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'type', { o: 'any' }, ({ o }) => new StringValue(rs, typeOf(o)), 'attempt a direct cast from object <o> to type <type>', false));
  rs.define(new RunspaceBuiltinFunction(rs, 'complex', { a: 'real', b: 'real' }, ({ a, b }) => new NumberValue(rs, new Complex(a, b)), 'create a complex number'));
  rs.define(new RunspaceBuiltinFunction(rs, 'new', { t: 'string' }, ({ t }) => {
    t = t.toString();
    const value = Value.__new__?.(rs, t);
    if (value === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: Argument type ${t} cannot be initialised`);
    return value;
  }, 'create new value of type <t>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'copy', { o: 'any' }, ({ o }) => {
    const copy = o.__copy__?.();
    if (copy === undefined) throw new Error(`[${errors.CANT_COPY}] Type Error: Type ${o.type()} cannot be copied`);
    return copy;
  }, 'Return a copy of object <o>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'chr', { n: 'real_int' }, ({ n }) => new StringValue(rs, String.fromCharCode(n.toPrimitive("real"))), 'return character with ASCII code <n>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'ord', { chr: 'string' }, ({ chr }) => new NumberValue(rs, chr.toString().charCodeAt(0)), 'return character code of <chr>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'range', { a: 'real', b: '?real', c: '?real' }, ({ a, b, c }) => {
    let start, end, step;
    if (b === undefined) { start = 0; end = a.toPrimitive('real'); step = 1; }
    else if (c === undefined) { start = a.toPrimitive('real'); end = b.toPrimitive('real'); step = 1; }
    else { start = a.toPrimitive('real'); end = b.toPrimitive('real'); step = c.toPrimitive('real'); }
    if (isNaN(start) || isNaN(end) || isNaN(step) || !isFinite(start) || !isFinite(end) || !isFinite(step) || Math.sign(end - start) !== Math.sign(step)) throw new Error(`[${errors.BAD_ARG}] Argument Error: Argument type Argument Error: range is infinite given arguments`);
    const range = [];
    for (let n = start; n < end; n += step) range.push(new NumberValue(rs, n));
    return new ArrayValue(rs, range);
  }, 'Return array populated with numbers between <a>-<b> step <c>. 1 arg=range(0,<a>,1); 2 args=range(<a>,<b>,1); 3 args=range(<a>,<b>,<c>)'));
  rs.define(new RunspaceBuiltinFunction(rs, 'len', { o: 'any' }, ({ o }) => {
    const length = o.__len__?.();
    if (length === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: argument of type ${o.type()} has no len()`);
    return new NumberValue(rs, length === undefined ? NaN : length);
  }, 'return length of argument'));
  rs.define(new RunspaceBuiltinFunction(rs, 'abs', { o: 'any' }, ({ o }) => {
    const abs = o.__abs__?.();
    if (abs === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: argument of type ${o.type()} has no abs()`);
    return new NumberValue(rs, abs === undefined ? NaN : abs);
  }, 'return length of argument'));
  rs.define(new RunspaceBuiltinFunction(rs, 'get', { arg: 'any', key: 'any' }, ({ arg, key }) => {
    if (typeof arg.__get__ !== 'function') throw new Error(`[${errors.BAD_ARG}] Argument Error: cannot get() type ${arg.type()}`);
    return arg.__get__(key);
  }, 'get item at <i> in <arg>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'set', { arg: 'any', key: 'any', value: 'any' }, ({ arg, key, value }) => {
    if (typeof arg.__set__ !== 'function') throw new Error(`[${errors.BAD_ARG}] Argument Error: cannot set() type ${arg.type()}`);
    return arg.__set__(key, value);
  }, 'set item at <i> in array <arr> to <item>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'push', { arr: 'array', item: 'any' }, ({ arr, item }) => {
    if (arr instanceof ArrayValue) return new NumberValue(rs, arr.value.push(item));
    if (arr instanceof SetValue) { arr.run(() => arr.value.push(item)); return new NumberValue(rs, arr.value.length); }
    throw new Error(`[${errors.TYPE_ERROR}] Type Error: expected arraylike, got ${arr.type()}`);
  }, 'push item <item> to array <arr>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'pop', { arr: 'array' }, ({ arr }) => {
    if (arr instanceof ArrayValue || arr instanceof SetValue) return arr.value.pop();
    throw new Error(`[${errors.TYPE_ERROR}] Type Error: expected array, got ${arr.type()}`);
  }, 'pop item from array <arr>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'reverse', { arg: 'any' }, ({ arg }) => {
    if (arg instanceof ArrayValue || arg instanceof SetValue) arg.value.reverse();
    else if (arg instanceof StringValue) arg.value = arg.value.split('').reverse().join('');
    else throw new Error(`[${errors.TYPE_ERROR}] Type Error: unable to reverse object of type ${arg.type()}`);
    return arg;
  }, 'reverse argument <arg>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'sort', { arr: 'array' }, ({ arr }) => {
    return new ArrayValue(rs, sort(arr.toPrimitive('array').map((v, i) => {
      if (v.type() !== 'real') throw new Error(`[${errors.TYPE_ERROR}]  Type Error: expected array of real numbers, got ${v.type()} at index ${i}`);
      return v.toPrimitive('real');
    })).map(n => new NumberValue(rs, n)));
  }, 'sort array numerically'));
  rs.define(new RunspaceBuiltinFunction(rs, 'apply', { arr: 'array', action: 'any' }, ({ arr, action }) => {
    if (!(arr instanceof ArrayValue)) throw new Error(`[${errors.TYPE_ERROR}] Type Error: expected array, got ${arr.type()}`);

    if (action instanceof StringValue) {
      const op = operators[action.value];
      if (op) {
        if (op.args === 2 || (Array.isArray(op.args) && op.args.includes(2))) {
          let acc = new NumberValue(rs, 0);
          const func = op[Array.isArray(op.args) ? 'fn2' : 'fn'];
          for (let i = 0; i < arr.value.length; i++) acc = func(acc, arr.value[i]);
          return acc;
        } else if (op.args === 1 || (Array.isArray(op.args) && op.args.includes(1))) {
          for (let i = 0; i < arr.value.length; i++) {
            let tmp = op[Array.isArray(op.args) ? 'fn1' : 'fn'](arr.value[i]);
            if (tmp === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: no operator overload for '${action.value}' for { <${arr.value[i].type()}> ${arr.value[i].castTo('string')} }`);
            arr.value[i] = tmp;
          }
          return arr;
        } else {
          throw new Error(`[${errors.BAD_ARG}] Argument Error: cannot apply operator '${action.value}' to array`);
        }
      } else {
        let tl;
        try {
          tl = rs.parse(action.value);
        } catch (e) {
          throw new Error(`Apply action: ${action.value}:\n${e}`);
        }

        tl.rs.pushScope();
        for (let i = 0; i < arr.value.length; i++) {
          try {
            tl.rs.var('x', arr.value[i]);
            arr.value[i] = tl.eval();
          } catch (e) {
            throw new Error(`${action.value} when x = ${arr.value[i].toPrimitive('string')}:\n${e}`);
          }
        }
        tl.rs.popScope();
        return arr;
      }
    } else if (action instanceof FunctionRefValue) {
      const fn = action.getFn(), args = Object.entries(fn.args);
      for (let i = 0, ans; i < arr.value.length; i++) {
        try {
          if (args.length === 1) ans = fn.eval([arr.value[i].eval(args[0][1])]);
          else if (args.length === 2) ans = fn.eval([arr.value[i].eval(args[0][1]), new NumberValue(rs, i).eval(args[1][1])]);
          else if (args.length === 3) ans = fn.eval([arr.value[i].eval(args[0][1]), new NumberValue(rs, i).eval(args[1][1]), arr.eval(args[2][1])]);
          else throw new Error(`[${errors.ARG_COUNT}] Argument Error: cannot apply ${action} to array: unsupported argument count ${args.length}`);
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
  rs.define(new RunspaceBuiltinFunction(rs, 'find', { item: 'any', o: 'any' }, ({ item, o }) => {
    if (o instanceof ArrayValue || o instanceof SetValue) return new NumberValue(rs, findIndex(item, o.value));
    if (o instanceof StringValue) return new NumberValue(rs, o.value.indexOf(item.toString()));
    throw new Error(`[${errors.BAD_ARG}] Argument Error: cannot search type ${o.type()}`);
  }, 'Return index of <item> in <o> or -1'));
  rs.define(new RunspaceBuiltinFunction(rs, 'base', { arg: 'string', from: 'real_int', to: 'real_int' }, ({ arg, from, to }) => {
    from = from.toPrimitive('real_int');
    to = to.toPrimitive('real_int');
    if (from < 2 || from > 36) throw new Error(`[${errors.BAD_ARG}] Argument Error: invalid base: <from> = ${from}`);
    if (to < 2 || to > 36) throw new Error(`[${errors.BAD_ARG}] Argument Error: invalid base: <to> = ${to}`);
    return StringValue(rs, parseInt(arg.toString(), from).toString(to));
  }, 'Convert <arg> from base <from> to base <to>'));
  rs.define(new RunspaceBuiltinFunction(rs, 'eval', { str: 'string' }, ({ str }) => rs.interpret(str.toString()).value, 'evaluate an input'));
  rs.define(new RunspaceBuiltinFunction(rs, 'rpn', { str: 'string' }, ({ str }) => new StringValue(rs, rs.parseString(str.toString()).toRPN().join(' ')), 'transform input to RPN notation'));
  rs.define(new RunspaceBuiltinFunction(rs, 'iif', { cond: 'bool', ifTrue: 'any', ifFalse: '?any' }, ({ cond, ifTrue, ifFalse }) => cond.toPrimitive('bool') ? ifTrue : (ifFalse === undefined ? new BoolValue(rs, false) : ifFalse), 'Inline IF: If <cond> is truthy, return <ifTrue> else return <ifFalse> or false'));
  rs.define(new RunspaceBuiltinFunction(rs, 'import', { file: 'string' }, ({ file }) => {
    rs.import(file);
    return new NumberValue(rs, 0);
  }, 'Import <file> - see README.md for more details'));
  rs.define(new RunspaceBuiltinFunction(rs, 'error_code', { code: 'string' }, ({ code }) => {
    if (code in errorDesc) {
      return new StringValue(rs, errorDesc[code]);
    } else {
      throw new Error(`[${errors.BAD_ARG}] Argument Error: no such error code: [${code}]`);
    }
  }, 'Return brief description of an error code (the [...] in an error message)'));

  return rs;
}

/** Built-in Variables */
function defineVars(rs) {
  rs.var('DBL_EPSILON', DBL_EPSILON, 'smallest such that 1.0+DBL_EPSILON != 1.0', true);
  rs.var('pi', PI, 'pi is equal to the circumference of any circle divided by its diameter', true); // pi
  if (rs.opts.defineAliases) rs.var('π', rs.var('pi'));
  rs.var('e', E, 'Euler\'s constant', true); // e
  rs.var('omega', OMEGA, 'Principle solution to xe^x = 1 (= W(1))', true); // W(1, 0)
  if (rs.opts.defineAliases) rs.var('Ω', rs.var('omega'));
  rs.var('phi', PHI, 'Phi, the golden ratio, approx (1 + √5)/2', true); // phi, golden ratio
  if (rs.opts.defineAliases) rs.var('φ', rs.var('phi'));
  rs.var('tau', TWO_PI, 'A constant representing the ratio between circumference and radius of a circle'); // tau
  if (rs.opts.defineAliases) rs.var('τ', rs.var('tau'));
  rs.var(Complex.imagLetter, Complex.I(), '√(-1)');
  rs.var('ln2', Math.LN2, 'Natural logarithm of 2');
  rs.var('ln10', Math.LN10, 'Natural logarithm of 10');
  rs.var('log2e', Math.LOG2E, 'Base-2 logarithm of e');
  rs.var('log10e', Math.LOG10E, 'Base-10 logarithm of e');
  rs.var('sqrt1_2', Math.SQRT1_2, 'Square root of 0.5');
  rs.var('sqrt2', Math.SQRT2, 'Square root of 2');
  rs.var('empty_set', new SetValue(rs, []), 'Empty set', true);
  if (rs.opts.defineAliases) rs.var('∅', rs.var('empty_set'));
}

/** Built-in functions */
function defineFuncs(rs) {
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
  rs.define(new RunspaceBuiltinFunction(rs, 'factorial', { z: 'complex' }, ({ z }) => new NumberValue(rs, factorial(z.toPrimitive('complex'))), 'calculate the factorial of x using the Gamma function'));
  rs.define(new RunspaceBuiltinFunction(rs, 'factorialReal', { x: 'real_int' }, ({ x }) => new NumberValue(rs, factorialReal(x.toPrimitive('real'))), 'calculate the factorial of x using the common algorithm'));
  rs.define(new RunspaceBuiltinFunction(rs, 'ln', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.log(z.toPrimitive('complex'))), 'calculate the natural logarithm of x')); // natural logarithm
  rs.define(new RunspaceBuiltinFunction(rs, 'log', { a: 'complex', b: '?complex' }, ({ a, b }) => {
    return new NumberValue(rs, b === undefined ?
      Complex.div(Complex.log(a.toPrimitive('complex')), Math.LN10) :// log base 10 of <a>
      Complex.div(Complex.log(b.toPrimitive('complex')), Complex.log(a.toPrimitive('complex'))));// log base <a> of <b>
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
    if (r > n) throw new Error(`[${errors.BAD_ARG}] Argument Error: invalid argument size relationship: n=${n} and r=${r}`);
    return new NumberValue(rs, factorial(n) / factorial(n - r));
  }, 'Return the probability of selecting an ordered set of <r> objects from a group of <n> number of objects'));
  rs.define(new RunspaceBuiltinFunction(rs, 'nCr', { n: 'real_int', r: 'real_int' }, ({ n, r }) => {
    n = n.toPrimitive('real');
    r = r.toPrimitive('real');
    if (r > n) throw new Error(`[${errors.BAD_ARG}] Argument Error: invalid argument size relationship: n=${n} and r=${r}`);
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
  // if (rs.opts.defineAliases) rs.funcAlias('sqrt', '√');
  rs.define(new RunspaceBuiltinFunction(rs, 'summation', { start: 'any', limit: 'any', action: 'any', svar: '?any' }, ({ start, limit, action, svar }) => {
    let sumVar = 'x', sum = new Complex(0);
    start = start.toPrimitive('real_int');
    limit = limit.toPrimitive('real_int');
    if (svar !== undefined) {
      if (svar instanceof StringValue) {
        sumVar = svar.toString();
        let extract = parseVariable(sumVar);
        if (sumVar !== extract) throw new Error(`[${errors.BAD_ARG}] Argument Error: Invalid variable provided '${sumVar}'`);
      } else throw new Error(`[${errors.BAD_ARG}] Argument Error: Invalid value for <svar>`);
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
    } else if (action instanceof StringValue) { // Evaluate action as source code
      let tl;
      try {
        tl = rs.parse(action.value);
      } catch (e) {
        throw new Error(`Summation action: ${action.value}:\n${e}`);
      }

      tl.rs.pushScope();
      for (let i = start; i <= limit; i++) {
        try {
          tl.rs.var(sumVar, i);
          sum.add(tl.eval().toPrimitive('complex'));
        } catch (e) {
          throw new Error(`${action.value} when ${sumVar} = ${i}:\n${e}`);
        }
      }
      tl.rs.popScope();
    } else {
      throw new Error(`[${errors.BAD_ARG}] Argument Error: invalid summation action`);
    }
    return new NumberValue(rs, sum);
  }, 'Calculate a summation series between <start> and <limit>, executing <action> (may be constant, function or string). Use variable <svar> as counter.'));
  // if (rs.opts.defineAliases) rs.funcAlias('summation', '∑');
  rs.define(new RunspaceBuiltinFunction(rs, 'tan', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.tan(z.toPrimitive('complex'))), 'return tangent of z')); // tangent
  rs.define(new RunspaceBuiltinFunction(rs, 'tanh', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.tanh(z.toPrimitive('complex'))), 'return hyperbolic tangent of z')); // hyperbolic tangent
  rs.define(new RunspaceBuiltinFunction(rs, 'lambertw', { z: 'complex', k: '?real', tol: '?real' }, ({ z, k, tol }) => new NumberValue(rs, lambertw(z.toPrimitive('complex'), k?.toPrimitive('real'), tol?.toPrimitive('real'))), 'return approximation of the Lambert W function at <k> branch with <tol> tolerance'));
  // if (rs.opts.defineAliases) rs.funcAlias('lambertw', 'W');
  rs.define(new RunspaceBuiltinFunction(rs, 'wrightomega', { z: 'complex' }, ({ z }) => new NumberValue(rs, wrightomega(z.toPrimitive('complex'))), 'return approximation of the Wright Omega function'));
  // if (rs.opts.defineAliases) rs.funcAlias('wrightomega', 'ω');
  rs.define(new RunspaceBuiltinFunction(rs, 'gamma', { z: 'complex' }, ({ z }) => new NumberValue(rs, gamma(z.toPrimitive('complex'))), 'Return the gamma function at z'));
  // if (rs.opts.defineAliases) rs.funcAlias('gamma', 'Γ');
  rs.define(new RunspaceBuiltinFunction(rs, 'nextNearest', { n: 'real', dir: 'real' }, ({ n, dir }) => new NumberValue(rs, nextNearest(n.toPrimitive('real'), dir.toPrimitive('real'))), 'Return the next representable double from value <n> towards direction <dir>'));
}

module.exports = { define, defineVars, defineFuncs };