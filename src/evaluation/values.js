const Complex = require("../maths/Complex");
const { str, bool } = require("../utils");
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
}

class StringValue extends Value {
  constructor(runspace, string) {
    super(runspace, str(string));
  }

  type() { return "string"; }

  len() { return this.value.length; }
  
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
  
  len() { return this.value.length; }
  
  eval(type) {
    if (type === 'any' || type === 'array') return this;
    if (type === 'set') return new SetValue(this.rs, this.value);
    if (type === 'string') return new StringValue(this.rs, "[" + this.value.map(t => t.toString()).join(',') + "]");
    if (type === 'bool') return new BoolValue(this.rs, !!this.value);
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
  
  len() { return this.value.length; }
  
  eval(type) {
    if (type === 'any' || type === 'set') return this;
    if (type === 'array') return new ArrayValue(this.rs, this.value);
    if (type === 'string') return new StringValue(this.rs, "{" + this.value.map(t => t.toString()).join(',') + "}");
    if (type === 'bool') return new BoolValue(this.rs, !!this.value);
    if (isNumericType(type)) return new NumberValue(this.rs, NaN);
    castingError(this, type);
  }

  /** Run and return fn() */
  run(fn) {
    let tmp = fn(this);
    this.check();
    return tmp;
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
}


/** Convert primitive JS value to Value class */
function primitiveToValueClass(runspace, primitive, sudo = false) {
  if (!sudo) {
    console.log(arguments);
    throw new Error(`FUNCTION IS DEPRECATED`);
  }

  if (primitive instanceof Value) return primitive;
  if (typeof primitive === 'boolean') return new BoolValue(runspace, primitive);
  const c = Complex.is(primitive);
  if (c !== false) return new NumberValue(runspace, c);
  if (primitive instanceof Set) return new SetValue(runspace, Array.from(primitive).map(p => primitiveToValueClass(runspace, p)));
  if (Array.isArray(primitive)) return new ArrayValue(runspace, primitive.map(p => primitiveToValueClass(runspace, p)));
  if (runspace.func(primitive) !== undefined) return new FunctionRefValue(runspace, primitive);
  return new StringValue(undefined, primitive);
}

function equal(a, b) {
  const basic = a === b;
  if (basic) return basic;

  const ta = a.type(), tb = b.type();
  if (isNumericType(ta) && isNumericType(tb)) return a.toPrimitive('complex').equals(b.toPrimitive('complex'));
  if (ta === 'string' && ta === 'string') return a.value === b.value;
  if (ta === 'array' && tb === 'array') {
    a = a.eval('array');
    b = b.eval('array');
    let lim = Math.max(a.value.length, b.value.length);
    for (let i = 0; i < lim; i++) if (!equal(a.value[i], b.value[i])) return false;
    return true;
  }
}

/** Remove duplicate values from array  */
function removeDuplicates(arr) {
  let set = [];
  for (let i = 0; i < arr.length; i++) {
    let found = false;
    for (let j = 0; j < set.length; j++) {
      if (equal(arr[i], set[j])) {
        found = true;
        break;
      }
    }
    if (!found) set.push(arr[i]);
  }
  return set;
}

module.exports = { Value, NumberValue, StringValue, BoolValue, ArrayValue, SetValue, FunctionRefValue, primitiveToValueClass, equal, removeDuplicates };