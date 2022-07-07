/** NB Functions used in parsing */

const { base_to_float } = require("../utils.js");

const operators = require("./operators");

const bracketMap = {
  "[": "]", "]": "[",
  "(": ")", ")": "(",
  "{": "}", "}": "{",
};
const bracketValues = {
  "[": 1, "]": -1,
  "(": 1, ")": -1,
  "{": 1, "}": -1,
};
/** Return position of matching bracket in program */
function getMatchingBracket(pos, program) {
  if (bracketMap[program[pos]] === undefined) {
    throw new Error("Unexpected token '" + program[pos] + "' at position " + pos + ": cannot match token");
  }
  let open_groups = 0, i = pos;
  let add = bracketValues[program[pos]]; // Look forward if hnting closing, else backwards
  let openingBracket, closingBracket;
  if (add === 1) {
    openingBracket = program[pos];
    closingBracket = bracketMap[openingBracket];
  } else {
    closingBracket = program[pos];
    openingBracket = bracketMap[closingBracket];
  }

  while (i > -1 && i < program.length) {
    if (program[i] == closingBracket)
      open_groups--;
    else if (program[i] == openingBracket)
      open_groups++;
    if (open_groups == 0)
      return i;
    i += add; // Move to next token
  }

  throw new Error("No matching bracket found for '" + program[pos] + "' in position " + pos);
}

const radices = { x: 16, d: 10, b: 2, o: 8 };
const radicesRegex = { 16: /[0-9A-Fa-f]/, 10: /[0-9]/, 2: /[01]/, 8: /[0-7]/ };
function parseNumber(string, opts = {}) {
  var _a, _b, _c;
  (_a = opts.exponent) !== null && _a !== void 0 ? _a : (opts.exponent = true);
  (_b = opts.decimal) !== null && _b !== void 0 ? _b : (opts.decimal = true);
  (_c = opts.signed) !== null && _c !== void 0 ? _c : (opts.signed = true);
  let pos = 0, sign = 1, strBeforeDot = '', strAfterDot = '', radix = 10, exp = null;
  let metSign = !opts.signed, metDigitBeforeDecimal = false, metDot = false, metDigitAfterDecimal = false, metE = false, metSeperator = false, metRadix = false, metImag = false;
  for (pos = 0; pos < string.length; pos++) {
    if (!metSign && (string[pos] === '-' || string[pos] === '+')) { // Sign
      metSign = true;
      sign = string[pos] === '-' ? -1 : 1;
      metSeperator = false;
    }
    else if (pos === 0 && string[pos] === '0' && string[pos + 1] in radices) { // Radix
      pos++;
      radix = radices[string[pos]];
    }
    else if (radicesRegex[radix].test(string[pos])) { // Digit
      metSeperator = false;
      if (!metSign)
        metSign = true; // Default to '+'
      if (metDot) {
        strAfterDot += string[pos];
        metDigitAfterDecimal = true;
      }
      else {
        strBeforeDot += string[pos];
        metDigitBeforeDecimal = true;
      }
    }
    else if (opts.decimal && string[pos] === '.') { // seperator
      if (metSeperator)
        throw new Error("Invalid syntax: expected digit in number literal");
      if (!metDot) {
        metDot = true;
      }
      else {
        break; // INVALID
      }
    }
    else if (string[pos].toLowerCase() === 'e') {
      if (metSeperator)
        throw new Error("Invalid syntax: expected digit in number literal");
      metSeperator = false;
      if (opts.exponent) {
        const newOpts = Object.assign({}, opts);
        newOpts.exponent = false;
        const obj = parseNumber(string.substr(pos + 1), newOpts);
        if (obj.str === '')
          break;
        pos += 1 + obj.pos;
        exp = obj;
        break;
      }
      else {
        break; // INVALID
      }
    }
    else if (opts.seperator && string[pos] === opts.seperator) {
      if (metSeperator) {
        throw new Error(`Invalid number literal: unexpected seperator`);
      }
      else {
        if (metDot && !metDigitAfterDecimal)
          break;
        if (!metDigitBeforeDecimal)
          break;
        metSeperator = true;
      }
    }
    else {
      break; // INVALID
    }
  }
  if (opts.imag && (strBeforeDot !== '' || strAfterDot !== '') && string[pos] === opts.imag) {
    pos++;
    metImag = true;
  }
  let str = strBeforeDot + (metDot ? '.' + strAfterDot : '');
  if (str === '.' || str.startsWith('.e')) {
    pos = 0;
    str = '';
  }
  let num = sign * base_to_float(str, radix), base = num, nexp = 1;
  if (exp) {
    num *= Math.pow(10, exp.num);
    str += 'e' + exp.str;
    nexp = exp.num;
  }

  return { pos, str: string.substring(0, pos), sign, base, exp: nexp, radix, num, imag: metImag };
}

/** Requires Runspace instance */
function parseOperator(string) {
  for (let operator in operators) {
    if (operators.hasOwnProperty(operator) && !operators[operator].hidden) {
      let snippet = string.substr(0, operator.length);
      if (operator === snippet) return operator;
    }
  }
  return null;
}

/** Parse a symbol name */
function parseSymbol(string) {
  const rStart = /[A-Za-z_$]/;
  const rRest = /[0-9]/;
  if (!rStart.test(string[0])) return null;
  let symbol = string[0];
  for (let i = 1; i < string.length; i++) {
    if (rStart.test(string[i]) || rRest.test(string[i])) {
      symbol += string[i];
    } else {
      break;
    }
  }
  return symbol;
}

module.exports = {
  bracketMap, bracketValues, getMatchingBracket,
  parseOperator, parseNumber, parseSymbol,
};