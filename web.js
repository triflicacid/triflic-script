const Runspace = require("./src/runspace/Runspace");
const { define, defineVars, defineFuncs } = require("./src/init/def");
const { primitiveToValueClass, ArrayValue, NumberValue, StringValue } = require("./src/evaluation/values");
const { RunspaceBuiltinFunction } = require("./src/runspace/Function");

const argv = []; // string[]

window.addEventListener("load", async () => {
  document.title = `${Runspace.LANG_NAME} v${Runspace.VERSION}`;

  // Build webpage
  document.body.insertAdjacentHTML("beforeend", "<h2>STDIN</h2>");
  const stdin = document.createElement("textarea");
  stdin.classList.add("stdin");
  stdin.id = "stdin";
  document.body.appendChild(stdin);
  document.body.insertAdjacentHTML("beforeend", "<br>");
  const btnExec = document.createElement("button");
  btnExec.innerText = "Execute";
  document.body.appendChild(btnExec);
  const inputFile = document.createElement("input");
  inputFile.type = "file";
  inputFile.addEventListener("change", async () => {
    const file = inputFile.files[0];
    if (file) {
      const string = await freadText(file);
      stdout.value += opts.prompt + `[file: ${file.name}] \n`;
      await evaluate(string);
    }
  });
  const btnUpload = document.createElement("button");
  btnUpload.innerText = "Upload File";
  btnUpload.addEventListener("click", () => inputFile.click());
  document.body.appendChild(btnUpload);
  let btnClear = document.createElement("button");
  btnClear.innerText = "Clear";
  btnClear.addEventListener("click", () => stdin.value = '');
  document.body.appendChild(btnClear);

  document.body.insertAdjacentHTML("beforeend", "<h2>STDOUT</h2>");
  const stdout = document.createElement("textarea");
  stdout.classList.add("stdout");
  stdout.id = "stdout";
  stdout.setAttribute("readonly", "readonly");
  document.body.appendChild(stdout);
  document.body.insertAdjacentHTML("beforeend", "<br>");
  btnClear = document.createElement("button");
  btnClear.innerText = "Clear";
  btnClear.addEventListener("click", () => stdout.value = '');
  document.body.appendChild(btnClear);
  document.body.insertAdjacentHTML("beforeend", "<hr>");


  // Create runspace instance
  const opts = {
    strict: false,
    defineVars: true,
    defineFuncs: true,
    prompt: '>> ',
    intro: true,
    niceErrors: true,
    ans: true,
    imag: "i",
    bidmas: true,
    revealHeaders: true,
    multiline: true,
    timeExecution: false,
  };
  opts.app = "web";
  opts.file = window.location.hostname;
  const rs = new Runspace(opts);
  define(rs);
  defineVars(rs);
  defineFuncs(rs);
  rs.importFiles.push('<stdin>');
  rs.deleteVar('import');
  rs.deleteVar('system');

  const iTimeExecution = document.createElement("input");
  iTimeExecution.type = "checkbox";
  iTimeExecution.checked = opts.timeExecution;
  document.body.appendChild(iTimeExecution);
  iTimeExecution.addEventListener('click', () => opts.timeExecution = !opts.timeExecution);
  document.body.insertAdjacentHTML("beforeend", "Time execution");

  rs.defineVar('argv', new ArrayValue(rs, argv.map(v => primitiveToValueClass(rs, v))), 'Arguments provided to the program');
  rs.defineVar('VERSION', new NumberValue(rs, Runspace.VERSION), 'Current version of ' + Runspace.LANG_NAME);

  // I/O functions
  function print(...text) {
    stdout.value += text.join(' ');
    stdout.scrollTop = stdout.scrollHeight;
  }

  // Evaluate some input
  async function evaluate(input) {
    let output, err, time, execObj = {};
    try {
      let start = Date.now();
      output = await rs.execute(input, undefined, execObj);
      time = Date.now() - start;
      if (output !== undefined) output = output.toString();
    } catch (e) {
      err = e;
    }

    if (err) {
      if (opts.niceErrors) {
        print(err.toString() + '\n');
      } else {
        console.trace(err);
      }
    } else {
      if (output !== undefined) {
        print(output + '\n');
      }
      if (opts.timeExecution) {
        print(`** Took ${time} ms (${execObj.parse} ms parsing, ${execObj.exec} ms execution)\n`);
      }
    }
    return execObj.status;
  }

  // Basic I/O functions
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'exit', { c: '?real_int' }, ({ c }) => {
    alert(`>> EXITING WITH CODE ${c.toString()}`);
    window.location.reload();
    return c;
  }, 'Exit the current session'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'print', { o: 'any' }, ({ o }) => {
    print(o.toString());
    return rs.UNDEFINED;
  }, 'Prints object to stdout'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'println', { o: '?any' }, ({ o }) => {
    print((o ? o.toString() : '') + '\n');
    return rs.UNDEFINED;
  }, 'prints object to stdout followed by a newline'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'input', { prompt_: '?string', default_: '?string' }, async ({ prompt_, default_ }) => {
    const input = prompt(prompt_, default_) ?? rs.UNDEFINED;
    return new StringValue(rs, input);
  }, 'writes <prompt> and waits for input. Resumes execution flow and returnes inputted data when <Enter> is pressed'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'clear', {}, () => {
    stdout.value = '';
    return rs.UNDEFINED;
  }, 'Clears stdout'));

  // Add event listener for input
  async function evaluateHtml() {
    if (stdin.value.length > 0) {
      stdout.value += opts.prompt + stdin.value + '\n';
      await evaluate(stdin.value);
      stdin.value = '';
    }
  }

  btnExec.addEventListener("click", () => evaluateHtml());
  document.body.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && e.key === "Enter") {
      await evaluateHtml();
      stdin.focus();
    }
  });
});

/** Read a file as text */
export async function freadText(file, encoding = undefined) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => void resolve(reader.result);
    reader.readAsText(file, encoding);
  });
}