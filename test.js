const { RunspaceBuiltinFunction } = require("./src/runspace/Function");
const Runspace = require("./src/runspace/Runspace");
const process = require("process");

const rs = new Runspace();

rs.define(new RunspaceBuiltinFunction(rs, 'print', { o: '...any' }, ({ o }) => {
  process.stdout.write(o.map(x => x.toString()).join(' '));
  return o;
}, 'prints object to the screen'));


let x = rs.execute("a = 5; b = 10; print(a); print(b);");
console.log(x);