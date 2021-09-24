const Complex = require("./maths/Complex");
const readline = require("readline");
const { errors } = require("./errors");
const { exec } = require('child_process');

const STDIN = process.stdin, STDOUT = process.stdout;

/** Get user input from STDIN */
async function input(msg = '') {
  const instance = readline.createInterface({
    input: STDIN,
    output: STDOUT
  });
  return new Promise(function (resolve, reject) {
    instance.question(msg, x => {
      instance.close();
      resolve(x);
    });
  });
}

/** Print */
function print(...args) {
  console.log(...args);
}

const consoleColours = {
  Reset: "\x1b[0m",
  Bright: "\x1b[1m",
  Dim: "\x1b[2m",
  Underscore: "\x1b[4m",
  Blink: "\x1b[5m",
  Reverse: "\x1b[7m",
  Hidden: "\x1b[8m",

  FgBlack: "\x1b[30m",
  FgRed: "\x1b[31m",
  FgGreen: "\x1b[32m",
  FgYellow: "\x1b[33m",
  FgBlue: "\x1b[34m",
  FgMagenta: "\x1b[35m",
  FgCyan: "\x1b[36m",
  FgWhite: "\x1b[37m",

  BgBlack: "\x1b[40m",
  BgRed: "\x1b[41m",
  BgGreen: "\x1b[42m",
  BgYellow: "\x1b[43m",
  BgBlue: "\x1b[44m",
  BgMagenta: "\x1b[45m",
  BgCyan: "\x1b[46m",
  BgWhite: "\x1b[47m",
};

const isDigit = x => x >= "0" && x <= "9";
const _regexWhitespace = /\s/;
const isWhitespace = x => _regexWhitespace.test(x);

const peek = (a, b = 1) => a[a.length - b];

/** Check that all input variables are real */
function assertReal(...args) {
  for (let arg of args) {
    arg = Complex.assert(arg);
    if (!arg.isReal()) throw new Error(`Real number expected, got ${arg}`);
  }
}

function prefixLines(str, prefix) {
  return str.split('\n').map(x => prefix + x).join('\n');
}

/** Return boolean value of an argv argument */
function getArgvBool(argv, arg, defaultValue = true) {
  if (argv[arg] === undefined) return defaultValue;
  if (argv[arg] === "false" || argv[arg] === "0") return false;
  return !!argv[arg];
}

function createEnum(obj) {
  const enumeration = {};
  for (let prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      enumeration[prop] = obj[prop];
      enumeration[obj[prop]] = prop;
    }
  }
  return enumeration;
}

const str = x => {
  try {
    return x.toString();
  } catch (e) {
    return String(x);
  }
};
const bool = x => {
  if (x === "false" || x === "0") return false;
  return !!x;
};

const createTokenStringParseObj = (rs, str, pos, depth, terminateOn = [], allowMultiline = true) => ({
  rs,
  string: str,
  pos,
  depth, // Array of TokenLine objects
  lines: [],
  comment: '',
  terminateOn, // When depth>0 and this this found, set value to what caused the breakage and break
  allowMultiline,
});

const createEvalObj = (blockID, lineID) => ({
  action: 0, // 0 -> nothing; 1 -> break; 2 -> continue; 3 -> return; 4 -> goto;
  actionValue: undefined,
  blockID, // ID of current block we are in
  lineID, // Current line number
});

/** Propagate actions from obj1 -> obj2 */
const propagateEvalObj = (obj1, obj2) => {
  obj2.action = obj1.action;
  obj2.actionValue = obj1.actionValue;
};

/** Check if prititive arrays are equal */
function arraysEqual(a1, a2) {
  let len = Math.max(a1.length, a2.length);
  for (let i = 0; i < len; i++) {
    if (a1[i] !== a2[i]) return false;
  }
  return true;
}

/** Sum of array of complex numbers */
const sum = arr => arr.reduce((a, x) => a.add(x), new Complex(0));
const sort = arr => [...arr].sort((a, b) => a - b);

/** Check if two Values are equal */
function equal(a, b) {
  const basic = a === b;
  if (basic) return basic;

  let bool;
  try {
    bool = a.castTo('any').__eq__(b);
  } catch (e) {
    return false;
  }
  return bool && bool.toPrimitive('bool');
}

