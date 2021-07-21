const Complex = require("../maths/Complex");
const { str, bool, removeDuplicates } = require("../utils");
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

    __abs__() { return Complex.abs(this.value); }
}

class StringValue extends Value {
  constructor(runspace, string) {
    super(runspace, str(string));
  }

  type() { return "string"; }

  __len__() { return this.value.length; }
  __get__(i) {
    i = i.toPrimitive('real_int');
    if (i < 0 || i >= this.value.length) throw new Error(`Index Error: index ${i} is out of range`);
    return new StringValue(this.rs, this.value[i]);
  }
  __set__(i, value) {
    i = i.toPrimitive('real_int');
    if (i < 0 || i >= this.value.length) throw new Error(`Index Error: index ${i} is out of range`);
    value = value.toPrimitive('string');
    this.value = this.value.substring(0, i) + value + this.value.substr(i + value.length);
    return this;
  }
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
}

class ArrayValue extends Value {
  constructor(runspace, items) {
    super(runspace, items);
  }

  type() { return "array"; }
  
  __len__() { return this.value.length; }
  __abs__() { return this.value.length; }
  __get__(i) {
    i = i.toPrimitive('real_int');
    if (isNaN(i) || i < 0 || i >= this.value.length) throw new Error(`Index Error: index ${i} is out of range`);
    return this.value[i];
  }
  __set__(i, value) {
    i = i.toPrimitive('real_int');
    if (isNaN(i) || i < 0 || i >= this.value.length) throw new Error(`Index Error: index ${i} is out of range`);
    this.value[i] = value;
    return this;
  }
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
  
  __len__() { return this.value.length; }
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
}

class MapValue extends Value {
  constructor(runspace) {
    super(runspace, null);
    this.value = new Map();
  }

  type() { return "map"; }
  
  __len__() { return this.value.size; }
  __abs__() { return this.value.size; }
  __get__(key) {
    key = key.toString(); 
    if (!this.value.has(key)) throw new Error(`Key Error: key "${key}" does not exist in map`);
    return this.value.get(key);
  }
  __set__(key, value) {
    key = key.toString();
    this.value.set(key, value);
    return this;
  }
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