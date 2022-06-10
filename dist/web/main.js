const Runspace = require("../../src/runspace/Runspace");
const { define, defineVars, defineFuncs } = require("../../src/init/def");
const createDefaultArgs = require("../../src/init/args-default");
const { StringValue } = require("../../src/evaluation/values");
const { RunspaceBuiltinFunction } = require("../../src/runspace/Function");

window.addEventListener("load", async () => {
  function startEventLoop(rs) {
    return new Promise((res) => {
      const loop = () => {
        for (let [pid, proc] of rs._procs) {
          // console.log(`PROCESS CALLBACK: PID=${pid}; STATE=${proc.state}; VAL=${proc.stateValue}`);
          // Destroy (remove) process if: killed, or finished first execution cycle
          if (proc.state === 3) rs.destroy_process(pid);
          else if (proc.state === 0 && proc.stateValue && !proc.persistent) {
            rs.destroy_process(pid);
          } else if (proc.state === 2) { // Error. Print to STDOUT
            stdwrite(proc.stateValue.toString() + '\n');
            rs.terminate_process(pid, 1, true);
          }
        }
        if (rs._procs.size > 0) setTimeout(loop, 1); // Iterate again if more processes
        else res(true); // If no processes, exit event loop as DONE
      };

      loop();
    });
  }

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
  const opts = createDefaultArgs();
  opts.app = "WEB";
  opts.file = window.location.hostname;
  const rs = new Runspace(opts);
  define(rs);
  defineVars(rs);
  defineFuncs(rs);
  const pid = rs.create_process(), mainProc = rs.get_process(pid);
  mainProc.persistent = true;
  mainProc.imported_files.push('<textarea>');

  const iTimeExecution = document.createElement("input");
  iTimeExecution.type = "checkbox";
  iTimeExecution.checked = opts.timeExecution;
  document.body.appendChild(iTimeExecution);
  iTimeExecution.addEventListener('click', () => opts.timeExecution = !opts.timeExecution);
  document.body.insertAdjacentHTML("beforeend", "Time execution");

  rs.defineVar('argv', rs.generateArray(), 'Arguments provided to the program');

  // I/O functions
  function stdwrite(...text) {
    stdout.value += text.join(' ');
    stdout.scrollTop = stdout.scrollHeight;
  }

  // Evaluate some input
  async function evaluate(input) {
    await rs.exec(pid, input);
    if (mainProc.state === 0) {
      if (mainProc.stateValue.status < 0) {
        stdwrite("Process exited with code " + mainProc.stateValue.statusValue + "\n");
        rs.terminate_process(pid, 0, true);
      } else {
        stdwrite(mainProc.stateValue.ret.toString() + "\n");
        if (opts.timeExecution) {
          stdwrite(`** Took ${time} ms (${mainProc.stateValue.parse} ms parsing, ${mainProc.stateValue.exec} ms execution)\n`);
        }
      }
    }
  }

  // Basic I/O functions
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'exit', { c: '?real_int' }, ({ c }) => {
    alert(`>> EXITING WITH CODE ${c ? c.toString() : 0}`);
    window.location.reload();
    return c;
  }, 'Exit the current session'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'print', { o: 'any' }, ({ o }) => {
    stdwrite(o.toString());
    return rs.UNDEFINED;
  }, 'Prints object to stdout'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'println', { o: '?any' }, ({ o }) => {
    stdwrite((o ? o.toString() : '') + '\n');
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

  await startEventLoop(rs);
});

/** Read a file as text */
export async function freadText(file, encoding = undefined) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => void resolve(reader.result);
    reader.readAsText(file, encoding);
  });
}