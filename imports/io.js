const { UndefinedValue, StringValue } = require("../src/evaluation/values");
const { RunspaceBuiltinFunction } = require("../src/runspace/Function");
const util = require("util");

function main(rs) {
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'print', { o: 'any' }, ({ o }) => {
    rs.io.output.write(o.toString());
    return new UndefinedValue(rs);
  }, 'prints object to the screen'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'println', { o: '?any' }, ({ o }) => {
    rs.io.output.write((o ? o.toString() : '') + '\n');
    return new UndefinedValue(rs);
  }, 'prints object to the screen followed by a newline'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'printr', { o: 'any' }, ({ o }) => {
    console.log(o);
    return new UndefinedValue(rs);
  }, 'prints object as represented internally to the screen'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'input', { prompt: '?string' }, async ({ prompt }) => {
    if (prompt) rs.io.output.write(prompt.toPrimitive("string"));
    const input = await (() => {
      return new Promise((resolve, reject) => {
        let oldh = rs.onLineHandler;
        rs.onLineHandler = (io, line) => {
          rs.onLineHandler = oldh;
          resolve(line);
        };
      });
    })();
    return new StringValue(rs, input);
  }, 'writes <prompt> and waits for input. Resumes execution flow and returnes inputted data when <Enter> is pressed'));

  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'clear', {}, () => {
    rs.io.output.write('\033c');
    return new UndefinedValue(rs);
  }, 'clears the screen'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'error', { msg: '?string' }, ({ msg }) => {
    throw new Error(msg ?? "<no message>");
  }, 'triggers an error'));
}

module.exports = main;