/** Find and return index of <item> in pritmitive <array> */
function findIndex(item, array) {
  for (let i = 0; i < array.length; i++) if (equal(item, array[i])) return i;
  return -1;
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

/** Return intersection between two primitive arrays */
const intersect = (a, b) => a.filter(v => findIndex(v, b) !== -1);

/** Difference between two primitive arrays: diff([1,2], [5,1]) = [2] */
const arrDifference = (a, b) => a.filter(v => findIndex(v, b) === -1);

function arrRepeat(array, count) {
  if (count < 1) return [];
  const out = [];
  for (let i = 0; i < count; i++) out.push(...array);
  return out;
}

/** Print error in a fancy way */
function printError(e, printFunction) {
  e.toString().split('\n').forEach(line => printFunction(`${consoleColours.Bright}${consoleColours.FgRed}[!] ${consoleColours.Reset}${line}\n`));
}

/** Print warning message in a fancy way */
function printWarn(msg, printFunction) {
  msg.toString().split('\n').forEach(line => printFunction(`${consoleColours.Bright}${consoleColours.FgYellow}[!] ${consoleColours.Reset}${line}\n`));
}

/** Error with matching brackets */
function throwMatchingBracketError(open, close, pos) {
  throw new Error(`[${errors.UNMATCHED_BRACKET}] Syntax Error: unexpected bracket token '${open}' at position ${pos}; no matching '${close}' found.`);
}

/** Error for too many statements. Got is a Token */
function expectedSyntaxError(expected, got) {
  throw new Error(`[${errors.SYNTAX}] Syntax Error: expected ${expected} but got ${got} at position ${got.pos}`);
}

/** sort an object by longest key */
function sortObjectByLongestKey(o) {
  let newo = {}, keys = Object.keys(o).sort((a, b) => a.length > b.length ? -1 : 1);
  keys.forEach(key => newo[key] = o[key]);
  return newo;
}

/** Return character as extracted from an escape sequence. Return { char: string, pos: number }. Return new position in string. */
function decodeEscapeSequence(string, pos) {
  let char;
  switch (string[pos]) {
    case 'b': char = String.fromCharCode(0x8); pos++; break; // BACKSPACE
    case 'n': char = String.fromCharCode(0xA); pos++; break; // LINE FEED
    case 'r': char = String.fromCharCode(0xD); pos++; break; // CARRIAGE RETURN
    case 't': char = String.fromCharCode(0x9); pos++; break; // HORIZONTAL TAB
    case 'v': char = String.fromCharCode(0xB); pos++; break; // VERTICAL TAB
    case '0': char = String.fromCharCode(0x0); pos++; break; // NULL
    case 's': char = String.fromCharCode(0x20); pos++; break; // WHITESPACE
    case 'x': { // HEXADECIMAL ESCAPE SEQUENCE
      pos++;
      let nlit = '';
      while (string[pos] && /[0-9A-Fa-f]/.test(string[pos])) {
        nlit += string[pos];
        pos++;
      }
      if (nlit.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: Invalid hexadecimal escape sequence. Expected hexadecimal character, got '${string[pos]}'`);
      char = String.fromCharCode(parseInt(nlit, 16));
      break;
    }
    case 'o': { // OCTAL ESCAPE SEQUENCE
      pos++;
      let nlit = '';
      while (string[pos] && /[0-7]/.test(string[pos])) {
        nlit += string[pos];
        pos++;
      }
      if (nlit.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: Invalid octal escape sequence. Expected octal character, got '${string[pos]}'`);
      char = String.fromCharCode(parseInt(nlit, 8));
      break;
    }
    case 'd': { // DECIMAL ESCAPE SEQUENCE
      pos++;
      let nlit = '';
      while (string[pos] && /[0-9]/.test(string[pos])) {
        nlit += string[pos];
        pos++;
      }
      if (nlit.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: Invalid decimal escape sequence. Expected decimal character, got '${string[pos]}'`);
      char = String.fromCharCode(parseInt(nlit, 10));
      break;
    }
  }
  return { char, pos };
}

/** Run a system command */
async function system(command) {
  return new Promise((resolve, reject) => {
    exec(command.toString(), (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout);
      }
    });
  });
}

module.exports = {
  system, input, print, consoleColours, peek, isDigit, isWhitespace, prefixLines, getArgvBool, assertReal, createEnum, str, bool, createTokenStringParseObj, createEvalObj, propagateEvalObj, arraysEqual, sort, sum, equal, findIndex, removeDuplicates, intersect, arrDifference, arrRepeat, printError, printWarn, throwMatchingBracketError, expectedSyntaxError, sortObjectByLongestKey, decodeEscapeSequence
};