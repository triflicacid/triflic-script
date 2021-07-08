const Environment = require("./src/env");
const { define } = require("./src/def");
const { input, print } = require("./src/utils");
const { FgRed, Reset, Bright, } = require("./src/console-colours");

const env = new Environment();
define(env);

(async function () {
  print(`JS Maths CLI at ${Date.now()}\nType help() for basic help\n`);
  let prompt = '>>> ', inp;
  while (true) {
    inp = await input(prompt);
    try {
      let out = env.eval(inp);
      if (out !== undefined) print(out.toString());
    } catch (e) {
      e.toString().split('\n').forEach(line => print(`${Bright}${FgRed}[!] ${Reset}${line}`));
    }
  }
})();