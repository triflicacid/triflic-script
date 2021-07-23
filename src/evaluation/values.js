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

  eval() { throw new Error(`Requires Overload`); }

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

  /** operator: == */
  __eq__(a) { return new BoolValue(this.rs, equal(this, a)); }

  /** operator: != */
  __neq__(a) { return !this.__eq__(a); }

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
  constructor(runspace, num) {
    super(runspace, Complex.assert(num));
  }

  type() { return this.value.isReal() ? "real" : "complex"; }

  eval(type) {
    if (type === 'any' || type === 'complex') return this;
    if (type === 'complex_int') return new NumberValue(this.rs, Complex.floor(this.value));
    if (type === 'real') return new NumberValue(this.rs, this.value.a);
    if (type === 'real_int') return new NumberValue(this.rs, Math.floor(this.value.a));
    if (type === 'string') return new StringValue(this.rs, str(this.value));
    if (type === 'bool') {
      if (this.value.b === 0) return new BoolValue(this.rs, !!this.value.a);
      if (this.value.a === 0) return new BoolValue(this.rs, !!this.value.b);
      return true;
    }
    castingError(this, type);
  }

  /** abs() function */
  __abs__() { return Complex.abs(this.value); }

  /** operator: deg */
  __deg__() { return new NumberValue(this.rs, Complex.mult(this.value, Math.PI / 180)); }

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
  constructor(runspace, string) {
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

  eval(type) {
    if (type === 'any' || type === 'string') return this;
    if (type === 'bool') return new BoolValue(this.rs, !!this.value);
    if (isNumericType(type)) {
      let n = +this.value;
      if (isIntType(type)) n = Math.floor(n);
      return new NumberValue(this.rs, n);
    }
    if (type === 'array') return new ArrayValue(this.rs, this.value.split(''));
    if (type === 'set') return new SetValue(this.rs, this.value.split(''));
    castingError(this, type);
  }

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
  constructor(runspace, boolean) {
    super(runspace, bool(boolean));
  }

  type() { return "bool"; }

  eval(type) {
    if (type === "any" || type === "bool") return this;
    if (isNumericType(type)) return new NumberValue(this.rs, +this.value);
    if (type === 'string') return new StringValue(this.rs, str(this.value));
    castingError(this, type);
  }

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
  constructor(runspace, items) {
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

  eval(type) {
    if (type === 'any' || type === 'array') return this;
    if (type === 'set') return new SetValue(this.rs, this.value);
    if (type === 'string') return new StringValue(this.rs, "[" + this.value.map(t => t.toString()).join(',') + "]");
    if (type === 'bool') return new BoolValue(this.rs, !!this.value);
    if (type === 'map') {
      const map = new MapValue(this.rs);
      this.value.forEach((v, i) => map.value.set(i, v));
      return map;
    }
    if (isNumericType(type)) return new NumberValue(this.rs, Complex.NaN());
    castingError(this, type);
  }

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
  constructor(runspace, items) {
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

  eval(type) {
    if (type === 'any' || type === 'set') return this;
    if (type === 'array') return new ArrayValue(this.rs, this.value);
    if (type === 'string') return new StringValue(this.rs, "{" + this.value.map(t => t.toString()).join(',') + "}");
    if (type === 'bool') return new BoolValue(this.rs, !!this.value);
    castingError(this, type);
  }

  /** Run and return fn() */
  run(fn) {
    let tmp = fn(this);
    this.check();
    return tmp;
  }

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

  eval(type) {
    if (type === 'any' || type === 'map') return this;
    if (type === 'string') return new StringValue(this.rs, "{" + Array.from(this.value.entries()).map(pair => `${pair[0].toString()}:${pair[1].toString()}`).join(',') + "}");
    if (type === 'bool') return new BoolValue(this.rs, !!this.value);
    castingError(this, type);
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

  eval(type) {
    if (type === 'any' || type === 'func') return this;
    if (type === 'string') return new StringValue(this.rs, this.toString());
    castingError(this, type);
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

module.exports = { Value, NumberValue, StringValue, BoolValue, ArrayValue, SetValue, MapValue, FunctionRefValue, primitiveToValueClass };