const { printError } = require("../utils");

/** Default event loop monitoring function to monitor Runspace <rs> (returns Promise). Call provided function when a process finished succesfully */
function start(rs, finishOKcallback) {
  return new Promise((res) => {
    const loop = () => {
      for (let [pid, proc] of rs._procs) {
        if (proc.elhandled !== proc.state) {
          proc.elhandled = proc.state;
          // console.log(`PROCESS CALLBACK: PID=${pid}; STATE=${proc.state}; VAL=${proc.stateValue}`);
          // Destroy (remove) process if: killed, or finished first execution cycle
          if (proc.state === 3) rs.destroy_process(pid);
          else if (proc.state === 0 && proc.stateValue) {
            if (finishOKcallback) finishOKcallback(proc);
          } else if (proc.state === 2) { // Error. Print to STDOUT
            if (rs.opts.value.get("niceErrors").toPrimitive("bool")) printError(proc.stateValue, rs.io ? (str => rs.io.output.write(str)) : (str => console.log(str)));
            else console.trace(proc.stateValue);
            if (proc.dieonerr) {
              rs.terminate_process(pid, 1, true);
            } else {
              proc.state = 0;
              proc.stateValue = undefined;
              if (finishOKcallback) finishOKcallback(proc);
            }
          }
        }
      }
      if (rs._procs.size > 0) setImmediate(loop); // Iterate again if more processes
      else res(true); // If no processes, exit event loop as DONE
    };

    loop();
  });
}

module.exports = start;