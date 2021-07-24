const Complex = require("../maths/Complex");
const { factorial, factorialReal } = require("../maths/functions");
const { str, bool, removeDuplicates, arrDifference, intersect, arrRepeat, findIndex, equal } = require("../utils");
const { castingError, isNumericType, isIntType } = require("./types");

class Value {
  constructor(runspace, value) {
    this.rs = runspace;
    this.value = value;
  }

  type() { throw new Error(`Requires Overload`); }

  eval(type) {
    if (type === 'any') return this;
    const mapObj = this.constructor.castMap;
    let value = mapObj && type in mapObj ? mapObj[type](this) : undefined;
    if (value == undefined) castingError(this, type);
    return value;
  }

  toPrimitive(type) {
    const v = this.eval(type).value;
    if (type.startsWith('real')) return v.a; // Raw number only
    return v;
  }
  toString() { return this.toPrimitive('string'); }

  /** operator: u+ */
  __pos__() { return this.eval('complex'); }

  /** operator: u- */
  __neg__() { return new NumberValue(this.rs, this.toPrimitive('complex').mult(-1)); }

  /** operator: ' */
  __not__() { return new BoolValue(this.rs, !this.toPrimitive('bool')); }

  /** operator: in */
  __in__(arg) {
    const argt = arg.type();
    if (argt === 'array' || argt === 'set') return new BoolValue(this.rs, findIndex(this, arg.toPrimitive('array')) !== -1);
    if (argt === 'string') return new BoolValue(this.rs, arg.toString().indexOf(this.toString()) !== -1);
  }

  /** operator: != */
  __neq__(a) { return new BoolValue(this.rs, !this.__eq__(a).toPrimitive('bool')); }

  /** operator: && */
  __and__(a) { return this.toPrimitive('bool') && a.toPrimitive('bool') ? a : new BoolValue(this.rs, false); }

  /** operator: || */
  __or__(arg) {
    if (this.toPrimitive('bool')) return this;
    if (arg.toPrimitive('bool')) return arg;
    return new BoolValue(this.rs, false);
  }
}

class NumberValue extends Value {
  constructor(runspace, num = 0) {
    super(runspace, Complex.assert(num));
  }

  type() { return this.value.isReal() ? "real" : "complex"; }

  /** abs() function */
  __abs__() { return Complex.abs(this.value); }

  /** copy() function - <#Complex> has a copy method available */
  __copy__() { return new NumberValue(this.rs, this.value.copy()); }

  /** operator: deg */
  __deg__() { return new NumberValue(this.rs, Complex.mult(this.value, Math.PI / 180)); }

  /** operator: == */
  __eq__(a) { return new BoolValue(this.rs, isNumericType(a.type()) ? this.value.equals(a.toPrimitive('complex')) : false); }

  /** operator: ~ */
  __bitwiseNot__() {
    if (this.type() === 'real') return new NumberValue(this.rs, ~this.value.a);
  }

  /** operator: & */
  __bitwiseAnd__(arg) {
    const argt = arg.type();
    if (this.type() === 'real' && (argt === 'real' || argt === 'bool')) return new NumberValue(this.rs, this.toPrimitive('real') & arg.toPrimitive('real'));
  }

  /** operator: | */
  __bitwiseOr__(arg) {
    const argt = arg.type();
    if (this.type() === 'real' && (argt === 'real' || argt === 'bool')) return new NumberValue(this.rs, this.toPrimitive('real') | arg.toPrimitive('real'));
  }

  /** operator: ^ */
  __xor__(arg) {
    const argt = arg.type();
    if (this.type() === 'real' && (argt === 'real' || argt === 'bool')) return new NumberValue(this.rs, this.toPrimitive('real') ^ arg.toPrimitive('real'));
  }

  /** operator: ** */
  __pow__(n) {
    if (isNumericType(n.type())) return new NumberValue(this.rs, Complex.pow(this.toPrimitive('complex'), n.toPrimitive('complex')));
  }

  /** operator: // */
  __intDiv__(n) {
    if (isNumericType(n.type())) return new NumberValue(this.rs, Complex.floor(Complex.div(this.toPrimitive('complex'), n.toPrimitive('complex'))));
  }

  /** operator: / */
  __div__(n) {
    if (isNumericType(n.type())) return new NumberValue(this.rs, Complex.div(this.toPrimitive('complex'), n.toPrimitive('complex')));
  }

  /** operator: % */
  __mod__(n) {
    if (isNumericType(n.type())) return new NumberValue(this.rs, Complex.modulo(this.toPrimitive('complex'), n.toPrimitive('complex')));
  }

