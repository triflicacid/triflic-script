const { errors } = require("../errors");

const types = {
  any: 0, // Keep original Token type
  complex: 1, // Complex number 'a + bi'
  complex_int: 2, // Complex number {a, b} are integers
  real: 3, // Real number 'a + 0i'
  real_int: 4, // Real number where {a} is an integer
  string: 5,
  char: 6,
  bool: 7,
  array: 8,
  set: 9,
  map: 10,
  func: 11,
};

const isNumericType = t => t === 'complex' || t === 'complex_int' || t === 'real' || t === 'real_int' || t === 'bool' || t === 'char';
const isIntType = t => t === 'real_int' || t === 'complex_int' || t === 'bool' || t === 'char';
const isRealType = t => t === 'real_int' || t === 'real' || t === 'bool' || t === 'char';

function castingError(obj, type, implicit = false) {
  if (type in types) throw new Error(`[${errors.CAST_ERROR}] Type Error: Cannot ${implicit ? 'implicitly ' : ''}cast ${typeof obj} ${typeOf(obj)} to ${type}`);
  throw new Error(`[${errors.TYPE_ERROR}] Type Error: unknown type '${type}'`);
}

function typeOf(arg) {
  if (typeof arg.type === 'function') return arg.type();
  if (arg === undefined) return 'undefined';
  if (arg === null) return 'null';
  return 'unknown';
}

module.exports = { types, isNumericType, isIntType, isRealType, castingError, typeOf };