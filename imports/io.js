const { UndefinedValue, StringValue } = require("../src/evaluation/values");
const { RunspaceBuiltinFunction } = require("../src/runspace/Function");

function main(rs, pid) {
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'print', { o: { type: 'any', ellipse: true } }, async ({ o }, eo) => {
    const items = [];
    for (let x of o.value) items.push(await x.toString(eo));
    rs.io.output.write(items.join(" "));
    return new UndefinedValue(rs);
  }, 'prints object(s) to the screen'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'printf', { o: 'any', options: { type: 'array', optional: true, ellipse: true } }, ({ o, options }, evalObj) => {
    let formatted = options ? o.castTo('string', evalObj).format(options.toPrimitive('array')) : o.castTo('string', evalObj);
    rs.io.output.write(formatted.toString());
    return new UndefinedValue(rs);
  }, 'format object with options (strformat) and print to screen'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'println', { o: { type: 'any', ellipse: true, optional: true } }, async ({ o }, eo) => {
    const items = [];
    for (let x of o.value) items.push(await x.toString(eo));
    rs.io.output.write(items.join(" ") + '\n');
    return new UndefinedValue(rs);
  }, 'prints object(s) to the screen followed by a newline'), pid);
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