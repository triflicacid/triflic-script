const Complex = require("../maths/Complex");
const { range } = require("../maths/functions");
const { RunspaceFunction } = require("../runspace/Function");
const { str, removeDuplicates, arrDifference, intersect, arrRepeat, findIndex, equal, peek, toJson } = require("../utils");
const { castingError, isNumericType, isRealType } = require("./types");
const { errors, operatorDoesntSupport } = require("../errors");

class Value {
  constructor(runspace, value) {
    this.rs = runspace;
    this.value = value;
    this.onAssign = undefined; // If populated, __assign__ and others calls this
    this.getAssignVal = undefined; // If onAssign is defined, this is as well. Returns value that will be assigned to.
  }

  type() { throw new Error(`Requires Overload`); }

  castTo(type, evalObj) {
    if (type === 'any' || type === this.type()) return this;
    if (peek(type) === '*') throw new Error(`[${errors.CAST_ERROR}] Type Error: Cannot cast object ${this.type()} to ${type} (reference)`);
    const mapObj = this.constructor.castMap;
    let value = mapObj && type in mapObj ? mapObj[type](this) : undefined;
    if (value === undefined) castingError(this, type);
    return value;
  }

  toPrimitive(type, evalObj) {
    const v = this.castTo(type, evalObj).value;
    if (type.startsWith('real')) return v.a; // Raw number only
    return v;
  }
  toString(evalObj) { return this.toPrimitive('string', evalObj); }

  getAssignError() { return new Error(`[${errors.TYPE_ERROR}] Type Error: Cannot assign to object ${this.type()}`); }

  /** operator: = */
  async __assign__(evalObj, val) {
    if (this.onAssign === undefined) throw this.getAssignError();
    return this.onAssign(evalObj, await val.castTo('any', evalObj));
  }

  /** operator: += */
  async __assignAdd__(evalObj, val) {
    if (this.onAssign === undefined) throw this.getAssignError();
    const me = await this.getAssignVal();
    return me && me.__add__ ? this.onAssign(evalObj, await me.__add__(evalObj, await val.castTo('any', evalObj))) : undefined;
  }

  /** operator: -= */
  async __assignSub__(evalObj, val) {
    if (this.onAssign === undefined) throw this.getAssignError();
    const me = await this.getAssignVal();
    return me && me.__sub__ ? this.onAssign(evalObj, await me.__sub__(evalObj, await val.castTo('any', evalObj))) : undefined;
  }

  /** operator: *= */
  async __assignMul__(evalObj, val) {
    if (this.onAssign === undefined) throw this.getAssignError();
    const me = await this.getAssignVal();
    return me && me.__mul__ ? this.onAssign(evalObj, await me.__mul__(evalObj, await val.castTo('any', evalObj))) : undefined;
  }

  /** operator: /= */
  async __assignDiv__(evalObj, val) {
    if (this.onAssign === undefined) throw this.getAssignError();
    const me = await this.getAssignVal();
    return me && me.__div__ ? this.onAssign(evalObj, await me.__div__(evalObj, await val.castTo('any', evalObj))) : undefined;
  }

  /** operator: %= */
  async __assignMod__(evalObj, val) {
    if (this.onAssign === undefined) throw this.getAssignError();
    const me = await this.getAssignVal();
    return me && me.__mod__ ? this.onAssign(evalObj, await me.__mod__(evalObj, await val.castTo('any', evalObj))) : undefined;
  }

  /** operator: u+ */
  __pos__(evalObj) { return this.castTo('complex', evalObj); }

  /** operator: u- */
  __neg__(evalObj) { return new NumberValue(this.rs, Complex.mult(this.toPrimitive('complex', evalObj), -1)); }

  /** operator: ' */
  __not__(evalObj) { return new BoolValue(this.rs, !this.toPrimitive('bool', evalObj)); }

  /** operator: in */
  __in__(evalObj, collection) {
    const type = collection.type();
    if (type === 'array' || type === 'set') return new BoolValue(this.rs, findIndex(this, collection.toPrimitive('array', evalObj)) !== -1);
    if (type === 'string') return new BoolValue(this.rs, collection.toString().indexOf(this.toString(evalObj)) !== -1);
    if (type === 'map') return new BoolValue(this.rs, collection.value.has(this.toString(evalObj)));
    throw new Error(`[${errors.TYPE_ERROR}] Type Error: object ${type} is not a collection`);
  }

  /** operator: != */
  __neq__(evalObj, a) { return new BoolValue(this.rs, !this.__eq__(evalObj, a).toPrimitive('bool', evalObj)); }

  /** operator: && */
  __and__(evalObj, a) { return this.toPrimitive('bool', evalObj) && a.toPrimitive('bool', evalObj) ? a : new BoolValue(this.rs, false); }

  /** operator: || */
  __or__(evalObj, arg) {
    if (this.toPrimitive('bool', evalObj)) return this;
    if (arg.toPrimitive('bool', evalObj)) return arg;
    return new BoolValue(this.rs, false);
  }
}

class UndefinedValue extends Value {
  constructor(runspace) {
    super(runspace, undefined);
  }

  type() { return 'undef'; }

  /* operator: == */
  __eq__(evalObj, v) {
    return new BoolValue(this.rs, v instanceof UndefinedValue);
  }

  __copy__(evalObj) {
    return new UndefinedValue(this.rs);
  }

  /** Return JS string of JSON */
  __toJson__(evalObj) {
    return "null";
  }
}

class NumberValue extends Value {
  constructor(runspace, num = 0) {
    super(runspace, Complex.parse(num));
  }

  type() { return this.value.isReal() ? "real" : "complex"; }

  /** abs() function */
  __abs__(evalObj) { return new NumberValue(this.rs, Complex.abs(this.value)); }

  /** copy() function - <#Complex> has a copy method available */
  __copy__(evalObj) { return new NumberValue(this.rs, this.value.copy()); }

  /** reverse() function */
  __rev__(evalObj) {
    let real = this.value.a.toLocaleString('fullwide', { useGrouping: false }).split('').reverse().join('');
    let complex = this.value.b.toLocaleString('fullwide', { useGrouping: false }).split('').reverse().join('');
    return new NumberValue(this.rs, new Complex(+real, +complex));
  }

  /** operator: deg */
  __deg__(evalObj) { return new NumberValue(this.rs, Complex.mult(this.value, Math.PI / 180)); }

  /** operator: == */
  __eq__(evalObj, a) { return new BoolValue(this.rs, isNumericType(a.type()) ? this.value.equals(a.toPrimitive('complex', evalObj)) : false); }

  /** operator: ~ */
  __bitwiseNot__(evalObj) {
    if (isRealType(this.type())) return new NumberValue(this.rs, ~this.value.a);
  }

  /** operator: & */
  __bitwiseAnd__(evalObj, arg) {
    if (isRealType(this.type()) && isRealType(arg.type())) return new NumberValue(this.rs, this.toPrimitive('real', evalObj) & arg.toPrimitive('real', evalObj));
  }

