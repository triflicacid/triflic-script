const types = {
  any: 0, // Keep original Token type
  complex: 1, // Complex number 'a + bi'
  complex_int: 2, // Complex number {a, b} are integers
  real: 3, // Real number 'a + 0i'
  real_int: 4, // Real number where {a} is an integer
  string: 5,
  bool: 6,
  array: 7,
  set: 8,
  map: 9,
  func: 10,
};

const isNumericType = t => t === 'complex' || t === 'complex_int' || t === 'real' || t === 'real_int' || t === 'bool';
const isIntType = t => t === 'real_int' || t === 'complex_int' || t === 'bool';

function castingError(obj, type, implicit = false) {
  if (type in types) throw new Error(`Type Error: Cannot ${implicit ? 'implicitly ' : ''}cast ${typeof obj} ${typeOf(obj)} to ${type}`);
  throw new Error(`Type Error: unknown type '${type}'`);
}

function typeOf(arg) {
  if (typeof arg.type === 'function') return arg.type();
  if (arg === undefined) return 'undefined';
  if (arg === null) return 'null';
  return 'unknown';
}

module.exports = { types, isNumericType, isIntType, castingError, typeOf };