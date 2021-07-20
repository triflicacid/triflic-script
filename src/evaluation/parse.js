/** NB Functions used in parsing */

const operators = require("./operators");
const { isDigit } = require("../utils");

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

/**
 * Like parseFloat
 * @param {string} string
 * @returns {{ n: number, pos: number }} Return number extracted and end pos
 */
function parseNumber(string) {
  // Stages 0 - start, 1 - encountered sign, 2 - encountered '.', 3 - encountered 'e'
  let nStr = '', stage = 0, i;
  for (i = 0; i < string.length; i++) {
    // Dot?
    if (string[i] === '.') {
      if (stage === 0 || stage === 1) {
        nStr += '.';
        stage = 2;
      } else {
        break;
      }
    }

    // Sign?
    else if (string[i] === '+' || string[i] === '-') {
      if (stage === 0 && nStr.length === 0) {
        nStr += string[i];
        stage = 1;
      } else {
        break;
      }
    }

    // 'e' ?
    else if (string[i] === 'e') {
      if (stage === 0) {
        break; // Here? What?
      } else if (stage >= 3) {
        break;
      } else {
        nStr += 'e';
        if (string[i + 1] === '+' || string[i + 1] === '-') nStr += string[++i];
        stage = 3;
      }
    }

    // Digit
    else if (isDigit(string[i])) {
      if (stage === 0) stage = 1; // Implicit sign
      nStr += string[i];
    } else {
      break;
    }
  }

  // Check for incomplete 'e' power
  let last2 = nStr[nStr.length - 2] + nStr[nStr.length - 1];
  if (last2 === 'e-' || last2 === 'e+') {
    nStr = nStr.substr(0, nStr.length - 2);
    i -= 2;
  }
  // Incomplete decimal? Incomplete sign?
  if (nStr === '.' || nStr === '-' || nStr === '+') {
    nStr = "";
    i--;
  }
  return { nStr, n: +nStr, pos: i };
}

/** Requires Runspace instance */
function parseOperator(rs, string) {
  if (arguments.length !== 2) throw new Error(`ParseOperator: required 2 arguments`);
  for (let operator in rs.operators) {
    if (rs.operators.hasOwnProperty(operator)) {
      let snippet = string.substr(0, operator.length);
      if (operator === snippet) return operator;
    }
  }
  return null;
}

/** Parse a variable name */
function parseVariable(string) {
  const rStart = /[A-Za-z_$ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρςστυφχψω∞]/;
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

/** Parse a function name */
function parseFunction(string) {
  const rStart = /[A-Za-z_$ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρςστυφχψω√∛∑]/;
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
  parseOperator, parseNumber, parseVariable, parseFunction,
};