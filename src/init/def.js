const Complex = require("../maths/Complex");
const { RunspaceBuiltinFunction } = require("../runspace/Function");
const { VariableToken, KeywordToken } = require("../evaluation/tokens");
const { lambertw, isPrime, LCF, primeFactors, factorialReal, factorial, generatePrimes, mean, variance, PMCC, gamma, wrightomega, nextNearest, stirling, zeta, bernoulli, random } = require("../maths/functions");
const { sort, numberTypes, toBinary, fromBinary, int_to_base, base_to_int } = require("../utils");
const { types, isTypeOverlap } = require("../evaluation/types");
const { FunctionRefValue, StringValue, Value, ArrayValue, NumberValue, SetValue, BoolValue, UndefinedValue, CharValue, MapValue } = require("../evaluation/values");
const { PI, E, OMEGA, PHI, TWO_PI, DBL_EPSILON } = require("../maths/constants");
const operators = require("../evaluation/operators");
const { errors, errorDesc } = require("../errors");
const { Fraction } = require("../maths/Fraction");

/** Core definitions !REQUIRED! */
function define(rs) {
  /****************** CORE VARIABLES */
  rs.defineVar('nan', NaN, 'Value representing Not A Number');
  rs.defineVar('inf', Infinity, 'Value representing Infinity');
  rs.defineVar('undef', new UndefinedValue(rs), 'A variable that has not been assigned a value is of type undefined');
  rs.defineVar('universal_set', new SetValue(rs, []), 'Universal set');

  /****************** CORE FUNCTIONS */

  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'help', { item: '?any' }, async ({ item }) => {
    let help = '';
    if (item === undefined) {
      help = `help(?s) \t Get help on an argument e.g. function, variable, operator\ncopyright() \t View copyright information\nerror_code(code) \t Return brief help on a given error code\nvars() \t Return array of all variables\noperators() \t Return array of all operators\ntypes() \t Return array of all available types \nnew(type) \t Instantiates a new value of type <type> \nkeywords() \t Return array of all keywords \nimport() \t Import a script relative to import_dir()\nexit() \t Terminate the program`;
    } else if (item instanceof VariableToken) {
      let v = item.getVar();
      if (v.value instanceof FunctionRefValue) {
        let fn = v.value.getFn();
        if (fn === undefined) {
          item._throwNullRef();
        } else {
          help = `${(fn instanceof RunspaceBuiltinFunction ? 'built-in' : 'user-defined')} function ${fn.signature()}\n/* @argcount ${fn.argMin === fn.argMax ? fn.argMin : isFinite(fn.argMax) ? `${fn.argMin}-${fn.argMax}` : fn.argMin + "+"}, @about ${fn.about()} */`;
        }
      } else {
        help = `let ${item.value}: ${v.value.type()} = ${v.toPrimitive("string")}\n/* @about ${v.desc} */`;
      }
    } else if (item instanceof StringValue && operators[item.value] !== undefined) { // Operator
      const info = operators[item.value];
      const argStr = Array.isArray(info.args) ? `${info.args.join(' or ')} (${info.args.length} overloads)` : info.args;
      help = `operator ${item.value} "${info.name}"\n/* @about ${info.desc} (${argStr} args)${info.unary ? ` (has unary overload)` : ''}\n * @precedence ${info.precedence}, @associativity ${info.assoc} */`;
    } else if (item instanceof StringValue && KeywordToken.keywords.includes(item.value)) { // KEYWORDS
      help = `keyword "${item.value}"`;
    } else if (item instanceof Value) {
      let str = item.toString();
      help = `string[${str.length}] "${str}"`;
    } else {
      if (rs.opts.strict) throw new Error(`[${errors.BAD_ARG}] Argument Error: Cannot get help on given argument`);
    }
    return new StringValue(rs, help);
  }, 'Get general help or help on a provided argument'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'copyright', {}, () => new StringValue(rs, "Copyright (c) 2022 Ruben Saunders.\nAll Right Reserved."), 'View copyright information'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'del', { obj: 'any', key: '?any' }, ({ obj, key }) => {
    const v = key === undefined ? obj.__del__?.(key) : obj.castTo("any").__del__?.(key);
    if (v === undefined) throw new Error(`[${errors.DEL}] Argument Error: cannot del() object of type ${obj.type()}`);
    return v;
  }, 'attempt to delete given object. If a key is given, attempts to delete that key from the given object.'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'exit', { c: '?real_int' }, ({ c }, evalObj) => {
    if (c === undefined) c = new NumberValue(rs, 0);
    evalObj.action = -1;
    evalObj.actionValue = c.toPrimitive("real");
    return c;
  }, 'exit application with given code'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'signal', { code: '?real_int', value: '?any' }, ({ code, value }, evalObj) => {
    if (code !== undefined) {
      evalObj.action = code.toPrimitive("real_int");
      if (value !== undefined) evalObj.actionValue = value;
    }
    return new NumberValue(rs, evalObj.action);
  }, 'Get/set current evaluation signal'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'locals', {}, (_, evalObj) => {
    const scopes = rs.get_process(evalObj.pid).vars;
    const vars = Array.from(scopes[scopes.length - 1].keys()).map(n => new StringValue(rs, n));
    return new ArrayValue(rs, vars);
  }, 'list all variables in the current scope (local variables)'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'vars', {}, (_, evalObj) => {
    const vars = new Set(), scopes = rs.get_process(evalObj.pid).vars;
    for (let i = scopes.length - 1; i >= 0; i--) {
      scopes[i].forEach((variable, name) => {
        if (!vars.has(variable)) vars.add(name);
      });
    }
    return new ArrayValue(rs, Array.from(vars).map(v => new StringValue(rs, v)));
  }, 'list all defined variables in the process'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'globals', {}, () => {
    const vars = Array.from(rs._globals.keys()).map(n => new StringValue(rs, n));
    return new ArrayValue(rs, vars);
  }, 'list all variables in the global scope. These cannot be deleted.'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'labels', {}, (_, evalObj) => {
    const lmap = rs.get_process(evalObj.pid).blocks.get(evalObj.blockID).getAllLabels();
    return new ArrayValue(rs, Array.from(lmap.keys()).map(l => new StringValue(rs, l)));
  }, 'list all addressable labels'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'scope_push', {}, (_, evalObj) => {
    rs.pushScope(evalObj.pid);
    return new NumberValue(rs, rs.get_process(evalObj.pid).vars.length);
  }, 'Force a creation of a new lexical scope'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'scope_pop', {}, (_, evalObj) => {
    const len = rs.get_process(evalObj.pid).vars.length;
    if (len > 1) {
      rs.popScope(evalObj.pid);
      return new NumberValue(rs, len - 1);
    } else {
      return new NumberValue(rs, len);
    }
  }, 'Force the destruction of the current local scope (will not pop local#0)'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'keywords', {}, () => new ArrayValue(rs, KeywordToken.keywords.map(kw => new StringValue(rs, kw))), 'list all keywords'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'operators', {}, () => new ArrayValue(rs, Object.keys(operators).map(op => new StringValue(rs, op))), 'return array all available operators'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'types', {}, () => new ArrayValue(rs, Array.from(types).map(t => new StringValue(rs, t))), 'return array of all valid types'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'cast', { o: 'any', type: 'string' }, ({ o, type }) => o.castTo(type.toString()), 'attempt a direct cast from object <o> to type <type>'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'type', { o: 'any' }, ({ o }) => new StringValue(rs, o.type()), 'returns the type of object <o>'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'type_overlap', { t1: 'string', t2: 'string' }, ({ t1, t2 }) => new BoolValue(rs, isTypeOverlap(t1.toString(), t2.toString())), 'does type t1 overlap with type t2?'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'complex', { a: 'real', b: 'real' }, ({ a, b }) => new NumberValue(rs, new Complex(a, b)), 'create a complex number'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'void', { o: 'any' }, ({ o }) => new UndefinedValue(rs), 'throws away given argument - returns undefined'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'new', { t: 'string' }, ({ t }) => {
    t = t.castTo('any');
    if (t instanceof MapValue) {
      return t.createInstance();
    } else {
      t = t.toString();
      const value = Value.__new__?.(rs, t);
      if (value === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: Type ${t} cannot be initialised`);
      return value;
    }
  }, 'create new value of type <t>. If <t> is a map, creates new instance (doesn\'t call _Construct)'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'isinstance', { o: 'any', t: '?any' }, ({ o, t }) => {
    o = o.castTo('any');
    if (t === undefined) return new BoolValue(rs, o instanceof MapValue && o.instanceOf !== undefined);
    t = t.castTo('any');
    let b = (o instanceof MapValue && t instanceof MapValue) ? o.isInstanceOf(t) : o.type() === t.type();
    return new BoolValue(rs, b);
  }, 'return if <o> is an instance of, or inherits from, <t>. If <o> and <t> are not maps, compares types. If only one argument provided, returns if <o> is an instance of anything.'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'inherit', { inheritor: 'map', types: { type: 'map', ellipse: true } }, ({ inheritor, types }) => {
    inheritor = inheritor.castTo('any');
    if (!(inheritor instanceof MapValue)) throw new Error(`[${errors.BAD_ARG}] Argument Error: expected inheritor to be of type map, got type ${inheritor.type()}`);
    types = types.toPrimitive('array').map(o => o.castTo('any'));
    for (let o of types) if (!(o instanceof MapValue)) throw new Error(`[${errors.BAD_ARG}] Argument Error: expected types to be array of maps, got type ${o.type()}`);
    for (let o of types) inheritor.inheritFrom.add(o);
    return inheritor;
  }, '<inheritor> now inherits from <types>'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'array', { len: '?real_int', val: '?any' }, async ({ len, val }, evalObj) => {
    if (len === undefined) return new ArrayValue(rs);
    if (val === undefined) return new ArrayValue(rs, Array.from({ length: len.toPrimitive('real_int') }).fill(rs.UNDEFINED));
    val = val.castTo('any');
    if (val.type() === "func") {
      const arr = Array.from({ length: len.toPrimitive('real_int') });
      for (let i = 0; i < arr.length; i++) arr[i] = await val.value.call(evalObj, [new NumberValue(rs, i)]);
      return new ArrayValue(rs, arr);
    }
    return new ArrayValue(rs, Array.from({ length: len.toPrimitive('real_int') }).fill(val));
  }, 'create and return a new array of length <len=1>. Fill with value <val=undef>, of call <val>(index)'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'array2d', { cols: 'real_int', rows: 'real_int', val: '?any' }, async ({ cols, rows, val }, evalObj) => {
    val = val ? val.castTo('any') : rs.UNDEFINED;
    cols = cols.toPrimitive('real_int');
    rows = rows.toPrimitive('real_int');
    if (val.type() === 'func') {
      return new ArrayValue(rs, await Promise.all(Array.from({ length: cols }, async () => new ArrayValue(rs, await Promise.all(Array.from({ length: rows }, () => val.value.call(evalObj)))))));
    } else {
      return new ArrayValue(rs, Array.from({ length: cols }, () => new ArrayValue(rs, Array.from({ length: rows }).fill(val))));
    }
  }, 'create and return a 2D new array with <cols> cols and <rows> rows, and fill with <val=undef> (may be a function)'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'copy', { o: 'any' }, ({ o }) => {
    const copy = o.castTo("any").__copy__?.();
    if (copy === undefined) throw new Error(`[${errors.CANT_COPY}] Type Error: Type ${o.type()} cannot be copied`);
    return copy;
  }, 'Return a copy of object <o>'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'call', { fn: 'string', args: { type: 'array', optional: true, ellipse: true } }, async ({ fn, args }, evalObj) => {
    fn = fn.castTo("any").getFn();
    const ret = await fn.call(evalObj, args ? args.toPrimitive("array").map(t => t.castTo("any")) : []);
    return ret;
  }, 'Call function <fn> with <args> provided as arguments'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'chr', { n: 'real_int' }, ({ n }) => new CharValue(rs, String.fromCharCode(n.toPrimitive("real"))), 'return character with ASCII code <n>'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'ord', { chr: 'string' }, ({ chr }) => new NumberValue(rs, chr.toString().charCodeAt(0)), 'return character code of <chr>'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'isdefined', { name: 'string' }, ({ name }, evalObj) => {
    let value = rs.getVar(name.toString(), evalObj.pid);
    return new BoolValue(rs, value);
  }, 'returns boolean indicating if name <name> is defined and accessable'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'getvar', { name: 'string' }, ({ name }, evalObj) => {
    const obj = rs.getVar(name.toString(), evalObj.pid);
    return obj ? obj.castTo("any") : rs.UNDEFINED;
  }, 'get variable with name <name> (or undef)'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'setvar', { name: 'string', value: '?any' }, ({ name, value }, evalObj) => {
    name = name.toString();
    value = value.castTo('any');
    rs.defineVar(name, value, undefined, evalObj.pid);
    return value;
  }, 'sets/defines local variable with name <name>'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'range', { a: 'real', b: '?real', c: '?real' }, ({ a, b, c }) => {
    let start, end, step;
    if (b === undefined) { start = 0; end = a.toPrimitive('real'); step = 1; }
    else if (c === undefined) { start = a.toPrimitive('real'); end = b.toPrimitive('real'); step = 1; }
    else { start = a.toPrimitive('real'); end = b.toPrimitive('real'); step = c.toPrimitive('real'); }
    if (isNaN(start) || isNaN(end) || isNaN(step) || !isFinite(start) || !isFinite(end) || !isFinite(step) || Math.sign(end - start) !== Math.sign(step)) throw new Error(`[${errors.BAD_ARG}] Argument Error: Argument type Argument Error: range is infinite given arguments`);
    const range = [];
    for (let n = start; n < end; n += step) range.push(new NumberValue(rs, n));
    return new ArrayValue(rs, range);
  }, 'Return array populated with numbers between <a>-<b> step <c>. 1 arg=range(0,<a>,1); 2 args=range(<a>,<b>,1); 3 args=range(<a>,<b>,<c>)'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'len', { o: 'any', len: '?real_int' }, ({ o, len }) => {
    o = o.castTo("any");
    let length;
    if (len) {
      const rlen = len.toPrimitive('real_int');
      if (rlen < 0 || isNaN(rlen) || !isFinite(rlen)) throw new Error(`[${errors.BAD_ARG}] Argument Error: invalid length ${len}`);
      length = o.__len__?.(rlen);
    } else {
      length = o.__len__?.();
    }
    if (length === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: argument of type ${o.type()} has no len()`);
    return new NumberValue(rs, length === undefined ? NaN : length);
  }, 'return length of argument or set new length'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'to_json', { o: 'any' }, ({ o }) => {
    const json = o.castTo("any").__toJson__?.();
    if (json === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: argument of type ${o.type()} cannot be converted to JSON`);
    return new StringValue(rs, json);
  }, 'return JSON representation of object'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'max', { o: 'any' }, ({ o }) => {
    const max = o.castTo("any").__max__?.();
    if (max === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: argument of type ${o.type()} has no max()`);
    return max;
  }, 'return maximum value of the argument'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'min', { o: 'any' }, ({ o }) => {
    const min = o.castTo("any").__min__?.();
    if (min === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: argument of type ${o.type()} has no min()`);
    return min;
  }, 'return minimum value of the argument'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'abs', { o: 'any' }, ({ o }) => {
    const abs = o.castTo("any").__abs__?.();
    if (abs === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: argument of type ${o.type()} has no abs()`);
    return new NumberValue(rs, abs === undefined ? NaN : abs);
  }, 'return length of argument'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'getprop', { arg: 'any', key: 'any' }, ({ arg, key }) => {
    arg = arg.castTo("any");
    if (typeof arg.__get__ !== 'function') throw new Error(`[${errors.BAD_ARG}] Argument Error: cannot get property of type ${arg.type()}`);
    return arg.__get__(key);
  }, 'get property <key> in <arg> (same as <arg>[<key>])'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'setprop', { arg: 'any', key: 'any', value: 'any' }, ({ arg, key, value }) => {
    arg = arg.castTo("any");
    key = key.castTo('any');
    value = value.castTo('any');
    if (typeof arg.__set__ !== 'function') throw new Error(`[${errors.BAD_ARG}] Argument Error: cannot set property of type ${arg.type()}`);
    return arg.__set__(key, value);
  }, 'set property <key> in <arr> to <item> (same as <arg>[<key>] = <value>)'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'push', { arr: 'array', item: 'any' }, ({ arr, item }) => {
    arr = arr.castTo('any');
    item = item.castTo('any');
    if (arr instanceof ArrayValue) return new NumberValue(rs, arr.value.push(item));
    if (arr instanceof SetValue) { arr.run(() => arr.value.push(item)); return new NumberValue(rs, arr.value.length); }
    throw new Error(`[${errors.TYPE_ERROR}] Type Error: expected collection, got ${arr.type()}`);
  }, 'push item <item> to array <arr>'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'pop', { arr: 'array' }, ({ arr }) => {
    arr = arr.castTo("any");
    if (arr instanceof ArrayValue || arr instanceof SetValue) return arr.value.pop();
    throw new Error(`[${errors.TYPE_ERROR}] Type Error: expected array, got ${arr.type()}`);
  }, 'pop item from array <arr>'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'reverse', { arg: 'any' }, ({ arg }) => {
    arg = arg.castTo('any');
    let rev = arg.__reverse__?.();
    if (rev === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: cannot reverse() type ${arg.type()}`);
    return rev;
  }, 'reverse argument <arg>'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'sort', { arr: 'array' }, ({ arr }) => {
    return new ArrayValue(rs, sort(arr.toPrimitive('array').map((v, i) => {
      if (v.type() !== 'real') throw new Error(`[${errors.TYPE_ERROR}]  Type Error: expected array of real numbers, got ${v.type()} at index ${i}`);
      return v.toPrimitive('real');
    })).map(n => new NumberValue(rs, n)));
  }, 'sort array numerically'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'filter', { arr: 'array', fn: 'func' }, async ({ arr, fn }, evalObj) => {
    const array = [];
    fn = fn.castTo("func").getFn();
    if (fn.argMin !== 1 && fn.argMin !== 2) throw new Error(`[${errors.BAD_ARG}] Argument Error: func must accept at least 1 or 2 arguments, got function with ${fn.argMin} arguments`);
    arr = arr.toPrimitive('array');
    for (let i = 0; i < arr.length; i++) {
      let args = fn.argMin === 1 ? [arr[i]] : [arr[i], new NumberValue(rs, i)];
      let bool = await fn.call(evalObj, args);
      if (bool.toPrimitive('bool')) array.push(arr[i]);
    }
    return new ArrayValue(rs, array);
  }, 'Remove all values from arr for which fn(value, ?index) is false'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'map', { arr: 'array', fn: 'func' }, async ({ arr: rarr, fn }, evalObj) => {
    fn = fn.castTo("func").getFn();
    let arr = rarr.toPrimitive('array');
    const array = [];
    if (fn.argMin === 0) for (let i = 0; i < arr.length; i++) array.push(await fn.call(evalObj, []));
    else if (fn.argMin === 1) for (let i = 0; i < arr.length; i++) array.push(await fn.call(evalObj, [arr[i]]));
    else if (fn.argMin === 2) for (let i = 0; i < arr.length; i++) array.push(await fn.call(evalObj, [arr[i], new NumberValue(rs, i)]));
    else if (fn.argMin === 3) {
      let arrc = rarr.getVar().value.__copy__();
      for (let i = 0; i < arr.length; i++) array.push(await fn.call(evalObj, [arr[i], new NumberValue(rs, i), arrc]));
    } else
      throw new Error(`${errors.BAD_ARG} Argument Error: func must take 0-4 arguments, got ${fn.signature()}`);
    return new ArrayValue(rs, array);
  }, 'Apply func to each item in array, push return value to new array and return new array. Func -> (?item, ?index, ?array)'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'foreach', { arr: 'array', fn: 'func' }, async ({ arr: rarr, fn }, evalObj) => {
    fn = fn.castTo("func").getFn();
    let arr = rarr.toPrimitive('array');
    if (fn.argMin === 0) for (let i = 0; i < arr.length; i++) await fn.call(evalObj, []);
    else if (fn.argMin === 1) for (let i = 0; i < arr.length; i++) await fn.call(evalObj, [arr[i]]);
    else if (fn.argMin === 2) for (let i = 0; i < arr.length; i++) await fn.call(evalObj, [arr[i], new NumberValue(rs, i)]);
    else if (fn.argMin === 3) {
      let arrc = rarr.getVar().value.__copy__();
      for (let i = 0; i < arr.length; i++) await fn.call(evalObj, [arr[i], new NumberValue(rs, i), arrc]);
    }
    else throw new Error(`${errors.BAD_ARG} Argument Error: func must take 0-4 arguments, got ${fn.signature()}`);
    return new UndefinedValue(rs);
  }, 'Apply func to each item in array. Func -> (?item, ?index, ?array)'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'reduce', { arr: 'array', fn: 'func', initial: '?any' }, async ({ arr, fn, initial }, evalObj) => {
    let acc = initial ? initial.castTo('any') : new NumberValue(rs, 0);
    fn = fn.castTo('func').getFn();
    if (fn.argMin !== 2 && fn.argMin !== 3) throw new Error(`[${errors.BAD_ARG}] Argument Error: func must have 2 or 3 arguments, got function with ${fn.argMin} arguments`);
    arr = arr.toPrimitive('array');
    for (let i = 0; i < arr.length; i++) {
      let args = fn.argMin === 2 ? [acc, arr[i]] : [acc, arr[i], new NumberValue(rs, i)];
      acc = await fn.call(evalObj, args);
    }
    return acc;
  }, 'Reduce array to single value via func(acc, current, ?index). Initially, acc = initial or 0'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'find', { obj: 'any', item: 'any' }, ({ obj, item }) => {
    item = item.castTo("any");
    obj = obj.castTo("any");
    let ret = obj.__find__?.(item);
    if (ret === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: cannot search type ${o.type()}`);
    return ret;
  }, 'Find <item> in <o>. Collections: return index of <item> or -1. Map: return key of item with value <item> or undefined.'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'fill', { array: 'array', item: 'any' }, async ({ array, item }, evalObj) => {
    if (!(array instanceof VariableToken && array.type() === 'array')) throw new Error(`[${errors.BAD_ARG}] Argument Error: expected variable of type array for <array>`);
    item = item.castTo("any");
    let list = array.getVar().value, length = list.value.length;
    if (item.type() === 'func') {
      let fn = item.value;
      if (fn.argMin === 0) for (let i = 0; i < length; i++) list.value[i] = await fn.call(evalObj, []);
      else if (fn.argMin === 1) for (let i = 0; i < length; i++) list.value[i] = await fn.call(evalObj, [new NumberValue(rs, i)]);
      else throw new Error(`[${errors.BAD_ARG}] Argument Error: func <item> has invalid argument count. Expected 0-1, got ${fn.argMin}`);
    } else {
      for (let i = 0; i < length; i++) list.value[i] = item;
    }
    return array;
  }, 'Fills referenced array <array> with static <item> or, if <item> is a func, calls <item>(?index, ?array) for each item'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'base', { arg: 'string', from: 'real_int', to: 'real_int' }, ({ arg, from, to }) => {
    from = from.toPrimitive('real_int');
    to = to.toPrimitive('real_int');
    return new StringValue(rs, int_to_base(base_to_int(arg.toString(), from), to));
  }, 'Convert <arg> from base <from> to base <to>'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'eval', { str: 'string', pid: '?real_int' }, async ({ str, pid }, evalObj) => {
    pid = pid === undefined ? evalObj.pid : pid.toPrimitive("real_int");
    let proc = rs.get_process(pid);
    if (proc === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: cannot execute code on unexistant process PID=${pid}`);
    proc.imported_files.push('<eval>');
    await rs.exec(pid, str.toString());
    proc.imported_files.pop();
    if (proc.state === 2) throw proc.stateValue;
    return proc.stateValue.ret ?? rs.UNDEFINED;
  }, 'evaluate an input'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'iif', { cond: 'bool', ifTrue: 'any', ifFalse: '?any' }, ({ cond, ifTrue, ifFalse }) => cond.toPrimitive('bool') ? ifTrue : (ifFalse === undefined ? new BoolValue(rs, false) : ifFalse), 'Inline IF: If <cond> is truthy, return <ifTrue> else return <ifFalse> or false'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'import', { file: 'string' }, async ({ file }, evalObj) => await rs.import(evalObj.pid, file.toString()), 'Import <file> - see README.md for more details'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'import_stack', {}, (_, evalObj) => rs.generateArray(rs.get_process(evalObj.pid).import_stack.map(f => new StringValue(rs, f))), 'Return import stack'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'imported_files', {}, (_, evalObj) => rs.generateArray(rs.get_process(evalObj.pid).imported_files.map(f => new StringValue(rs, f))), 'Return imported files in current import chain'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'error_code', { code: 'string' }, ({ code }) => {
    code = code.toPrimitive("string");
    if (code in errorDesc) {
      return new StringValue(rs, errorDesc[code]);
    } else {
      throw new Error(`[${errors.BAD_ARG}] Argument Error: no such error code [${code}]`);
    }
  }, 'Return brief description of an error code (the [...] in an error message)'));

  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'ucase', { str: 'string' }, ({ str }) => new StringValue(rs, str.toString().toUpperCase()), 'String: to upper case'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'lcase', { str: 'string' }, ({ str }) => new StringValue(rs, str.toString().toLowerCase()), 'String: to upper case'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'tcase', { str: 'string' }, ({ str }) => new StringValue(rs, str.toString().split(' ').map(str => str[0].toUpperCase() + str.substr(1).toLowerCase()).join(' ')), 'String: to title case'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'replace', { str: 'string', search: 'string', replace: 'string', once: '?bool' }, ({ str, search, replace, once }) => new StringValue(rs, str.toString().replace((!once || (once && !once.toPrimitive('bool')) ? new RegExp(search.toString(), 'g') : search.toString()), replace.toString())), 'String: replace one/all instances of <search> with <replace>'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'substr', { str: 'string', index: 'real_int', length: '?real_int' }, ({ str, index, length }) => new StringValue(rs, str.toString().substr(index.toPrimitive('real_int'), length === undefined ? undefined : length.toPrimitive('real_int'))), 'String: return section of string starting at <index> and extending <length> chars'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'split', { str: 'string', splitter: '?string' }, ({ str, splitter }) => new ArrayValue(rs, str.toString().split(splitter === undefined ? '' : splitter.toString()).map(x => new StringValue(rs, x))), 'String: split string by <splitter> to form an array'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'join', { arr: 'array', seperator: '?string' }, ({ arr, seperator }) => new StringValue(rs, arr.toPrimitive('array').map(v => v.toString()).join(seperator ?? '')), 'String: Join elements in an array by <seperator> to form a string'));

  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'numbertypes', {}, () => new ArrayValue(rs, numberTypes.map(t => new StringValue(rs, t))), 'Return array of all numerical types'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'tobinary', { n: 'real', t: '?string' }, ({ n, t }) => {
    t = t ? t.toPrimitive('string') : 'float64';
    if (!numberTypes.includes(t)) throw new Error(`[${errors.BAD_ARG}] Argument Error: invalid numeric type '${t}'`);
    n = n.toPrimitive('real');
    let bin = toBinary(n, t);
    return new StringValue(rs, bin);
  }, 'Given a number, return binary representation as type <t> (default: float64. See numbertypes() for list of numerical types)'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'frombinary', { bin: 'string', t: '?string' }, ({ bin, t }) => {
    t = t ? t.toPrimitive('string') : 'float64';
    if (!numberTypes.includes(t)) throw new Error(`[${errors.BAD_ARG}] Argument Error: invalid numeric type '${t}'`);
    bin = bin.toPrimitive("string");
    let n = fromBinary(bin, t);
    return new NumberValue(rs, n);
  }, 'Given binary, return number representation as type <t> (default: float64. See numbertypes() for list of numerical types)'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'fnanal', { fn: 'func' }, ({ fn }) => {
    fn = fn.getVar().value.value;
    let map = new MapValue(rs);
    map.value.set("name", new StringValue(rs, fn.name));
    map.value.set("argMin", new NumberValue(rs, fn.argMin));
    map.value.set("argMax", new NumberValue(rs, fn.argMax));
    const args = [];
    for (let [param, data] of fn.args) {
      let pmap = new MapValue(rs);
      pmap.value.set("name", new StringValue(rs, param));
      pmap.value.set("pass", new StringValue(rs, data.pass));
      pmap.value.set("type", new StringValue(rs, data.type));
      pmap.value.set("optional", new BoolValue(rs, data.optional));
      pmap.value.set("ellipse", new BoolValue(rs, data.ellipse));
      args.push(pmap);
    }
    map.value.set("args", new ArrayValue(rs, args));
    return map;
  }, 'Return map analysis of provided function'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'fnsigmatch', { a: 'func', b: 'func' }, ({ a, b }) => {
    a = a.getVar().value.value;
    b = b.getVar().value.value;
    return new BoolValue(rs, a.signatureMatch(b));
  }, 'Return whether <a> matches <b>s signature'));

  return rs;
}

/** Built-in Variables */
function defineVars(rs) {
  rs.defineVar('DBL_EPSILON', DBL_EPSILON, 'smallest such that 1.0+DBL_EPSILON != 1.0');
  rs.defineVar('pi', PI, 'pi is equal to the circumference of any circle divided by its diameter'); // pi
  rs.defineVar('e', E, 'Euler\'s constant'); // e
  rs.defineVar('omega', OMEGA, 'Principle solution to xe^x = 1 (= W(1))'); // W(1, 0)
  rs.defineVar('phi', PHI, 'Phi, the golden ratio, approx (1 + √5)/2'); // phi, golden ratio
  rs.defineVar('tau', TWO_PI, 'A constant representing the ratio between circumference and radius of a circle'); // tau
  rs.defineVar(Complex.imagLetter, new Complex(0, 1), '√(-1)');
  rs.defineVar('ln2', Math.LN2, 'Natural logarithm of 2');
  rs.defineVar('ln10', Math.LN10, 'Natural logarithm of 10');
  rs.defineVar('log2e', Math.LOG2E, 'Base-2 logarithm of e');
  rs.defineVar('log10e', Math.LOG10E, 'Base-10 logarithm of e');
  rs.defineVar('sqrt1_2', Math.SQRT1_2, 'Square root of 0.5');
  rs.defineVar('sqrt2', Math.SQRT2, 'Square root of 2');
}

/** Built-in functions */
function defineFuncs(rs) {
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'arccos', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.arccos(z.toPrimitive('complex'))), 'return arccosine of z')); // arccosine
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'arccosh', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.arccosh(z.toPrimitive('complex'))), 'return hyperbolic arccosine of z')); // hyperbolic arccosine
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'arcsin', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.arcsin(z.toPrimitive('complex'))), 'return arcsine of z')); // arcsine
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'arcsinh', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.arcsinh(z.toPrimitive('complex'))), 'return hyperbolic arcsine of z')); // hyperbolic arcsine
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'arctan', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.arctan(z.toPrimitive('complex'))), 'return arctangent of z')); // arctangent
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'arctanh', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.arctanh(z.toPrimitive('complex'))), 'return hyperbolic arctangent of z')); // hyperbolic arctangent
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'arg', { z: 'complex' }, ({ z }) => new NumberValue(rs, z.toPrimitive('complex').arg()), 'return the argument of z'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'cbrt', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.cbrt(z.toPrimitive('complex'))), 'return cube root of x')); // cube root
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'ceil', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.ceil(z.toPrimitive('complex'))), 'round x up to the nearest integer')); // ceiling (round up)
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'conj', { z: 'complex' }, ({ z }) => new NumberValue(rs, z.toPrimitive('complex').conjugate()), 'return z* (the configate) of z'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'cos', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.cos(z.toPrimitive('complex'))), 'return cosine of x')); // cosine
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'cosh', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.cosh(z.toPrimitive('complex'))), 'return hyperbolic cosine of x')); // hyperbolic cosine
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'time', { msOffset: '?real_int' }, ({ msOffset }) => new NumberValue(rs, (msOffset ? new Date(msOffset.toPrimitive('real_int')) : new Date()).getTime()), 'returns the number of milliseconds elapsed since January 1, 1970 00:00:00 UTC'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'date', { arg: '?any' }, ({ arg }) => {
    let date, type = arg?.type();
    if (arg === undefined) date = new Date();
    else if (type === 'real') date = new Date(arg.toPrimitive('real_int'));
    else if (type === 'string') date = new Date(arg.toPrimitive('string'));
    else throw new Error(`[${errors.BAD_ARG}] Argument Error: cannot construct date from type ${type}`);
    return new StringValue(rs, date.toString());
  }, 'returns date string constructed from <arg>'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'exp', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.exp(z.toPrimitive('complex'))), 'return e^x')); // raise e to the x
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'floor', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.floor(z.toPrimitive('complex'))), 'round x down to the nearest integer')); // floor (round down)
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'isnan', { z: 'complex' }, ({ z }) => new BoolValue(rs, Complex.isNaN(z.toPrimitive('complex'))), 'return 0 or 1 depending on is x is NaN'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'isinf', { z: 'complex' }, ({ z }) => new BoolValue(rs, !Complex.isFinite(z.toPrimitive('complex'))), 'return 0 or 1 depending on is x is infinite'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'isprime', { x: 'real' }, ({ x }) => new BoolValue(rs, isPrime(x.toPrimitive('real'))), 'return 0 or 1 depending on if x is prime'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'primes', { limit: 'real_int' }, ({ limit }) => new ArrayValue(rs, generatePrimes(limit.toPrimitive('real'))), 'generate list of primes 0..limit'));

  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'factors', { x: 'real' }, ({ x }) => new ArrayValue(rs, primeFactors(x.toPrimitive('real')).map(n => new NumberValue(rs, n))), 'return prime factors of x'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'factorial', { z: 'complex' }, ({ z }) => new NumberValue(rs, factorial(z.toPrimitive('complex'))), 'calculate the factorial of x using the Gamma function'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'factorialReal', { x: 'real_int' }, ({ x }) => new NumberValue(rs, factorialReal(x.toPrimitive('real'))), 'calculate the factorial of x using the common algorithm'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'ln', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.log(z.toPrimitive('complex'))), 'calculate the natural logarithm of x')); // natural logarithm
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'log', { a: 'complex', b: '?complex' }, ({ a, b }) => {
    return new NumberValue(rs, b === undefined ?
      Complex.div(Complex.log(a.toPrimitive('complex')), Math.LN10) :// log base 10 of <a>
      Complex.div(Complex.log(b.toPrimitive('complex')), Complex.log(a.toPrimitive('complex'))));// log base <a> of <b>
  }, 'return log base <a> of <b>. If b is not provided, return log base 10 of <a>'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'lcf', { a: 'real', b: 'real' }, ({ a, b }) => new NumberValue(rs, LCF(a.toPrimitive('real'), b.toPrimitive('real'))), 'return the lowest common factor of a and b'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mean', { arr: 'array' }, ({ arr }) => new NumberValue(rs, mean(arr.toPrimitive('array').map(v => v.toPrimitive('real')))), 'calculate mean value in an array'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'PMCC', { x: 'array', y: 'array' }, ({ x, y }) => new NumberValue(rs, PMCC(x.toPrimitive('array').map(v => v.toPrimitive('real')), y.toPrimitive('array').map(v => v.toPrimitive('real')))), 'Calculate the Product Moment Correlation Coefficient between two data sets'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'variance', { arr: 'array' }, ({ arr }) => new NumberValue(rs, variance(arr.toPrimitive('array').map(v => v.toPrimitive('real')))), 'calculate variance in a dataset'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'random', { a: '?real', b: '?real' }, ({ a, b }) => {
    if (a !== undefined) a = a.toPrimitive('real');
    if (b !== undefined) b = b.toPrimitive('real');
    return new NumberValue(rs, random(a, b));
  }, 'return a pseudo-random decimal number. Range: 0 arguments: 0-1. 1 argument: 0-a. 2 arguments: a-b'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'nPr', { n: 'real_int', r: 'real_int' }, ({ n, r }) => {
    n = n.toPrimitive('real');
    r = r.toPrimitive('real');
    if (r > n) throw new Error(`[${errors.BAD_ARG}] Argument Error: invalid argument size relationship: n=${n} and r=${r}`);
    return new NumberValue(rs, factorial(n) / factorial(n - r));
  }, 'Return the probability of selecting an ordered set of <r> objects from a group of <n> number of objects'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'nCr', { n: 'real_int', r: 'real_int' }, ({ n, r }) => {
    n = n.toPrimitive('real');
    r = r.toPrimitive('real');
    if (r > n) throw new Error(`[${errors.BAD_ARG}] Argument Error: invalid argument size relationship: n=${n} and r=${r}`);
    return new NumberValue(rs, factorial(n) / (factorial(r) * factorial(n - r)));
  }, 'Represents the selection of objects from a group of objects where order of objects does not matter'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'round', { x: 'complex', dp: '?real_int' }, ({ x, dp }) => {
    x = x.toPrimitive('complex');
    if (dp === undefined) return new NumberValue(rs, Complex.round(x));
    return new NumberValue(rs, Complex.roundDp(x, dp.toPrimitive('real')));
  }, 'round x to the nearest integer, or to <dp> decimal places')); // round
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'Re', { z: 'complex' }, ({ z }) => new NumberValue(rs, z.toPrimitive('complex').a), 'return real component of z'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'Im', { z: 'complex' }, ({ z }) => new NumberValue(rs, z.toPrimitive('complex').b), 'return imaginary component of z'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'sin', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.sin(z.toPrimitive('complex'))), 'return sine of z')); // sine
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'sinh', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.sinh(z.toPrimitive('complex'))), 'return hyperbolic sine of z')); // hyperbolic sine
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'sqrt', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.sqrt(z.toPrimitive('complex'))), 'return square root of z')); // cube root
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'tan', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.tan(z.toPrimitive('complex'))), 'return tangent of z')); // tangent
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'tanh', { z: 'complex' }, ({ z }) => new NumberValue(rs, Complex.tanh(z.toPrimitive('complex'))), 'return hyperbolic tangent of z')); // hyperbolic tangent
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'lambertw', { z: 'complex', k: '?real', tol: '?real' }, ({ z, k, tol }) => new NumberValue(rs, lambertw(z.toPrimitive('complex'), k?.toPrimitive('real'), tol?.toPrimitive('real'))), 'return approximation of the Lambert W function at <k> branch with <tol> tolerance'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'wrightomega', { z: 'complex' }, ({ z }) => new NumberValue(rs, wrightomega(z.toPrimitive('complex'))), 'return approximation of the Wright Omega function'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'gamma', { z: 'complex' }, ({ z }) => new NumberValue(rs, gamma(z.toPrimitive('complex'))), 'Return the gamma function at z'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'zeta', { x: 'real', q: '?real' }, ({ x, q }) => new NumberValue(rs, zeta(x.toPrimitive('real'), q?.toPrimitive('real'))), 'return approximation of the Zeta function of <x>'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'bernoulli', { n: 'real' }, ({ n }) => new NumberValue(rs, bernoulli(n.toPrimitive('real'))), 'return the nth Bernoulli number'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'stirling', { z: 'complex' }, ({ z }) => new NumberValue(rs, stirling(z.toPrimitive('complex'))), 'Return Stirling\'s Approximation at z'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'nextNearest', { n: 'real', next: 'real' }, ({ n, next }) => new NumberValue(rs, nextNearest(n.toPrimitive('real'), next.toPrimitive('real'))), 'Return the next representable double from value <n> towards <next>'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'sleep', { ms: 'real_int' }, ({ ms }) => new Promise((resolve) => setTimeout(() => resolve(ms), ms.toPrimitive('real_int'))), 'Suspend execution for <ms> milliseconds (1000ms = 1s)'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'pause', {}, () => new Promise((resolve) => setImmediate(() => resolve(rs.UNDEFINED))), 'Suspend execution until next event loop cycle'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'ref', { a: 'any', b: 'any' }, ({ a, b }) => {
    if (!(a instanceof VariableToken)) throw new Error(`[${errors.BAD_ARG}] Argument Error: a: expected symbol, got ${a.type()}`);
    if (!(b instanceof VariableToken)) throw new Error(`[${errors.BAD_ARG}] Argument Error: b: expected symbol, got ${b.type()}`);
    a.getVar().refFor = b.getVar();
    return a;
  }, 'Place a reference to variable b in variable a (i.e. changing a = changing b)'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'unref', { a: 'any' }, ({ a }) => {
    if (!(a instanceof VariableToken)) throw new Error(`[${errors.BAD_ARG}] Argument Error: a: expected symbol, got ${a.type()}`);
    a.getVar().refFor = undefined;
    return a;
  }, 'Remove reference from <a> (<a> is no longer acting as a reference)'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'getref', { name: 'string' }, ({ name }) => {
    if (name instanceof VariableToken) {
      let ref = name.getVar().refFor;
      return ref ? new StringValue(rs, ref.name) : rs.UNDEFINED;
    } else {
      throw new Error(`[${errors.BAD_ARG}] Argument Error: type ${name.type()} is not a valid reference type (expected symbol)`);
    }
  }, 'Return symbol that <name> is a reference to (or undef)'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'strformat', { str: 'string', values: { ellipse: 1 } }, ({ str, values }) => str.castTo('string').format(values.toPrimitive('array')), 'Return formatted string'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'nformat', { n: 'complex', region: '?string' }, ({ n, region }) => new StringValue(rs, n.toPrimitive('complex').toLocaleString(region ? region.toPrimitive('string') : 'en-GB')), 'Return formatted number string'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'expform', { z: 'complex', fdigits: '?real_int' }, ({ z, fdigits }) => new StringValue(rs, z.toPrimitive('complex').toExponential(fdigits ? fdigits.toPrimitive('real_int') : undefined)), 'Return complex number in exponential form, with <fdigits> fractional digits'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'tofrac', { num: 'real', improper: '?bool' }, ({ num, improper }) => new StringValue(rs, new Fraction(num.toPrimitive("real")).toString(improper ? improper.toPrimitive('bool') : true)), 'Convert a real number to a fraction (string)'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'fromfrac', { frac: 'string' }, ({ frac }) => new NumberValue(rs, new Fraction(frac.toPrimitive("string")).toNumber()), 'Convert fraction string to a number'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'quadratic', { a: 'complex', b: 'complex', c: 'complex' }, ({ a, b, c }) => {
    a = a.toPrimitive("complex");
    b = b.toPrimitive("complex");
    c = c.toPrimitive("complex");
    let sqrt = Complex.sqrt(Complex.pow(b, 2).sub(Complex.mult(4, a).mult(c)));
    let mb = Complex.mult(b, -1), ta = Complex.mult(a, 2);
    return new ArrayValue(rs, [new NumberValue(rs, Complex.add(mb, sqrt).div(ta)), new NumberValue(rs, Complex.sub(mb, sqrt).div(ta))]);
  }, 'Solve quadratic in form ax^2 + bx + c'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'zroots', { n: 'real_int', r: 'complex' }, ({ n, r }) => {
    n = n.toPrimitive("real_int");
    r = r.toPrimitive("complex");
    const angles = [];
    const ztwopi = Complex.mult(2, Math.PI);
    const getAngle = k => Complex.add(Math.PI, Complex.mult(ztwopi, k)).div(n); // Get angle of rotation using constant k
    let k = 1, neg = 0;
    angles.push(getAngle(0));
    while (true) {
      let angle = getAngle(neg ? -k : k);
      let already = angles.some(a => a === angle);
      if (!already) angles.push(angle);
      if (angles.length > n) break;
      if (neg === 1) k++;
      neg ^= 1;
    }
    const newR = Math.pow(r, Complex.div(1, n)), imag = new Complex(0, 1);
    const solutions = angles.map(angle => Complex.add(Complex.cos(angle).mult(newR), Complex.sin(angle).mult(newR).mult(imag))); // Transform from angle to full complex number (r*e**(i*theta) to a+bi)
    return new ArrayValue(rs, solutions.map(n => new NumberValue(rs, n)));
  }, 'Returns array of roots for z**n = r'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'pascal', { r: 'real_int' }, ({ r }) => {
    r = parseInt(r.toPrimitive('real'));
    let row = Array.from({ length: r - 1 }).map((_, i, a) => factorialReal(a.length) / (factorialReal(i) * factorialReal(a.length - i))).map(n => isFinite(n) ? n : 1).concat([1]);
    return new ArrayValue(rs, row.map(n => new NumberValue(rs, Math.round(n))));
  }, 'Return array of Pascal coefficients for <r>th for of Pascal\'s Triangle'));
}

module.exports = { define, defineVars, defineFuncs };