  /** operator: * */
  __mul__(n) {
    const t = n.type();
    if (t === 'string' || isNumericType(t)) return new NumberValue(this.rs, Complex.mult(this.toPrimitive('complex'), n.toPrimitive('complex')));
  }

  /** operator: + */
  __add__(n) {
    const t = n.type();
    if (t === 'string' || isNumericType(t)) return new NumberValue(this.rs, Complex.add(this.toPrimitive('complex'), n.toPrimitive('complex')));
  }

  /** operator: - */
  __sub__(n) {
    const t = n.type();
    if (t === 'string' || isNumericType(t)) return new NumberValue(this.rs, Complex.sub(this.toPrimitive('complex'), n.toPrimitive('complex')));
  }

  /** operator: << */
  __lshift__(n) {
    const t = n.type();
    if (this.type() === 'real' && t === 'real') return new NumberValue(this.rs, this.toPrimitive('real') << n.toPrimitive('real'));
  }

  /** operator: >> */
  __rshift__(n) {
    const t = n.type();
    if (this.type() === 'real' && t === 'real') return new NumberValue(this.rs, this.toPrimitive('real') >> n.toPrimitive('real'));
  }

  /** operator: <= */
  __le__(n) {
    if (this.type() === 'real' && n.type() === 'real') return new BoolValue(this.rs, this.toPrimitive('real') <= n.toPrimitive('real'));
  }

  /** operator: < */
  __lt__(n) {
    if (this.type() === 'real' && n.type() === 'real') return new BoolValue(this.rs, this.toPrimitive('real') < n.toPrimitive('real'));
  }

  /** operator: >= */
  __ge__(n) {
    if (this.type() === 'real' && n.type() === 'real') return new BoolValue(this.rs, this.toPrimitive('real') >= n.toPrimitive('real'));
  }

  /** operator: > */
  __gt__(n) {
    if (this.type() === 'real' && n.type() === 'real') return new BoolValue(this.rs, this.toPrimitive('real') > n.toPrimitive('real'));
  }

  /** operator: ! */
  __excl__() {
    const t = this.type();
    if (this.rs.opts.gammaFactorial) {
      if (isNumericType(t)) return new NumberValue(this.rs, factorial(this.toPrimitive('complex')));
    } else {
      if (t === 'real') return new NumberValue(this.rs, factorialReal(this.toPrimitive('real')));
    }
  }
}

class StringValue extends Value {
  constructor(runspace, string = '') {
    super(runspace, str(string));
  }

  type() { return "string"; }

  /** len() function */
  __len__() { return this.value.length; }

  /** get() function */
  __get__(i) {
    i = i.toPrimitive('real_int');
    if (i < 0 || i >= this.value.length) throw new Error(`Index Error: index ${i} is out of range`);
    return new StringValue(this.rs, this.value[i]);
  }

  /** set() function */
  __set__(i, value) {
    i = i.toPrimitive('real_int');
    if (i < 0 || i >= this.value.length) throw new Error(`Index Error: index ${i} is out of range`);
    value = value.toPrimitive('string');
    this.value = this.value.substring(0, i) + value + this.value.substr(i + value.length);
    return this;
  }

  /** del() function */
  __del__(key) {
    let i = key.toPrimitive('real_int');
    if (isNaN(i) || i < 0 || i >= this.value.length) throw new Error(`Index Error: index ${i} is out of range`);
    const chr = this.value[i];
    this.value = this.value.substring(0, i) + this.value.substr(i + 1);
    return new StringValue(this.rs, chr);
  }

  /** copy() function */
  __copy__() { return new StringValue(this.rs, this.value); }

  /** operator: == */
  __eq__(a) { return new BoolValue(this.rs, a.type() === 'string' ? this.toString() === a.toString() : false); }

  /** operator: * */
  __mul__(n) {
    const t = n.type();
    if (t === 'real') {
      n = n.toPrimitive('real_int');
      return new StringValue(this.rs, n < 0 ? '' : this.toString().repeat(n));
    }
  }

  /** operator: + */
  __add__(n) { return new StringValue(this.rs, this.toPrimitive('string') + n.toPrimitive('string')); }
}

class BoolValue extends Value {
  constructor(runspace, boolean = false) {
    super(runspace, !!boolean);
  }

  type() { return "bool"; }

  /** copy() function */
  __copy__() { return new BoolValue(this.rs, this.value); }

  /** operator: == */
  __eq__(a) { return new BoolValue(this.rs, isNumericType(a.type()) ? this.value === a.toPrimitive('bool') : false); }

