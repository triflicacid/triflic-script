const readline = require("readline");
const { exec } = require('child_process');
const crypto = require('crypto');

const STDIN = process.stdin, STDOUT = process.stdout;

/** Get user input from STDIN */
async function input(msg = '') {
  const instance = readline.createInterface({
    input: STDIN,
    output: STDOUT
  });
  return new Promise(function (resolve, reject) {
    instance.question(msg, x => {
      instance.close();
      resolve(x);
    });
  });
}

/** Run a system command */
async function system(command) {
  return new Promise((resolve, reject) => {
    exec(command.toString(), (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout);
      }
    });
  });
}

// https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.randomFillSync(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

module.exports = { input, system, uuidv4 };