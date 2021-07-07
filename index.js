const Environment = require("./src/env");
const { define } = require("./def");
const { input } = require("./utils");
const Complex = require("./Complex");

const env = new Environment();
define(env);

env.var('z', new Complex(1, 2));

(async function () {
  const msg = '> ';
  let x = await input(msg);
  while (x !== '.exit') {
    try {
      let out = env.eval(x);
      if (out !== undefined) console.log(out.toString());
    } catch (e) {
      e.toString().split('\n').forEach(line => console.log(`[!] ${line}`));
    }
    x = await input(msg);
  }
})();