const { errors } = require("../errors");

const types = new Set();
const typeOverlap = new Map(); // type => Set<type> or '*'. Indicates which types overlap with what
const typeStrictAssertAllow = new Map(); // type => Set<type>. Indicates which types may be assigned when strict type assertion is enabled

function addType(name, overlap = [], strictAssertAllow = []) {
  types.add(name);
  typeOverlap.set(name, overlap === '*' ? '*' : new Set(overlap));
  typeStrictAssertAllow.set(name, overlap === '*' ? '*' : new Set(strictAssertAllow));
}

// Built-In types
addType('any', '*', '*');
addType('array'); // [...]
addType('bool'); // true, false
addType('char', ['string']); // '...', behaves as real
addType('complex', ['complex_int', 'real'], ['real']); // a + bi
addType('complex_int', undefined, ['complex', 'real']); // a + bi, a, b are ints
addType('func');
addType('map'); // {a: b, ...}
addType('object', 'map');
addType('real', ['bool', 'real_int', 'complex']); // a
addType('real_int', ['bool'], ['real']); // a, a is an int
addType('set'); // {a, b, ...}
addType('string'); // "..."

// Check if overlap between types
function isTypeOverlap(type, overlapWith) {
  if (type === overlapWith || type === 'any' || overlapWith === 'any') return true;
  let data = typeOverlap.get(type);
  if (data === undefined) return false;
  if (data === '*' || data.has(overlapWith)) return true;
  for (let subtype of data) if (isTypeOverlap(subtype, overlapWith)) return true;
  return false;
}

function isStrictAssertAllowed(type, assertTo) {
  if (type === assertTo || type === 'any' || assertTo === 'any') return true;
  let data = typeStrictAssertAllow.get(type);
  if (data === undefined) return false;
  if (data === '*' || data.has(assertTo)) return true;
  for (let subtype of data) if (isStrictAssertAllowed(subtype, assertTo)) return true;
  return false;
}

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

module.exports = { types, isNumericType, isIntType, isRealType, castingError, typeOf, addType, isTypeOverlap, typeOverlap, isStrictAssertAllowed };