  /** operator: ~ */
  __bitwiseNot__() { return new NumberValue(this.rs, ~this.value); }

  /** operator: & */
  __bitwiseAnd__(arg) {
    const argt = arg.type();
    if (argt === 'real' || argt === 'bool') return new NumberValue(this.rs, this.toPrimitive('real') & arg.toPrimitive('real'));
  }

  /** operator: | */
  __bitwiseOr__(arg) {
    const argt = arg.type();
    if (argt === 'real' || argt === 'bool') return new NumberValue(this.rs, this.toPrimitive('real') | arg.toPrimitive('real'));
  }

  /** operator: ^ */
  __xor__(arg) {
    const argt = arg.type();
    if (argt === 'real' || argt === 'bool') return new NumberValue(this.rs, this.toPrimitive('real') ^ arg.toPrimitive('real'));
  }

  /** operator: + */
  __add__(n) {
    if (isNumericType(n.type())) return new NumberValue(this.rs, Complex.add(this.toPrimitive('real'), n.toPrimitive('complex')));
  }
}

class ArrayValue extends Value {
  constructor(runspace, items = []) {
    super(runspace, items);
  }

  type() { return "array"; }

  /** len() function */
  __len__() { return this.value.length; }

  /** abs() function */
  __abs__() { return this.value.length; }

  /** get() function */
  __get__(i) {
    i = i.toPrimitive('real_int');
    if (isNaN(i) || i < 0 || i >= this.value.length) throw new Error(`Index Error: index ${i} is out of range`);
    return this.value[i];
  }

  /** set() function */
  __set__(i, value) {
    i = i.toPrimitive('real_int');
    if (isNaN(i) || i < 0 || i >= this.value.length) throw new Error(`Index Error: index ${i} is out of range`);
    this.value[i] = value;
    return this;
  }

  /** del() function */
  __del__(key) {
    let i = key.toPrimitive('real_int');
    if (isNaN(i) || i < 0 || i >= this.value.length) throw new Error(`Index Error: index ${i} is out of range`);
    this.value.splice(i, 1);
    return new NumberValue(this.rs, i);
  }

  /** copy() function */
  __copy__() {
    const emsg = (v, i) => `Error whilst copying type array: index ${i}: type ${v.type()} cannot be copied`;
    return new ArrayValue(this.rs, this.value.map((v, i) => {
      let copy;
      try { copy = v.__copy__?.(); } catch (e) { throw new Error(`${emsg(v, i)}\n${e}`); }
      if (copy === undefined) throw new Error(emsg(v, i));
      return copy;
    }));
  }

  /** operator: == */
  __eq__(a) { return new BoolValue(this.rs, a.type() === 'array' && this.value.length === a.value.length ? this.value.map((_, i) => equal(this.value[i], a.value[i])).every(x => x) : false); }

  /** operator: * */
  __mul__(n) {
    const t = n.type();
    if (t === 'array') return new ArrayValue(this.rs, intersect(this.toPrimitive('array'), n.toPrimitive('array')));
    if (t === 'real') return new ArrayValue(this.rs, arrRepeat(this.toPrimitive('array'), n.toPrimitive('real_int')));
  }

  /** operator: ∩ */
  __intersect__(n) {
    const t = n.type();
    if (t === 'array') return new ArrayValue(this.rs, intersect(this.toPrimitive('array'), n.toPrimitive('array')));
  }

  /** operator: ∪ */
  __union__(n) {
    const t = n.type();
    if (t === 'array') return new ArrayValue(this.rs, this.toPrimitive('array').concat(n.toPrimitive('array')));
  }

  /** operator: + */
  __add__(n) {
    const t = n.type();
    if (t === 'array') return new ArrayValue(this.rs, this.toPrimitive('array').concat(n.toPrimitive('array')));
    return new ArrayValue(this.rs, [...this.toPrimitive('array'), n]);
  }

  /** operator: - */
  __sub__(n) {
    const t = n.type();
    if (t === 'array') return new ArrayValue(this.rs, arrDifference(this.toPrimitive('array'), n.toPrimitive('array')));
  }
}

class SetValue extends Value {
  constructor(runspace, items = []) {
    super(runspace, items);
    this.check();
  }

  /** Remove duplicate values */
  check() {
    this.value = removeDuplicates(this.value);
  }

  type() { return "set"; }

  /** len() function */
  __len__() { return this.value.length; }

  /** abs() function */
  __abs__() { return this.value.length; }

