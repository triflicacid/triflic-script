const Environment = require("./src/env");
const { define } = require("./def");
const { input } = require("./utils");

const env = new Environment();
define(env);

(async function () {
  let prompt = '>>> ', inp;
  while (true) {
    inp = await input(prompt);
    try {
      let out = env.eval(inp);
      if (out !== undefined) console.log(out.toString());
    } catch (e) {
      e.toString().split('\n').forEach(line => console.log(`[!] ${line}`));
    }
  }
})();