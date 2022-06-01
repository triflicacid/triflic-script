const { errors } = require("../errors");

const types = new Set();
types.add('any');
types.add('complex'); // a + bi
types.add('complex_int'); // a + bi, a, b are ints
types.add('real'); // a
types.add('real_int'); // a, a is an int
types.add('string'); // "..."
types.add('char'); // '...', behaves as real
types.add('bool'); // true, false
types.add('array'); // [...]
types.add('set'); // {a, b, ...}
types.add('map'); // {a: b, ...}
types.add('func');

const isNumericType = t => t === 'complex' || t === 'complex_int' || t === 'real' || t === 'real_int' || t === 'bool' || t === 'char';
const isIntType = t => t === 'real_int' || t === 'complex_int' || t === 'bool' || t === 'char';
const isRealType = t => t === 'real_int' || t === 'real' || t === 'bool' || t === 'char';

function castingError(obj, type, implicit = false) {
  if (types.has(type)) throw new Error(`[${errors.CAST_ERROR}] Type Error: Cannot ${implicit ? 'implicitly ' : ''}cast ${typeof obj} ${typeOf(obj)} to ${type}`);
  throw new Error(`[${errors.TYPE_ERROR}] Type Error: unknown type '${type}'`);
}

function typeOf(arg) {
  if (typeof arg.type === 'function') return arg.type();
  if (arg === undefined) return 'undefined';
  if (arg === null) return 'null';
  return 'unknown';
}

module.exports = { types, isNumericType, isIntType, isRealType, castingError, typeOf };