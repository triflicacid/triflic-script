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
    toString() { return this.eval('string'); }
}

class NumberValue extends Value {
    constructor(runspace, num) {
        super(runspace, Complex.assert(num));
    }

    type() { return this.value.isReal() ? "real" : "complex"; }

    eval(type) {
        if (type === 'any' || type === 'complex') return this.value;
        if (type === 'complex_int') return Complex.floor(this.value);
        if (type === 'real') return this.value.a;
        if (type === 'real_int') return Math.floor(this.value.a);
        if (type === 'string') return this.value.toString();
        if (type === 'bool') {
            if (this.value.b === 0) return !!this.value.a;
            if (this.value.a === 0) return !!this.value.b;
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
    if (type === 'any' || type === 'string') return this.value;
    if (type === 'bool') return bool(this.value);
    if (isNumericType(type)) {
      let n = +this.value;
      if (isIntType(type)) n = Math.floor(n);
      return Complex.assert(n);
    }
    if (type === 'array') return this.value.split('');
    castingError(this, type);
  }
}

class BoolValue extends Value {
  constructor(runspace, boolean) {
    super(runspace, bool(boolean));
  }

  type() { return "bool"; }

  eval(type) {
    if (type === "any" || type === "bool") return this.value;
    if (isNumericType(type)) return Complex.assert(+this.value);
    if (type === 'string') return this.value.toString();
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
    if (type === 'any' || type === 'array') return this.value;
    if (type === 'string') return "[" + this.value.map(t => t.eval("string")).join(',') + "]";
    if (isNumericType(type)) return Complex.NaN();
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
    if (type === 'any' || type === 'string') return this.toString();
    if (type === 'func') return this.value;
    castingError(this, type);
  }

  toString() {
    return `<function ${this.value}>`;
  }
}


/** Convert primitive JS value to Value class */
function primitiveToValueClass(runspace, primitive) {
  if (primitive instanceof Value) return primitive;
  if (typeof primitive === 'boolean') return new BoolValue(runspace, primitive);
  const c = Complex.is(primitive);
  if (c !== false) return new NumberValue(runspace, c);
  if (Array.isArray(primitive)) return new ArrayValue(runspace, primitive.map(p => primitiveToValueClass(runspace, p)));
  if (runspace.func(primitive) !== undefined) return new FunctionRefValue(runspace, primitive);
  return new StringValue(undefined, primitive);
}

module.exports = { Value, NumberValue, StringValue, BoolValue, ArrayValue, FunctionRefValue, primitiveToValueClass };