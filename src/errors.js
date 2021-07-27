const { consoleColours } = require("./utils");

const errors = {
  BAD_ARG: 'EARG', // Argument error GENERAL
  ARG_COUNT: 'EARGCNT', // Argument Error: bad number of arguments
  BAD_IMPORT: 'EIMP', // Import error
  PROP: 'EPROP', // Cannot access given key/property
  SYNTAX: 'ESYTX', // General syntax error
  UNMATCHED_BRACKET: 'EBRCKT', // Unmatched bracket
  UNTERM_STRING: 'ESTR', // Unterminated string
  NAME: 'ENAME', // Name Error
  NULL_REF: 'ENULLREF', // Null reference error
  NOT_CALLABLE: 'ENCALL', // Unable to call given object
  CANT_COPY: 'ECOPY', // Error whilst copying type
  ASSIGN: 'EASSGN', // Assignment error
  DEL: 'EDEL', // Error whilst deleting value
  TYPE_ERROR: 'ETYPE', // Error to do with types
};

const errorDesc = {
  [errors.BAD_ARG]: `A bad or malformed argument was passed to a function, procedure or operator`,
  [errors.ARG_COUNT]: `An invalid number of arguments was passed to function, procedure or operator`,
  [errors.BAD_IMPORT]: `Error whilst importing a script via import()`,
  [errors.PROP]: `Error accessing a property of an object`,
  [errors.SYNTAX]: `A general syntax error (more information in error message)`,
  [errors.UNTERM_STRING]: `A string literal was not terminated when End Of Input was reached`,
  [errors.UNMATCHED_BRACKET]: `Found an unmatching/unexpected bracket`,
  [errors.NAME]: `A name (variable/function) cannot be found`,
  [errors.NULL_REF]: `Encountered a reference pointing to a null object (does not exist)`,
  [errors.NOT_CALLABLE]: `Attempted to call a non-callable object`,
  [errors.CANT_COPY]: `Error whilst copying a given object`,
  [errors.ASSIGN]: `Error whilst assigning to a given object`,
  [errors.DEL]: `Error whilst attempting to delete (remove) an object`,
  [errors.TYPE_ERROR]: `One or more types is invalid, unexpected or incorrect for the given context`,
};

/** Print error in a fancy way */
function printError(e, printFunction) {
  e.toString().split('\n').forEach(line => printFunction(`${consoleColours.Bright}${consoleColours.FgRed}[!] ${consoleColours.Reset}${line}\n`));
}

/** Print warning message in a fancy way */
function printWarn(msg, printFunction) {
  msg.toString().split('\n').forEach(line => printFunction(`${consoleColours.Bright}${consoleColours.FgYellow}[!] ${consoleColours.Reset}${line}\n`));
}

module.exports = { errors, errorDesc, printError, printWarn };