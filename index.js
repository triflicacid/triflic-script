const Environment = require("./src/env");
const { define } = require("./def");
const readline = require("readline");
const Complex = require("./Complex");

async function input(msg = '') {
  const instance = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(function (resolve, reject) {
    instance.question(msg, x => {
      instance.close();
      resolve(x);
    });
  });
}

const env = new Environment();
define(env);

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