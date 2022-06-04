const { UndefinedValue, StringValue } = require("../src/evaluation/values");
const { RunspaceBuiltinFunction } = require("../src/runspace/Function");

function main(rs, pid) {
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'print', { o: 'any' }, ({ o }) => {
    rs.io.output.write(o.toString());
    return new UndefinedValue(rs);
  }, 'prints object to the screen'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'printf', { o: 'any', options: { type: 'array', optional: true, ellipse: true } }, ({ o, options }) => {
    let formatted = options ? o.castTo('string').format(options.toPrimitive('array')) : o.castTo('string');
    rs.io.output.write(formatted.toString());
    return new UndefinedValue(rs);
  }, 'format object with options (strformat) and print to screen'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'println', { o: '?any' }, ({ o }) => {
    rs.io.output.write((o ? o.toString() : '') + '\n');
    return new UndefinedValue(rs);
  }, 'prints object to the screen followed by a newline'), pid);
  // rs.defineFunc(new RunspaceBuiltinFunction(rs, 'printr', { o: 'any' }, ({ o }) => {
  //   console.log(o.castTo('any'));
  //   return new UndefinedValue(rs);
  // }, 'prints object as represented internally to the screen'), pid);
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
  }, 'writes <prompt> and waits for input. Resumes execution flow and returnes inputted data when <Enter> is pressed'), pid);

  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'clear', {}, () => {
    rs.io.output.write('\033c');
    return new UndefinedValue(rs);
  }, 'clears the screen'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'error', { msg: '?string' }, ({ msg }) => {
    throw new Error(msg ?? "<no message>");
  }, 'triggers an error'), pid);
}

module.exports = main;