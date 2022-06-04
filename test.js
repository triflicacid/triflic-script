const Runspace = require("./src/runspace/Runspace");
const createDefault = require("./src/init/args-default");
const { setupIO, destroyIO } = require("./src/runspace/setup-io");
const startEventLoop = require("./src/runspace/event-loop");

async function main() {
  const opts = createDefault();
  opts.app = "TEST";
  const rs = new Runspace(opts);
  setupIO(rs);

  process.on('SIGINT', function () {
    console.log("Recieved SIGINT")
    rs._procs.forEach(proc => rs.terminate_process(proc.pid, -1, true));
  });

  const pid = rs.create_process();
  require("./src/runspace/runspace-createImport");
  await rs.import(pid, "<io>");

  rs.exec(pid, "println(\"Hello, World\"); println(a);");

  await startEventLoop(rs);
  destroyIO(rs);
}

main();