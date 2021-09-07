/** NB Functions used in parsing */

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
/**
 * Like parseFloat
 * @param {string} string
 * @param {boolean} allowExponent allow exponent '...e...' in number?
 * @param {string} seperator permitted seperator between digits. Must be of length = 1
 * @returns {object} Return information about extracted number, such as string, sign, exponent, radix...
 */
function parseNumber(string, allowExponent = true, seperator = '_') {
  let pos = 0, sign = 1, strBeforeDot = '', strAfterDot = '', radix = 10, exp = null;
  let metSign = false, metDigitBeforeDecimal = false, metDot = false, metDigitAfterDecimal = false, metE = false;

  for (pos = 0; pos < string.length; pos++) {
    if (!metSign && (string[pos] === '-' || string[pos] === '+')) {
      metSign = true;
      sign = string[pos] === '-' ? -1 : 1;
    } else if (string[pos] in radices) {
      if (strBeforeDot === '0') {
        strBeforeDot = '';
        radix = radices[string[pos]];
      } else {
        break; // INVALID
      }
    } else if (radicesRegex[radix].test(string[pos])) {
      if (!metSign) metSign = true; // Default to '+'
      if (metDot) {
        strAfterDot += string[pos];
        metDigitAfterDecimal = true;
      } else {
        strBeforeDot += string[pos];
        metDigitBeforeDecimal = true;
      }
    } else if (string[pos] === '.') {
      if (!metDot) {
        metDot = true;
      } else {
        break; // INVALID
      }
    } else if (string[pos].toLowerCase() === 'e') {
      if (allowExponent) {
        const obj = parseNumber(string.substr(pos + 1), false, seperator);
        if (obj.str === '') break;
        pos += 1 + obj.pos;
        exp = obj;
        break;
      } else {
        break; // INVALID
      }
    } else if (string[pos] === seperator) {
      if (metDot && !metDigitAfterDecimal) break;
      if (!metDigitBeforeDecimal) break;
    } else {
      break; // INVALID
    }
  }

  if (strBeforeDot !== '') strBeforeDot = parseInt(strBeforeDot, radix);
  if (strAfterDot !== '') strAfterDot = parseInt(strAfterDot, radix);
  let str = strBeforeDot + (metDot ? '.' + strAfterDot : '');
  if (str === '.' || str.startsWith('.e')) {
    pos = 0;
    str = '';
  }

  let num = sign * +str, base = num;
  if (exp) {
    num *= Math.pow(10, exp.num);
    str += 'e' + exp.str;
    exp = exp.num;
  }
  return { pos, str: string.substring(0, pos), sign, base, exp, radix, num };
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
  const rStart = /[A-Za-z_$ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρςστυφχψω∞√∛∑]/;
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