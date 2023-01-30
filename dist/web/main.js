const Runspace = require("../../src/runspace/Runspace");
const { define, defineVars, defineFuncs } = require("../../src/init/def");
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
            if (proc.dieonerr !== false) rs.terminate_process(pid, 1, true);
            proc.state = 0;
          }
        }
        if (rs._procs.size > 0) setTimeout(loop, 1); // Iterate again if more processes
        else res(true); // If no processes, exit event loop as DONE
      };

      loop();
    });
  }

  // Create runspace instance
  const bits = location.pathname.split("/");
  const rs = new Runspace({
    app: 'WEB',
    file: bits[bits.length - 1],
    root: (location.hostname ? location.hostname + "/" : '') + bits.slice(0, bits.length - 1).join("/"),
    timeExec: false,
    bidmas: true,
    prompt: '>> ',
  });
  define(rs);
  defineVars(rs);
  defineFuncs(rs);
  const pid = rs.create_process(), mainProc = rs.get_process(pid);
  mainProc.persistent = true;
  mainProc.dieonerr = false;
  mainProc.imported_files.push('<web>');

  /** Get console prompt as JS String */
  const getPrompt = () => rs.opts.value.has("prompt") ? rs.opts.value.get("prompt").toString() : "";

  rs.defineVar('argv', rs.generateArray(), 'Arguments provided to the program');

  // Build webpage
  document.title = `${Runspace.LANG_NAME} v${Runspace.VERSION}`;
  const h1 = document.createElement('h1');
  h1.innerText = `${Runspace.LANG_NAME} v${Runspace.VERSION} Web Interpreter`;
  document.body.appendChild(h1);
  h1.insertAdjacentHTML("afterend", `<p><a href='help.html' target='_blank'>Help</a> | <a href="https://github.com/triflicacid/triflic-script" target="_blank">GitHub</a></p>`);
  let wrapper = document.createElement('div');
  wrapper.classList.add("stdin-wrapper");
  document.body.appendChild(wrapper);
  wrapper.insertAdjacentHTML("beforeend", "<h2>STDIN</h2>");
  const stdin = document.createElement("textarea");
  stdin.classList.add("stdin");
  stdin.id = "stdin";
  stdin.addEventListener("keydown", e => {
    if (e.key === "ArrowUp") {
      if (inputStackPtr > 0)
        inputStackPtr--;
      let value = inputStack[inputStackPtr];
      if (value !== undefined) stdin.value = value;
    } else if (e.key === "ArrowDown") {
      if (inputStackPtr < inputStack.length - 1)
        inputStackPtr++;
      let value = inputStack[inputStackPtr];
      if (value !== undefined) stdin.value = value;
    }
  })
  wrapper.appendChild(stdin);
  stdin.focus();
  wrapper.insertAdjacentHTML("beforeend", "<br>");
  const btnExec = document.createElement("button");
  btnExec.innerText = "Execute";
  btnExec.addEventListener("click", () => evaluateHtml());
  wrapper.appendChild(btnExec);
  const inputFile = document.createElement("input");
  inputFile.type = "file";
  inputFile.addEventListener("change", async () => {
    const file = inputFile.files[0];
    if (file) {
      const string = await freadText(file);
      stdin.value = "";
      stdout.value += getPrompt() + `[file: ${file.name}] \n`;
      await evaluate(string);
    }
  });
  const btnUpload = document.createElement("button");
  btnUpload.innerText = "Upload File";
  btnUpload.addEventListener("click", () => inputFile.click());
  wrapper.appendChild(btnUpload);
  let btnClear = document.createElement("button");
  btnClear.innerText = "Clear";
  btnClear.addEventListener("click", () => stdin.value = '');
  wrapper.appendChild(btnClear);
  wrapper.insertAdjacentHTML("beforeend", "<br>");
  const iTimeExecution = document.createElement("input");
  iTimeExecution.type = "checkbox";
  iTimeExecution.checked = rs.opts.value.get("timeExec").toPrimitive("bool");
  wrapper.appendChild(iTimeExecution);
  iTimeExecution.addEventListener('click', () => rs.opts.value.set("timeExec", iTimeExecution.checked ? rs.TRUE : rs.FALSE));
  wrapper.insertAdjacentHTML("beforeend", "Time execution");

  wrapper = document.createElement("div");
  wrapper.classList.add("stdout-wrapper");
  document.body.appendChild(wrapper);
  wrapper.insertAdjacentHTML("beforeend", "<h2>STDOUT</h2>");
  const stdout = document.createElement("textarea");
  stdout.classList.add("stdout");
  stdout.id = "stdout";
  stdout.value = `-- ${Runspace.LANG_NAME} v${Runspace.VERSION} --\nType help(), copyright() for more information.\n`;
  stdout.setAttribute("readonly", "readonly");
  wrapper.appendChild(stdout);
  wrapper.insertAdjacentHTML("beforeend", "<br>");
  btnClear = document.createElement("button");
  btnClear.innerText = "Clear";
  btnClear.addEventListener("click", () => stdout.value = '');
  wrapper.appendChild(btnClear);
  const btnDownload = document.createElement("button");
  btnDownload.innerText = "Download";
  btnDownload.addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = "data:text/plain;charset=utf-8," + encodeURIComponent(stdout.value);
    link.download = "stdout-" + new Date().toISOString();
    btnDownload.insertAdjacentElement("afterend", link);
    link.click();
    link.remove();
  });
  wrapper.appendChild(btnDownload);

  // I/O functions
  function stdwrite(...text) {
    stdout.value += text.join(' ');
    stdout.scrollTop = stdout.scrollHeight;
  }

  // Evaluate some input
  async function evaluate(input) {
    let time = Date.now();
    await rs.exec(pid, input);
    time = Date.now() - time;
    if (mainProc.state === 0) {
      if (mainProc.stateValue.status < 0) {
        stdwrite("Process exited with code " + mainProc.stateValue.statusValue + "\n");
        rs.terminate_process(pid, 0, true);
      } else {
        stdwrite(mainProc.stateValue.ret.toString() + "\n");
        if (rs.opts.value.get("timeExec")?.toPrimitive("bool")) {
          stdwrite(`** Took ${time} ms (${mainProc.stateValue.parse} ms parsing, ${mainProc.stateValue.exec} ms execution)\n`);
        }
      }
    }
  }

  // Basic I/O functions
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'exit', { c: '?real_int' }, ({ c }) => {
    alert(`Process exiting with code ${c ? c.toString() : 0}`);
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

  const inputStack = [];
  let inputStackPtr = -1;

  // Add event listener for input
  async function evaluateHtml() {
    if (stdin.value.length > 0) {
      stdout.value += getPrompt() + stdin.value + '\n';
      inputStack.push(stdin.value);
      inputStackPtr = inputStack.length - 1;
      console.log(inputStack, inputStackPtr);
      await evaluate(stdin.value);
      stdin.value = '';
    }
  }

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