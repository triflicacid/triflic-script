const { decodeEscapeSequence } = require('../utils');

/** Parse and return extracted string from string[startIndex] to " */
function parseString(string, startIndex) {
  let seq = '', j = startIndex + 1;
  while (true) {
    if (string[j] === '"') break;
    if (string[j] === '\\' && string[j + 1]) { // ESCAPE SEQUENCE
      ++j;
      const obj = decodeEscapeSequence(string, j);
      if (obj.char) {
        j = obj.pos;
        seq += obj.char;
        continue;
      }
    }
    if (string[j] === undefined) throw new Error(`Unexpected end of input in string literal at position ${j}`);
    seq += string[j];
    j++;
  }
  return { string: seq, endIndex: j };
}

/** Parse argument string, return object. All non-named elements are pushed to obj._ */
function parseArgstring(argstr) {
  const data = { _: [] };
  let current = "";
  for (let i = 0; i < argstr.length;) {
    if (argstr[i] === "-") {
      ++i;
      if (argstr[i] === "-") {
        ++i;
        current = "";
        for (; i < argstr.length && argstr[i] !== ' '; ++i) current += argstr[i];
        data[current] = true;
        // current = undefined;
      } else {
        current = "";
        for (; i < argstr.length && argstr[i] !== ' '; ++i) current += argstr[i];
        data[current] = true;
        // current = undefined;
      }
    } else if (argstr[i] === " ") {
      i++;
    } else if (argstr[i] === "\"") {
      let res = parseString(argstr, i);
      i = res.endIndex + 1;
      if (current) {
        data[current] = res.string;
        current = undefined;
      } else {
        data._.push(res.string);
      }
    } else {
      let thing = "";
      for (; i < argstr.length && argstr[i] !== ' '; ++i) thing += argstr[i];
      if (current) {
        data[current] = thing;
        current = undefined;
      } else {
        data._.push(thing);
      }
    }
  }
  return data;
}

function argvBool(argv, arg, _default) {
  if (argv[arg] === undefined) return _default;
  return argv[arg] === true || argv[arg] === "true" || argv[arg] === "0";
}

/** Populate argv object */
function parseArgString(args) {
  let argv = parseArgstring(args);
  const obj = {
    prompt: argv.prompt === undefined ? '>> ' : argv.prompt.toString(),
    imag: argv.imag,
    bidmas: argvBool(argv, "bidmas", true),
    multiline: argvBool(argv, "multiline", false),
    timeExecution: argvBool(argv, "time", false),
    _: argv._,
  };
  for (let key in argv) {
    if (!(key in obj)) {
      obj[key] = argv[key];
    }
  }
  return obj;
}

module.exports = { parseArgString };