  /** operator: | */
  __bitwiseOr__(evalObj, arg) {
    if (isRealType(this.type()) && isRealType(arg.type())) return new NumberValue(this.rs, this.toPrimitive('real', evalObj) | arg.toPrimitive('real', evalObj));
  }

  /** operator: ^ */
  __xor__(evalObj, arg) {
    if (isRealType(this.type()) && isRealType(arg.type())) return new NumberValue(this.rs, this.toPrimitive('real', evalObj) ^ arg.toPrimitive('real', evalObj));
  }

  /** operator: ** */
  __pow__(evalObj, n) {
    if (isNumericType(n.type())) return new NumberValue(this.rs, Complex.pow(this.toPrimitive('complex', evalObj), n.toPrimitive('complex', evalObj)));
  }

  /** operator: / */
  __div__(evalObj, n) {
    if (isNumericType(n.type())) return new NumberValue(this.rs, Complex.div(this.toPrimitive('complex', evalObj), n.toPrimitive('complex', evalObj)));
  }

  /** operator: % */
  __mod__(evalObj, n) {
    if (isNumericType(n.type())) return new NumberValue(this.rs, Complex.modulo(this.toPrimitive('complex', evalObj), n.toPrimitive('complex', evalObj)));
  }

  /** operator: * */
  __mul__(evalObj, n) {
    const t = n.type();
    if (t === 'string' || isNumericType(t)) return new NumberValue(this.rs, Complex.mult(this.toPrimitive('complex', evalObj), n.toPrimitive('complex', evalObj)));
  }

  /** operator: + */
  __add__(evalObj, n) {
    const t = n.type();
    if (t === 'undefined') return new NumberValue(this.rs, NaN);
    if (t === 'string') return new StringValue(this.rs, this.toPrimitive('string', evalObj) + n.toPrimitive('string', evalObj));
    if (isNumericType(t)) return new NumberValue(this.rs, Complex.add(this.toPrimitive('complex', evalObj), n.toPrimitive('complex', evalObj)));
  }

  /** operator: - */
  __sub__(evalObj, n) {
    const t = n.type();
    if (t === 'string' || isNumericType(t)) return new NumberValue(this.rs, Complex.sub(this.toPrimitive('complex', evalObj), n.toPrimitive('complex', evalObj)));
  }

  /** operator: << */
  __lshift__(evalObj, n) {
    const t = n.type();
    if (isRealType(this.type()) && isRealType(t)) return new NumberValue(this.rs, this.toPrimitive('real', evalObj) << n.toPrimitive('real', evalObj));
  }

  /** operator: >> */
  __rshift__(evalObj, n) {
    const t = n.type();
    if (isRealType(this.type()) && isRealType(t)) return new NumberValue(this.rs, this.toPrimitive('real', evalObj) >> n.toPrimitive('real', evalObj));
  }

  /** operator: <= */
  __le__(evalObj, n) {
    if (isRealType(this.type()) && isRealType(n.type())) return new BoolValue(this.rs, this.toPrimitive('real', evalObj) <= n.toPrimitive('real', evalObj));
    if (isNumericType(this.type()) && isNumericType(n.type())) return new BoolValue(this.rs, Complex.le(this.toPrimitive('complex', evalObj), n.toPrimitive('complex', evalObj)));
  }

  /** operator: < */
  __lt__(evalObj, n) {
    if (isRealType(this.type()) && n.type() === 'real') return new BoolValue(this.rs, this.toPrimitive('real', evalObj) < n.toPrimitive('real', evalObj));
    if (isNumericType(this.type()) && isNumericType(n.type())) return new BoolValue(this.rs, Complex.lt(this.toPrimitive('complex', evalObj), n.toPrimitive('complex', evalObj)));
  }

  /** operator: >= */
  __ge__(evalObj, n) {
    if (isRealType(this.type()) && isRealType(n.type())) return new BoolValue(this.rs, this.toPrimitive('real', evalObj) >= n.toPrimitive('real', evalObj));
    if (isNumericType(this.type()) && isNumericType(n.type())) return new BoolValue(this.rs, Complex.ge(this.toPrimitive('complex', evalObj), n.toPrimitive('complex', evalObj)));
  }

  /** operator: > */
  __gt__(evalObj, n) {
    if (isRealType(this.type()) && isRealType(n.type())) return new BoolValue(this.rs, this.toPrimitive('real', evalObj) > n.toPrimitive('real', evalObj));
    if (isNumericType(this.type()) && isNumericType(n.type())) return new BoolValue(this.rs, Complex.gt(this.toPrimitive('complex', evalObj), n.toPrimitive('complex', evalObj)));
  }

  /** Operator: : */
  __seq__(evalObj, val) {
    const t = val.type();
    if (isRealType(t) && this.value.b === 0) {
      let rng = range(this.toPrimitive('real_int', evalObj), val.toPrimitive('real_int', evalObj));
      return new ArrayValue(this.rs, rng.map(n => new NumberValue(this.rs, n)));
    }
  }

  /** Return JSON representation */
  __toJson__(evalObj) {
    if (Complex.isNaN(this.value) || !Complex.isFinite(this.value)) return "null";
    if (isRealType(this.type())) {
      return this.toPrimitive('real', evalObj).toString();
    }
  }
}

class StringValue extends Value {
  constructor(runspace, string = '', interpolations = {}) {
    super(runspace, str(string));
    this.intpls = interpolations; // Map position: TokenLine
  }

  type() { return "string"; }