  /** copy() function */
  __copy__() {
    const emsg = (v, i) => `Error whilst copying type set: index ${i}: type ${v.type()} cannot be copied`;
    return new SetValue(this.rs, this.value.map((v, i) => {
      let copy;
      try { copy = v.__copy__?.(); } catch (e) { throw new Error(`${emsg(v, i)}\n${e}`); }
      if (copy === undefined) throw new Error(emsg(v, i));
      return copy;
    }));
  }

  /** Run and return fn() */
  run(fn) {
    let tmp = fn(this);
    this.check();
    return tmp;
  }

  /** operator: == */
  __eq__(a) { return new BoolValue(this.rs, a.type() === 'set' && this.value.length === a.value.length ? this.value.map((_, i) => equal(this.value[i], a.value[i])).every(x => x) : false); }

  /** operator: ' */
  __not__() {
    const us = this.rs.var('universal_set')?.eval('any');
    if (us == undefined) return new Error(`Type Error: variable universal_set is missing.`);
    if (us.type() !== 'set') return new Error(`Type Error: variable universal_set is not of type set (got ${us.type()})`);
    return new SetValue(this.rs, arrDifference(us.toPrimitive('array'), this.toPrimitive('array')));
  }

  /** operator: * */
  __mul__(n) {
    const t = n.type();
    if (t === 'set') return new SetValue(this.rs, intersect(this.toPrimitive('array'), n.toPrimitive('array')));
  }

  /** operator: ∩ */
  __intersect__(n) {
    const t = n.type();
    if (t === 'set') return new SetValue(this.rs, intersect(this.toPrimitive('array'), n.toPrimitive('array')));
  }

  /** operator: ∪ */
  __union__(n) {
    const t = n.type();
    if (t === 'set') return new SetValue(this.rs, this.toPrimitive('array').concat(n.toPrimitive('array')));
  }

  /** operator: + */
  __add__(n) {
    const t = n.type();
    if (t === 'set') return new SetValue(this.rs, this.toPrimitive('array').concat(n.toPrimitive('array')));
    return new SetValue(this.rs, [...this.toPrimitive('array'), n]);
  }

  /** operator: - */
  __sub__(n) {
    const t = n.type();
    if (t === 'set') return new SetValue(this.rs, arrDifference(this.toPrimitive('array'), n.toPrimitive('array')));
  }
}

class MapValue extends Value {
  constructor(runspace) {
    super(runspace, null);
    this.value = new Map();
  }

  type() { return "map"; }

  /** len() function */
  __len__() { return this.value.size; }

  /** abs() function */
  __abs__() { return this.value.size; }

  /** get() function */
  __get__(key) {
    key = key.toString();
    if (!this.value.has(key)) throw new Error(`Key Error: key "${key}" does not exist in map`);
    return this.value.get(key);
  }

  /** set() function */
  __set__(key, value) {
    key = key.toString();
    this.value.set(key, value);
    return this;
  }

  /** del() function */
  __del__(key) {
    key = key.toString();
    if (!this.value.has(key)) throw new Error(`Key Error: key "${key}" does not exist in map`);
    const val = this.value.get(key);
    this.value.delete(key);
    return val;
  }

  /** copy() function */
  __copy__() {
    const emsg = (v, key) => `Error whilst copying type map: key ${key}: type ${v.type()} cannot be copied`;
    const map = new MapValue(this.rs);
    this.value.forEach((v, key) => {
      let copy;
      try { copy = v.__copy__?.(); } catch (e) { throw new Error(`${emsg(v, key)}\n${e}`); }
      if (copy === undefined) throw new Error(emsg(v, key));
      map.value.set(key, copy);
    });
    return map;
  }

  /** operator: == */
  __eq__(a) {
    let bool = false;
    if (a.type() === 'map') {
      let ethis = Array.from(this.value.entries()), ea = Array.from(a.value.entries());
      bool = (ethis.length === ea.length) ?
        ethis.map(key => equal(this.value.get(key[0]), a.value.get(key[0]))).every(x => x)
        : false;
    }
    return new BoolValue(this.rs, bool);
  }
}

/** Reference to function without calling. this.value = function name */
class FunctionRefValue extends Value {
  constructor(runspace, fname) {
    super(runspace, fname);
  }

  type() { return "func"; }

  exists() {
    return this.rs.func(this.value) !== undefined;
  }

  getFn() {
    return this.rs.func(this.value);
  }

  toString() {
    return `<function ${this.value}>`;
  }

  /** del() function */
  __del__() {
    const f = this.getFn();
    if (f.constant) throw new Error(`Argument Error: Attempt to delete constant reference to ${this.toString()}`);
    this.rs.func(this.value, null);
    return new NumberValue(this.rs, 0);
  }

