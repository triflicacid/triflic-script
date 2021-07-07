const Environment = require("./src/env");
const { define } = require("./src/def");
const { input, print } = require("./src/utils");
const { FgRed, Reset, Bright } = require("./src/console-colours");

const env = new Environment();
define(env);

env.eval(`f(x) = equals(OMEGA, W(x))`);

(async function () {
  let prompt = '>>> ', inp;
  while (true) {
    inp = await input(prompt);
    try {
      let out = env.eval(inp);
      if (out !== undefined) print(out.toString() + '\n');
    } catch (e) {
      e.toString().split('\n').forEach(line => print(`${Bright}${FgRed}[!] ${Reset}${line}\n`));
    }
  }
})();