  /** Return JSON representation */
  __toJson__(evalObj) {
    return "\"" + this.value.replace(/[\\$'"]/g, "\\$&") + "\"";
  }

  /** Interpolate if necessary... Returns new StringValue object if interpolation */
  async eval(evalObj) {
    if (Object.keys(this.intpls).length === 0) return this;
    let cpy = new StringValue(this.rs, this.value);
    let offset = 0;
    for (let pos in this.intpls) {
      if (this.intpls.hasOwnProperty(pos)) {
        try {
          const idata = this.intpls[pos];
          let value = await idata.val.eval(evalObj), insert = value.toString(evalObj);
          if (idata.eq) insert = idata.src + insert;
          let index = +pos + offset;
          cpy.value = cpy.value.substr(0, index) + insert + cpy.value.substr(index);
          offset += insert.length;
        } catch (e) {
          throw new Error(`[${errors.GENERAL}] Error whilst interpolating string (index ${pos}):\n${e}`);
        }
      }
    }
    return cpy;
  }

  /** len() function */
  __len__(evalObj, newLength) {
    if (newLength !== undefined) {
      newLength = newLength.toPrimitive("real_int", evalObj);
      if (newLength > this.value.length) this.value += String.fromCharCode(0).repeat(newLength - this.value.length);
      else this.value = this.value.substr(0, newLength);
    }
    return new NumberValue(this.rs, this.value.length);
  }

  /** get() function */
  __get__(evalObj, i) {
    i = i.toPrimitive('real_int', evalObj);
    if (i < 0) i = this.value.length + i;
    if (i < 0 || i >= this.value.length) return new UndefinedValue(this.rs); // throw new Error(`Index Error: index ${i} is out of range`);
    const val = new StringValue(this.rs, this.value[i]);
    val.onAssign = (evalObj, value) => this.__set__(evalObj, i, value);
    val.getAssignVal = () => val;
    return val;
  }

  /** set() function */
  __set__(evalObj, i, value) {
    i = typeof i === 'number' ? i : i.toPrimitive('real_int', evalObj);
    if (i < 0) i = this.value.length + i;
    if (i < 0 || i >= this.value.length) return new UndefinedValue(this.rs); // throw new Error(`Index Error: index ${i} is out of range`);
    value = value.castTo('char').toString(evalObj);
    this.value = this.value.substring(0, i) + value + this.value.substr(i + 1);
    return this;
  }

  /** del() function */
  __del__(evalObj, key) {
    let i = key.toPrimitive('real_int', evalObj);
    if (isNaN(i) || i < 0 || i >= this.value.length) return new UndefinedValue(this.rs); // throw new Error(`Index Error: index ${i} is out of range`);
    const chr = this.value[i];
    this.value = this.value.substring(0, i) + this.value.substr(i + 1);
    return new StringValue(this.rs, chr);
  }

  /** find() function */
  __find__(evalObj, item) {
    return new NumberValue(this.rs, this.value.indexOf(item.toPrimitive('string', evalObj)));
  }

  /** reverse() function */
  __rev__(evalObj) {
    return new StringValue(this.rs, this.value.split('').reverse().join(''));
  }

  /** copy() function */
  __copy__(evalObj) { return new StringValue(this.rs, this.value); }

  /** min() function */
  __min__(evalObj) { return this.value.length === 0 ? this.rs.UNDEFINED : new CharValue(this.rs, Math.min(...this.value.split('').map(chr => chr.charCodeAt(0)))); }

  /** max() function */
  __max__(evalObj) { return this.value.length === 0 ? this.rs.UNDEFINED : new CharValue(this.rs, Math.max(...this.value.split('').map(chr => chr.charCodeAt(0)))); }

  __iter__(evalObj) {
    return new ArrayValue(this.rs, this.value.split('').map(c => new StringValue(this.rs, c)));
  }

  /** operator: == */
  __eq__(evalObj, a) {
    let eq = false, aT = a.type();
    if (aT === 'string') eq = this.toString(evalObj) === a.toString(evalObj);
    else if (aT === 'char') eq = this.value.length === 1 && this.value.charCodeAt(0) === a.value;
    return new BoolValue(this.rs, eq);
  }

  /** operator: * */
  __mul__(evalObj, n) {
    const t = n.type();
    if (t === 'real') {
      n = n.toPrimitive('real_int', evalObj);
      return new StringValue(this.rs, n < 0 ? '' : this.toString(evalObj).repeat(n));
    }
  }

  /** operator: + */
  __add__(evalObj, n) { return new StringValue(this.rs, this.toPrimitive('string', evalObj) + n.toPrimitive('string', evalObj)); }

  /** Operator: : */
  __seq__(evalObj, val) {
    const t = val.type();
    if (t === 'string') {
      if (this.value.length !== 1) throw new Error(`[${errors.TYPE_ERROR}] Type Error: expected char, got string "${this.value}"`);
      if (val.value.length !== 1) throw new Error(`[${errors.TYPE_ERROR}] Type Error: expected char, got string "${val.value}"`);
      let rng = range(this.value.charCodeAt(0), val.value.charCodeAt(0));
      return new ArrayValue(this.rs, rng.map(n => new StringValue(this.rs, String.fromCharCode(n))));
    }
  }

  /** Operator: % */
  __mod__(evalObj, arg) {
    let t = arg.type();
    let values = t === 'array' || t === 'set' ? arg.toPrimitive('array', evalObj) : [arg];
    return this.format(values);
  }

  /** Format string with Value[] */
  format(values) {
    let string = '', original = this.value, vi = 0;
    for (let i = 0; i < original.length; i++) {
      if (original[i] === '%') {
        let n1 = original[++i];
        if (n1 === undefined) {
          throw new Error(`[${errors.SYNTAX}] Syntax Error: incomplete formatting option at index ${i - 1}`);
        } else if (values[vi] === undefined) {
          string += '%' + n1;
        } else {
          if (n1 === '%') string += '%'; // "%%" -> "%"
          else if (n1 === 's') string += values[vi++].toPrimitive("string", evalObj); // "%s" or "%" -> string
          else if (n1 === 'n') string += values[vi++].toPrimitive('complex', evalObj).toString(); // "%n" -> complex
          else if (n1 === 'i') string += values[vi++].toPrimitive('complex_int', evalObj).toString(); // "%i" -> complex int
          else if (n1 === 'c' && original[i + 1] === 'i') { // "%ci" -> complex int
            i++;
            string += values[vi++].toPrimitive('complex_int', evalObj).toString();
          }
          else if (n1 === 'r' && original[i + 1] === 'i') { // "%ri" -> real int
            i++;
            string += values[vi++].toPrimitive('real_int', evalObj).toString();
          }
          else if (n1 === 'c') string += values[vi++].castTo('char').toString(); // "%c" -> character
          else if (n1 === 'b') string += values[vi++].toPrimitive('bool', evalObj).toString(); // "%b" -> boolean
          else if (n1 === 'o') string += values[vi++].toPrimitive('complex', evalObj).toString(8); // "%o" -> complex octal
          else if (n1 === 'd') string += values[vi++].toPrimitive('complex', evalObj).toString(10); // "%d" -> complex decimal
          else if (n1 === 'x') string += values[vi++].toPrimitive('complex', evalObj).toString(16, 'lower'); // "%x" -> complex hexadecimal (lowercase)
          else if (n1 === 'X') string += values[vi++].toPrimitive('complex', evalObj).toString(16, 'upper'); // "%X" -> complex hexadecimal (uppercase)
          else if (n1 === 'e') string += values[vi++].toPrimitive('complex', evalObj).toExponential(); // "%e" -> complex exponential
          else throw new Error(`[${errors.SYNTAX}] Syntax Error: unknown formatting option '${n1}' (0x${n1.charCodeAt(0).toString(16)}) at index ${i - 1}`);
        }
      } else {
        string += original[i];
      }
    }
    if (vi < values.length) {
      for (; vi < values.length; vi++) string += ' ' + values[vi].toPrimitive("string", evalObj);
    }
    return new StringValue(this.rs, string);
  }
}

class CharValue extends Value {
  /** char may either be NUMBER or STRING */
  constructor(runspace, arg = 0) {
    if (arg === '') arg = 0;
    if (arg instanceof Complex) throw new Error("CharValue: complex value not allowed!");
    let value = typeof arg === 'number' ? arg : str(arg[0]).charCodeAt(0);
    super(runspace, value);
  }

  type() { return "char"; }

  /** abs() function */
  __abs__(evalObj) { return new NumberValue(this.rs, this.value); }

  /** copy() function */
  __copy__(evalObj) { return new CharValue(this.rs, this.value); }

  /** Return JSON representation */
  __toJson__(evalObj) {
    return "\"" + String.fromCharCode(this.value) + "\"";
  }

  /** operator: == */
  __eq__(evalObj, other) {
    let t = other.type(), eq = false;
    if (t === 'char') eq = this.value === other.value;
    else if (t === 'string') eq = other.value.length === 1 && this.value === other.value.charCodeAt(0);
    else if (t === 'real') eq = this.value === other.value.a;
    else if (t === 'bool') eq = this.value === other.value;
    return new BoolValue(this.rs, eq);
  }

  /** operator: ~ */
  __bitwiseNot__(evalObj) {
    return new CharValue(this.rs, ~this.value);
  }

  /** operator: & */
  __bitwiseAnd__(evalObj, arg) {
    if (isRealType(arg.type())) return new CharValue(this.rs, this.value & arg.toPrimitive('real', evalObj));
  }

  /** operator: | */
  __bitwiseOr__(evalObj, arg) {
    if (isRealType(arg.type())) return new CharValue(this.rs, this.value | arg.toPrimitive('real', evalObj));
  }

  /** operator: ^ */
  __xor__(evalObj, arg) {
    if (isRealType(arg.type())) return new CharValue(this.rs, this.value ^ arg.toPrimitive('real', evalObj));
  }

  /** operator: ** */
  __pow__(evalObj, n) {
    if (isRealType(n.type())) return new CharValue(this.rs, Math.pow(this.value, n.toPrimitive('real', evalObj)));
  }

  /** operator: / */
  __div__(evalObj, n) {
    if (isRealType(n.type())) return new CharValue(this.rs, this.value / n.toPrimitive('real', evalObj));
  }

  /** operator: % */
  __mod__(evalObj, n) {
    if (isRealType(n.type())) return new CharValue(this.rs, this.value % n.toPrimitive('real', evalObj));
  }

  /** operator: * */
  __mul__(evalObj, n) {
    const t = n.type();
    if (t === 'string' || isRealType(t)) return new CharValue(this.rs, this.value * n.toPrimitive('real', evalObj));
  }

  /** operator: + */
  __add__(evalObj, n) {
    const t = n.type();
    if (t === 'string' || isRealType(t)) return new CharValue(this.rs, this.value + n.toPrimitive('real', evalObj));
  }

  /** operator: - */
  __sub__(evalObj, n) {
    const t = n.type();
    if (t === 'string' || isRealType(t)) return new CharValue(this.rs, this.value - n.toPrimitive('real', evalObj));
  }

  /** operator: << */
  __lshift__(evalObj, n) {
    const t = n.type();
    if (isRealType(t)) return new CharValue(this.rs, this.value << n.toPrimitive('real', evalObj));
  }

  /** operator: >> */
  __rshift__(evalObj, n) {
    const t = n.type();
    if (isRealType(t)) return new CharValue(this.rs, this.value >> n.toPrimitive('real', evalObj));
  }

  /** operator: <= */
  __le__(evalObj, n) {
    if (isRealType(n.type())) return new BoolValue(this.rs, this.value <= n.toPrimitive('real', evalObj));
  }

  /** operator: < */
  __lt__(evalObj, n) {
    if (n.type() === 'real') return new BoolValue(this.rs, this.value < n.toPrimitive('real', evalObj));
  }

  /** operator: >= */
  __ge__(evalObj, n) {
    if (isRealType(n.type())) return new BoolValue(this.rs, this.value >= n.toPrimitive('real', evalObj));
  }

  /** operator: > */
  __gt__(evalObj, n) {
    if (isRealType(n.type())) return new BoolValue(this.rs, this.value > n.toPrimitive('real', evalObj));
  }

  /** Operator: : */
  __seq__(evalObj, val) {
    const t = val.type();
    if (isNumericType(t)) {
      let rng = range(this.toPrimitive('real_int', evalObj), val.toPrimitive('real_int', evalObj));
      return new ArrayValue(this.rs, rng.map(n => new NumberValue(this.rs, n)));
    }
  }
}

class BoolValue extends Value {
  constructor(runspace, boolean = false) {
    super(runspace, !!boolean);
  }

  type() { return "bool"; }

  /** copy() function */
  __copy__(evalObj) { return new BoolValue(this.rs, this.value); }

  /** Return JSON representation */
  __toJson__(evalObj) { return this.value ? "true" : "false"; }

  /** operator: == */
  __eq__(evalObj, a) { return new BoolValue(this.rs, isNumericType(a.type()) ? this.value === a.toPrimitive('bool', evalObj) : false); }

  /** operator: ~ */
  __bitwiseNot__(evalObj) { return new NumberValue(this.rs, ~this.value); }

  /** operator: & */
  __bitwiseAnd__(evalObj, arg) {
    const argt = arg.type();
    if (isRealType(argt)) return new NumberValue(this.rs, this.toPrimitive('real', evalObj) & arg.toPrimitive('real', evalObj));
  }

  /** operator: | */
  __bitwiseOr__(evalObj, arg) {
    const argt = arg.type();
    if (isRealType(argt)) return new NumberValue(this.rs, this.toPrimitive('real', evalObj) | arg.toPrimitive('real', evalObj));
  }

  /** operator: ^ */
  __xor__(evalObj, arg) {
    const argt = arg.type();
    if (isRealType(argt)) return new NumberValue(this.rs, this.toPrimitive('real', evalObj) ^ arg.toPrimitive('real', evalObj));
  }

  /** operator: + */
  __add__(evalObj, n) {
    if (isNumericType(n.type())) return new NumberValue(this.rs, Complex.add(this.toPrimitive('real', evalObj), n.toPrimitive('complex', evalObj)));
  }
}

class ArrayValue extends Value {
  constructor(runspace, items = [], castToAny = true) {
    super(runspace, castToAny ? items.map(v => typeof v.castTo === "function" ? v.castTo('any') : v) : items);
  }

  type() { return "array"; }

  __iter__(evalObj) {
    return new ArrayValue(this.rs, this.value);
  }

  /** len() function */
  __len__(evalObj, newLength) {
    if (newLength !== undefined) {
      newLength = newLength.toPrimitive("real_int", evalObj);
      if (newLength > this.value.length) while (newLength > this.value.length) this.value.push(this.rs.UNDEFINED);
      else this.value.length = newLength;
    }
    return new NumberValue(this.rs, this.value.length);
  }

  /** abs() function */
  __abs__(evalObj) { return new NumberValue(this.rs, this.value.length); }

  /** Return JSON representation*/
  __toJson__(evalObj) { return "[" + this.value.map(v => toJson(v)).join(',') + "]"; }

  /** min() function */
  __min__(evalObj) { return this.value.length === 0 ? this.rs.UNDEFINED : new NumberValue(this.rs, Math.min(...this.value.map(v => v.toPrimitive('real', evalObj)))); }

  /** max() function */
  __max__(evalObj) { return this.value.length === 0 ? this.rs.UNDEFINED : new NumberValue(this.rs, Math.max(...this.value.map(v => v.toPrimitive('real', evalObj)))); }

  /** get() function */
  __get__(evalObj, i) {
    i = i.toPrimitive('real_int', evalObj);
    if (i < 0) i = this.value.length + i; // Advance from end of array
    const val = (isNaN(i) || i < 0 || i >= this.value.length) ? new UndefinedValue(this.rs) : this.value[i];
    val.onAssign = (evalObj, value) => this.__set__(evalObj, i, value);
    val.getAssignVal = () => this.value[i];
    return val;
  }

  /** set() function */
  __set__(evalObj, i, value) {
    i = typeof i === 'number' ? i : i.toPrimitive('real_int', evalObj);
    if (i < 0) i = this.value.length + i;
    if (isNaN(i) || i < 0) return new UndefinedValue(this.rs);
    if (i >= this.value.length) {
      for (let j = this.value.length; j < i; j++) {
        this.value[j] = new UndefinedValue(this.rs);
      }
    }
    this.value[i] = value;
    return this;
  }

  /** del() function */
  __del__(evalObj, key) {
    let i = key.toPrimitive('real_int', evalObj);
    if (isNaN(i) || i < 0 || i >= this.value.length) return new UndefinedValue(this.rs); // throw new Error(`Index Error: index ${i} is out of range`);
    this.value.splice(i, 1);
    return new NumberValue(this.rs, i);
  }

  /** reverse() function */
  __rev__(evalObj) {
    this.value.reverse();
    return this;
  }

  /** find() function */
  __find__(evalObj, item) {
    return new NumberValue(this.rs, findIndex(item, this.value, evalObj));
  }

  /** copy() function */
  __copy__(evalObj) {
    const emsg = (v, i) => `[${errors.CANT_COPY}] Type Error: Error whilst copying type array:\n[${errors.CANT_COPY}] Index ${i}: type ${v.type()} cannot be copied`;
    return new ArrayValue(this.rs, this.value.map((v, i) => {
      let copy;
      try { copy = v.__copy__?.(evalObj); } catch (e) { throw new Error(`${emsg(v, i)}\n${e}`); }
      if (copy === undefined) throw new Error(emsg(v, i));
      return copy;
    }));
  }

  /** Array assignmation. This -> symbols. Other -> values */
  __assignTemplate(evalObj, other, assignFnName) {
    if (other.type() === 'array') {
      try {
        // if (other.value.length > this.value.length) throw new Error(`[${errors.TYPE_ERROR}] Type Error: Cannot unpack array of length ${other.value.length} into array of length ${this.value.length}`);
        let lim = this.value.length, tmpValues = [];
        for (let i = 0; i < lim; i++) {
          if (typeof this.value[i][assignFnName] !== 'function') {
            throw new Error(`[${errors.TYPE_ERROR}] Type Error: Unable to unpack arrays: cannot assign to type ${this.value[i].type()} (${this.value[i]})`);
          }
          tmpValues.push(other.value[i] ? other.value[i].castTo("any") : this.rs.UNDEFINED);
        }

        for (let i = 0; i < this.value.length; i++) {
          this.value[i][assignFnName](evalObj, tmpValues[i]);
        }
        return this;
      } catch (e) {
        throw new Error(`[${errors.BAD_ARG}] Errors whilst unpacking array[${other.value.length}] into array[${this.value.length}]:\n${e}`);
      }
    }
  }

  __assign__(evalObj, other) {
    return this.__assignTemplate(evalObj, other, "__assign__");
  }

  __nonlocalAssign__(evalObj, other) {
    return this.__assignTemplate(evalObj, other, "__nonlocalAssign__");
  }

  /** operator: == */
  __eq__(evalObj, a) { return new BoolValue(this.rs, a.type() === 'array' && this.value.length === a.value.length ? this.value.map((_, i) => equal(this.value[i], a.value[i])).every(x => x) : false); }

  /** operator: * */
  __mul__(evalObj, n) {
    const t = n.type();
    if (t === 'array') return new ArrayValue(this.rs, intersect(this.toPrimitive('array', evalObj), n.toPrimitive('array', evalObj), evalObj));
    if (t === 'real') return new ArrayValue(this.rs, arrRepeat(this.toPrimitive('array', evalObj), n.toPrimitive('real_int', evalObj)));
  }

  /** operator: + */
  __add__(evalObj, n) {
    const t = n.type();
    if (t === 'array') return new ArrayValue(this.rs, this.toPrimitive('array', evalObj).concat(n.toPrimitive('array', evalObj)));
    return new ArrayValue(this.rs, [...this.toPrimitive('array', evalObj), n]);
  }

  /** operator: - */
  __sub__(evalObj, n) {
    const t = n.type();
    if (t === 'array') return new ArrayValue(this.rs, arrDifference(this.toPrimitive('array', evalObj), n.toPrimitive('array', evalObj)));
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
  __len__(evalObj, newLength) {
    if (newLength !== undefined) {
      newLength = newLength.toPrimitive("real_int", evalObj);
      if (newLength > this.value.length) throw new Error(`[${errors.TYPE_ERROR}] Type Error: cannot set len() of type ${this.type()}`);
      else this.value.splice(this.value.length - newLength);
    }
    return new NumberValue(this.rs, this.value.length);
  }

  /** Return JSON representation*/
  __toJson__(evalObj) { return "[" + this.value.map(v => toJson(evalObj, v)) + "]"; }

  /** abs() function */
  __abs__(evalObj) { return new NumberValue(this.rs, this.value.length); }

  /** min() function */
  __min__(evalObj) { return this.value.length === 0 ? this.rs.UNDEFINED : new StringValue(this.rs, Math.min(...this.value.map(v => v.toPrimitive('real', evalObj)))); }

  /** max() function */
  __max__(evalObj) { return this.value.length === 0 ? this.rs.UNDEFINED : new StringValue(this.rs, Math.max(...this.value.map(v => v.toPrimitive('real', evalObj)))); }

  /** reverse() function */
  __rev__(evalObj) {
    this.value.reverse();
    return this;
  }

  /** find() function */
  __find__(evalObj, item) {
    return new NumberValue(this.rs, findIndex(item, this.value, evalObj));
  }

  /** copy() function */
  __copy__(evalObj,) {
    const emsg = (v, i) => `[${errors.CANT_COPY}] Error whilst copying type set: index ${i}: type ${v.type()} cannot be copied`;
    return new SetValue(this.rs, this.value.map((v, i) => {
      let copy;
      try { copy = v.__copy__?.(evalObj); } catch (e) { throw new Error(`${emsg(v, i)}\n${e}`); }
      if (copy === undefined) throw new Error(emsg(v, i));
      return copy;
    }));
  }

  __iter__(evalObj) {
    return new ArrayValue(this.rs, this.value);
  }

  /** Run and return fn() */
  run(fn) {
    let tmp = fn(this);
    this.check();
    return tmp;
  }

  /** operator: == */
  __eq__(evalObj, a) { return new BoolValue(this.rs, a.type() === 'set' && this.value.length === a.value.length ? this.value.map(v => findIndex(v, a.value, evalObj) !== -1).every(x => x) : false); }

  /** operator: ' */
  __not__(evalObj) {
    const us = this.rs.getVar('universal_set')?.castTo('any');
    if (us == undefined) return new Error(`Type Error: variable universal_set is missing.`);
    if (us.type() !== 'set') return new Error(`Type Error: variable universal_set is not of type set (got ${us.type()})`);
    return new SetValue(this.rs, arrDifference(us.toPrimitive('array', evalObj), this.toPrimitive('array', evalObj)));
  }

  /** operator: * */
  __mul__(evalObj, n) {
    const t = n.type();
    if (t === 'set') return new SetValue(this.rs, intersect(this.toPrimitive('array', evalObj), n.toPrimitive('array', evalObj), evalObj));
  }

  /** operator: + */
  __add__(evalObj, n) {
    const t = n.type();
    if (t === 'set') return new SetValue(this.rs, this.toPrimitive('array', evalObj).concat(n.toPrimitive('array, evalObj')));
    return new SetValue(this.rs, [...this.toPrimitive('array', evalObj), n]);
  }

  /** operator: - */
  __sub__(evalObj, n) {
    const t = n.type();
    if (t === 'set') return new SetValue(this.rs, arrDifference(this.toPrimitive('array', evalObj), n.toPrimitive('array', evalObj)));
  }

  /** Map assignmation. This -> symbols. Other (map) -> values */
  __assignTemplate(evalObj, other, assignFnName) {
    if (other.type() === 'map') {
      try {
        let tmpValues = new Map();
        for (let i = 0; i < this.value.length; i++) {
          if (typeof this.value[i][assignFnName] !== 'function') {
            throw new Error(`[${errors.TYPE_ERROR}] Type Error: Unable to unpack arrays: cannot assign to type ${this.value[i].type()} (${this.value[i]})`);
          }
          let key = this.value[i].value;
          tmpValues.set(key, other.value.has(key) ? other.value.get(key).castTo("any") : this.rs.UNDEFINED);
        }

        for (let i = 0; i < this.value.length; i++) {
          let key = this.value[i].value;
          this.value[i][assignFnName](evalObj, tmpValues.get(key));
        }
        return this;
      } catch (e) {
        throw new Error(`[${errors.BAD_ARG}] Errors whilst unpacking array[${other.value.length}] into array[${this.value.length}]:\n${e}`);
      }
    }
  }

  __assign__(evalObj, other) {
    return this.__assignTemplate(evalObj, other, "__assign__");
  }

  __nonlocalAssign__(evalObj, other) {
    return this.__assignTemplate(evalObj, other, "__nonlocalAssign__");
  }
}

class MapValue extends Value {
  constructor(runspace, map = undefined) {
    super(runspace, null);
    this.value = map === undefined ? new Map() : map;
    this.inheritFrom = new Set(); // Collection of MapValues we inherit from
    this.instanceOf = undefined; // Reference to MapValue we are an instance of
  }

  type() { return "map"; }

  /** Create and return new MapValue which is an instance of this */
  createInstance() {
    let map = new Map();
    this._passCreateInstanceValues(map);
    let mapValue = new MapValue(this.rs, map);
    mapValue.instanceOf = this;
    return mapValue;
  }

  /** Copy values to be passed in as instance creation */
  _passCreateInstanceValues(map) {
    // Copy all non-function values
    this.value.forEach((value, key) => {
      value = value.castTo("any");
      if (!(value instanceof FunctionRefValue)) {
        map.set(key, value.__copy__());
      }
    });
    this.inheritFrom.forEach(x => x._passCreateInstanceValues(map));
    return map;
  }

  /** Check if this is an instance of the argument (argument is of type `map`) */
  isInstanceOf(map) {
    // Check if instance
    if (this.instanceOf === map) return true;
    // Check top-level of inheritance tree
    for (let x of this.inheritFrom) if (x === map) return true;
    if (this.instanceOf) for (let x of this.instanceOf.inheritFrom) if (x === map) return true;
    // Check inheritance tree
    for (let x of this.inheritFrom) if (x.isInstanceOf(map)) return true;
    if (this.instanceOf) for (let x of this.instanceOf.inheritFrom) if (x.isInstanceOf(map)) return true;
    return false;
  }

  /** len() function */
  __len__(evalObj, newLength) {
    if (newLength !== undefined) {
      newLength = newLength.toPrimitive("real_int", evalObj);
      if (newLength !== 0) throw new Error(`[${errors.TYPE_ERROR}] Type Error: cannot set non-zero len() of type ${this.type()}`);
      this.value.clear();
    }
    return new NumberValue(this.rs, this.value.size);
  }

  /** abs() function */
  __abs__(evalObj) { return new NumberValue(this.rs, this.value.size); }

  /** Return JSON representation*/
  __toJson__(evalObj) { return "{" + Array.from(this.value.entries()).map(([k, v]) => "\"" + k + "\":" + toJson(evalObj, v)).join(',') + "}"; }

  /** min() function */
  __min__(evalObj) {
    if (this.value.size === 0) return this.rs.UNDEFINED;
    let minKey, minVal = new NumberValue(this.rs, Infinity);
    this.value.forEach((val, key) => {
      if (val.__lt__?.(evalObj, minVal).toPrimitive("bool", evalObj)) {
        minKey = key;
        minVal = val;
      }
    });
    return minKey ? new StringValue(this.rs, minKey) : minKey;
  }

  /** max() function */
  __max__(evalObj) {
    if (this.value.size === 0) return this.rs.UNDEFINED;
    let maxKey, maxVal = new NumberValue(this.rs, -Infinity);
    this.value.forEach((val, key) => {
      if (val.__gt__?.(evalObj, maxVal).toPrimitive("bool", evalObj)) {
        maxKey = key;
        maxVal = val;
      }
    });
    return maxKey ? new StringValue(this.rs, maxKey) : maxKey;
  }

  /** Get raw value (key must be JS string) */
  __getRaw(evalObj, key) {
    let val = this.value.has(key) ? this.value.get(key) : undefined;
    // Check InstanceOf map
    if (!val && this.instanceOf) {
      val = this.instanceOf.__getRaw(evalObj, key); // Search parent as well
      if (val instanceof FunctionRefValue) {
        val = val.__copy__(evalObj);
        val.prependArgs.push(this);
      }
    }
    // Check maps we inherit from
    if (!val) {
      for (let i of this.inheritFrom) {
        val = i.__getRaw(evalObj, key);
        if (val) break;
      }
    }
    return val;
  }

  /** get() function */
  __get__(evalObj, key) {
    key = key.toString(evalObj);
    let val = this.__getRaw(evalObj, key) ?? new UndefinedValue(this.rs);
    val.onAssign = (evalObj, value) => this.__set__(evalObj, key, value);
    val.getAssignVal = () => this.value.get(key);
    return val;
  }

  /** set() function */
  __set__(evalObj, key, value) {
    key = key.toString(evalObj);
    this.value.set(key, value);
    return this;
  }

  /** del() function */
  __del__(evalObj, key) {
    key = key.toString(evalObj);
    if (!this.value.has(key)) return new UndefinedValue(this.rs); // throw new Error(`Key Error: key "${key}" does not exist in map`);
    const val = this.value.get(key);
    this.value.delete(key);
    return val;
  }

  /** find() function */
  __find__(evalObj, item) {
    for (const [key, value] of this.value.entries()) {
      if (equal(item, value)) return new StringValue(this.rs, key);
    }
    return new UndefinedValue(this.rs);
  }

  /** copy() function */
  __copy__(evalObj) {
    const emsg = (v, key) => `[${errors.CANT_COPY}] Error whilst copying type map: key ${key}: type ${v.type()} cannot be copied`;
    const map = new MapValue(this.rs);
    this.value.forEach((v, key) => {
      let copy;
      try { copy = v.__copy__?.(evalObj); } catch (e) { throw new Error(`${emsg(v, key)}\n${e}`); }
      if (copy === undefined) throw new Error(emsg(v, key));
      map.value.set(key, copy);
    });
    return map;
  }

  /** Construct */
  async __call__(evalObj, args, kwargs) {
    let obj = this.createInstance();
    if (this.value.has("__construct__")) {
      let construct = this.value.get("__construct__").castTo("any"), ret;
      construct = construct.getFn ? construct.getFn() : construct;
      if (construct instanceof RunspaceFunction) {
        let firstArg = Object.keys(construct.rargs)[0], data = firstArg ? construct.args.get(firstArg) : undefined;
        if (!data || data.pass !== 'ref' || data.type !== 'map' || data.optional !== false || data.ellipse !== false) throw new Error(`[${errors.BAD_ARG}] Argument Error: First argument of __construct__ should match '${firstArg ?? 'obj'}: ref map', got '${firstArg ? construct.argumentSignature(firstArg) : ''}'`);
        try {
          ret = await construct.call(evalObj, [obj, ...args]);
        } catch (e) {
          throw new Error(`[${errors.GENERAL}] __construct__ ${construct.signature()}:\n${e}`);
        }
      } else {
        throw new Error(`[${errors.TYPE_ERROR}] Type Error: expected __construct__ to be a function, got ${construct.type()}`);
      }
    }
    return obj;
  }

  __iter__(evalObj) {
    return new ArrayValue(this.rs, Array.from(this.value.entries()).map(([k, v]) => new ArrayValue(this.rs, [new StringValue(this.rs, k), v])));
  }

  /** operator: == */
  __eq__(evalObj, a) {
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

var _objValueSetUp = false;
class ObjectValue extends MapValue {
  constructor(runspace, map = undefined) {
    super(runspace, map);

    // Setup prototype methods?
    if (!_objValueSetUp) {
      _objValueSetUp = true;

      // No-Arg methods
      for (let name of ["abs", "copy", "rev", "min", "max", "iter", "deg", "not", "bitwiseNot", "pos", "neg"]) {
        let method = "__" + name + "__";
        ObjectValue.prototype[method] = function (evalObj) {
          let fn = this.__getRaw(evalObj, method);
          if (fn) return fn.getFn().call(evalObj, this.instanceOf ? [this] : []);
          let sup = Object.getPrototypeOf(ObjectValue.prototype);
          return sup[method] ? sup[method](evalObj) : undefined;
        };
      }

      // One-Arg methods
      for (let name of ["find", "pow", "seq", "div", "mod", "mul", "add", "sub", "lshift", "rshift", "le", "lt", "ge", "gt", "in", "eq", "neq", "bitwiseAnd", "xor", "bitwiseOr", "and", "or"]) {
        let method = "__" + name + "__";
        ObjectValue.prototype[method] = function (evalObj, arg) {
          let fn = this.__getRaw(evalObj, method);
          if (fn) return fn.getFn().call(evalObj, this.instanceOf ? [this, arg] : [arg]);
          let sup = Object.getPrototypeOf(ObjectValue.prototype);
          return sup[method] ? sup[method](evalObj, arg) : undefined;
        };
      }
    }
  }

  type() { return "object"; }

  /** Create and return new MapValue which is an instance of this */
  createInstance() {
    let map = new Map();
    this._passCreateInstanceValues(map);
    let objValue = new ObjectValue(this.rs, map);
    objValue.instanceOf = this;
    return objValue;
  }

  __del__(evalObj, a) {
    let fn = this.__getRaw(evalObj, '__del__');
    return fn ? fn.getFn().call(evalObj, a ? [a] : []) : super.__del__?.(evalObj, a);
  }

  __len__(evalObj, a) {
    let fn = this.__getRaw(evalObj, '__len__');
    return fn ? fn.getFn().call(evalObj, a ? [a] : []) : super.__len__?.(evalObj, a);
  }

  async __get__(evalObj, key) {
    let fn = this.__getRaw(evalObj, '__get__');
    if (fn) {
      let val = await fn.getFn().call(evalObj, [key]);
      val.onAssign = (evalObj, value) => this.__set__(evalObj, key, value);
      val.getAssignVal = () => this.value.get(key);
      return val;
    } else {
      return super.__get__?.(evalObj, key);
    }
  }

  __set__(evalObj, key, value) {
    let fn = this.__getRaw(evalObj, '__set__');
    return fn ? fn.getFn().call(evalObj, [key, value]) : super.__set__?.(evalObj, key, value);
  }

  __call__(evalObj, args, kwargs) {
    let fn = this.__getRaw(evalObj, '__call__');
    return fn ? fn.getFn().call(evalObj, args, kwargs) : super.__call__?.(evalObj, args, kwargs);
  }

  castTo(type, evalObj) {
    // DO NOT interfere with casting to oneself
    if (type === "any" || type === this.type()) return this;
    let fn = this.__getRaw(evalObj, '__cast__');
    return fn ? fn.getFn().call(evalObj, [new StringValue(this.rs, type)]) : super.castTo(type, evalObj);
  }
}

/** Stores a RunspaceFunction */
class FunctionRefValue extends Value {
  constructor(runspace, fn = undefined) {
    super(runspace, fn);
    this.prependArgs = [];
  }

  type() { return "func"; }

  exists() {
    return this.value !== undefined;
  }

  getFn() {
    return this.value;
  }

  toString() {
    return `<func ${this.value.name}>`;
  }

  /** When this is called. Takes array of Value classes as arguments */
  async __call__(evalObj, args, kwargs) {
    const fn = this.getFn();
    if (this.prependArgs.length > 0) args = [...this.prependArgs, ...args];
    if (fn) {
      try {
        return await fn.call(evalObj, args, kwargs);
      } catch (e) {
        throw new Error(`[${errors.GENERAL}] Function ${fn.signature()}:\n${e}`);
      }
    } else {
      this._throwNullRef();
    }
  }

  /** Throw NULL REFERENCE error */
  _throwNullRef() {
    throw new Error(`[${errors.NULL_REF}] Null Reference: reference to undefined function ${this}`);
  }

  /** copy() function */
  __copy__(evalObj) { return new FunctionRefValue(this.rs, this.value); }

  /** operator: == */
  __eq__(evalObj, a) { return new BoolValue(this.rs, a.type() === 'func' ? this.value === a.value : false); }
}


/** Convert primitive JS value to Value class */
function primitiveToValueClass(runspace, primitive) {
  if (primitive instanceof Value) return primitive; // Already a value
  if (runspace == undefined) return new UndefinedValue(runspace); // undefined
  if (typeof primitive === 'boolean') return new BoolValue(runspace, primitive); // Boolean
  const c = Complex.is(primitive);
  if (c !== false) return new NumberValue(runspace, c); // Number
  if (primitive instanceof Set) return new SetValue(runspace, Array.from(primitive).map(p => primitiveToValueClass(runspace, p))); // Set
  if (primitive instanceof Map) { // Map
    let map = new MapValue(rs);
    primitive.forEach((v, k) => {
      map.value.set(k, primitiveToValueClass(runspace, v));
    });
    return map;
  }
  if (Array.isArray(primitive)) return new ArrayValue(runspace, primitive.map(p => primitiveToValueClass(runspace, p))); // Array
  if (primitive instanceof RunspaceFunction) {
    const varVal = runspace.getVar(primitive.name);
    if (varVal instanceof FunctionRefValue) return varVal;
    return new FunctionRefValue(this, primitive); // Function
  }
  return new StringValue(runspace, primitive); // Else, string
}

/** This is used for Value.__new__ */
Value.typeMap = {
  complex: NumberValue,
  complex_int: NumberValue,
  real: NumberValue,
  real_int: NumberValue,
  string: StringValue,
  char: CharValue,
  bool: BoolValue,
  array: ArrayValue,
  set: SetValue,
  map: MapValue,
  object: ObjectValue,
};

Value.__new__ = (rs, t) => {
  if (t in Value.typeMap) return new Value.typeMap[t](rs);
  return undefined;
};

/** Setup casting maps */
UndefinedValue.castMap = {
  string: o => new StringValue(o.rs, 'undef'),
  char: o => new CharValue(o.rs, 0),
  complex: o => new NumberValue(o.rs, NaN),
  complex_int: o => new NumberValue(o.rs, NaN),
  real: o => new NumberValue(o.rs, NaN),
  real_int: o => new NumberValue(o.rs, NaN),
  bool: o => new BoolValue(o.rs, false),
  map: o => new MapValue(o.rs),
};

NumberValue.castMap = {
  complex: o => o,
  complex_int: o => new NumberValue(o.rs, Complex.floor(o.value)),
  real: o => new NumberValue(o.rs, o.value.a),
  real_int: o => new NumberValue(o.rs, Math.floor(o.value.a)),
  string: o => {
    let s;
    if (isNaN(o.value.a) || isNaN(o.value.b)) s = 'nan';
    else if (o.value.b === 0 && !isFinite(o.value.a)) s = o.value.a < 0 ? "-inf" : "inf";
    else if (!isFinite(o.value.a) || !isFinite(o.value.b)) s = 'inf';
    else s = str(o.value);
    return new StringValue(o.rs, s);
  },
  char: o => new CharValue(o.rs, Math.floor(o.value.a)),
  bool: o => {
    if (o.value.b === 0) return new BoolValue(o.rs, !!o.value.a);
    if (o.value.a === 0) return new BoolValue(o.rs, !!o.value.b);
    return new BoolValue(o.rs, true);
  },
};

StringValue.castMap = {
  string: o => o,
  char: o => {
    if (o.value.length === 1) return new CharValue(o.rs, o.value[0]);
    throw new Error(`[${errors.CAST_ERROR}] Cannot cast string of length ${o.value.length} to type char`);
  },
  bool: o => new BoolValue(o.rs, !!o.value),
  complex: o => new NumberValue(o.rs, +o.value),
  complex_int: o => new NumberValue(o.rs, Math.floor(+o.value)),
  real: o => new NumberValue(o.rs, +o.value),
  real_int: o => new NumberValue(o.rs, Math.floor(+o.value)),
  array: o => new ArrayValue(o.rs, o.value.split('').map(s => new StringValue(o.rs, s))),
  set: o => new SetValue(o.rs, o.value.split('').map(s => new StringValue(o.rs, s))),
  map: o => new MapValue(o.rs, new Map(o.value.split('').map((c, i) => ([i, c])))),
};

CharValue.castMap = {
  char: o => o,
  string: o => new StringValue(o.rs, String.fromCharCode(o.value)),
  bool: o => new BoolValue(o.rs, !!o.value),
  complex: o => new NumberValue(o.rs, o.value),
  complex_int: o => new NumberValue(o.rs, o.value),
  real: o => new NumberValue(o.rs, o.value),
  real_int: o => new NumberValue(o.rs, o.value),
};

BoolValue.castMap = {
  bool: o => o,
  complex: o => new NumberValue(o.rs, +o.value),
  complex_int: o => new NumberValue(o.rs, +o.value),
  real: o => new NumberValue(o.rs, +o.value),
  real_int: o => new NumberValue(o.rs, +o.value),
  string: o => new StringValue(o.rs, o.value.toString()),
  char: o => new CharValue(o.rs, +o.value),
};

ArrayValue.castMap = {
  array: o => o,
  set: o => new SetValue(o.rs, o.value),
  string: o => new StringValue(o.rs, "[" + o.value.map(t => t.toString()).join(',') + "]"),
  bool: o => new BoolValue(o.rs, o.value.length !== 0),
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
  bool: o => new BoolValue(o.rs, o.value.length !== 0),
  map: o => o.__len__().toPrimitive("real") === 0 ? new MapValue(o.rs) : undefined, // Convert empty sets to map, nothing else
  object: o => o.__len__().toPrimitive("real") === 0 ? new ObjectValue(o.rs) : undefined, // Convert empty sets to objects, nothing else
};

MapValue.castMap = {
  map: o => o,
  string: o => new StringValue(o.rs, "{" + Array.from(o.value.entries()).map(pair => pair.join(':')).join(',') + "}"),
  bool: o => new BoolValue(o.rs, !!o.value),
  array: o => o.__iter__(),
  object: o => new ObjectValue(o.rs, o.value),
};

FunctionRefValue.castMap = {
  func: o => o,
  string: o => new StringValue(o.rs, o.toString()),
  bool: o => new BoolValue(o.rs, true),
};

module.exports = { Value, UndefinedValue, NumberValue, StringValue, CharValue, BoolValue, ArrayValue, SetValue, MapValue, ObjectValue, FunctionRefValue, primitiveToValueClass };