  /** copy() function */
  __copy__() { return new FunctionRefValue(this.rs, this.value); }

  /** operator: == */
  __eq__(a) { return new BoolValue(this.rs, a.type() === 'func' ? this.value === a.value : false); }
}


/** Convert primitive JS value to Value class */
function primitiveToValueClass(runspace, primitive) {
  if (primitive instanceof Value) return primitive;
  if (typeof primitive === 'boolean') return new BoolValue(runspace, primitive);
  const c = Complex.is(primitive);
  if (c !== false) return new NumberValue(runspace, c);
  if (primitive instanceof Set) return new SetValue(runspace, Array.from(primitive).map(p => primitiveToValueClass(runspace, p)));
  if (primitive instanceof Map) {
    let map = new MapValue(rs);
    primitive.forEach((v, k) => {
      map.value.set(k, primitiveToValueClass(runspace, v));
    });
    return map;
  }
  if (Array.isArray(primitive)) return new ArrayValue(runspace, primitive.map(p => primitiveToValueClass(runspace, p)));
  if (runspace.func(primitive) !== undefined) return new FunctionRefValue(runspace, primitive);
  return new StringValue(undefined, primitive);
}

/** This is used for Value.__new__ */
Value.typeMap = {
  complex: NumberValue,
  complex_int: NumberValue,
  real: NumberValue,
  real_int: NumberValue,
  string: StringValue,
  bool: BoolValue,
  array: ArrayValue,
  set: SetValue,
  map: MapValue,
};

Value.__new__ = (rs, t) => {
  if (t in Value.typeMap) return new Value.typeMap[t](rs);
  return undefined;
};

/** Setup casting maps */
NumberValue.castMap = {
  complex: o => o,
  complex_int: o => new NumberValue(o.rs, Complex.floor(o.value)),
  real: o => new NumberValue(o.rs, Complex.floor(o.value)),
  real_int: o => new NumberValue(o.rs, Math.floor(o.value.a)),
  string: o => new StringValue(o.rs, str(o.value)),
  bool: o => {
    if (o.value.b === 0) return new BoolValue(o.rs, !!o.value.a);
    if (o.value.a === 0) return new BoolValue(o.rs, !!o.value.b);
    return new BoolValue(o.rs, true);
  },
};

StringValue.castMap = {
  string: o => o,
  bool: o => new BoolValue(o.rs, !!o.value),
  complex: o => new NumberValue(o.rs, +o.value),
  complex_int: o => new NumberValue(o.rs, Math.floor(+o.value)),
  real: o => new NumberValue(o.rs, +o.value),
  real_int: o => new NumberValue(o.rs, Math.floor(+o.value)),
  array: o => new ArrayValue(o.rs, o.value.split('').map(s => new StringValue(o.rs, s))),
  set: o => new SetValue(o.rs, o.value.split('').map(s => new StringValue(o.rs, s))),
};

BoolValue.castMap = {
  bool: o => o,
  complex: o => new NumberValue(o.rs, +o.value),
  complex_int: o => new NumberValue(o.rs, +o.value),
  real: o => new NumberValue(o.rs, +o.value),
  real_int: o => new NumberValue(o.rs, +o.value),
  string: o => new StringValue(o.rs, o.value.toString()),
};

ArrayValue.castMap = {
  array: o => o,
  set: o => new SetValue(o.rs, o.value),
  string: o => new StringValue(o.rs, "[" + o.value.map(t => t.toString()).join(',') + "]"),
  bool: o => new BoolValue(o.rs, !!this.value),
  map: o => {
    const map = new MapValue(o.rs);
    o.value.forEach((v, i) => map.value.set(i, v));
    return map;
  },
};

SetValue.castMap = {
  set: o => o,
  array: o => new ArrayValue(o.rs, o.value),
  string: o => new StringValue(o.rs, "{" + o.value.map(t => t.toString()).join(',') + "}"),
  bool: o => new BoolValue(o.rs, !!this.value),
};

MapValue.castMap = {
  map: o => o,
  string: o => new StringValue(o.rs, "{" + Array.from(o.value.entries()).map(pair => pair.join(':')).join(',') + "}"),
  bool: o => new BoolValue(o.rs, !!o.value),
};

FunctionRefValue.castMap = {
  func: o => o,
  string: o => new StringValue(o.rs, o.toString()),
};

module.exports = { Value, NumberValue, StringValue, BoolValue, ArrayValue, SetValue, MapValue, FunctionRefValue, primitiveToValueClass };