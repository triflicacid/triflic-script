const { RunspaceBuiltinFunction } = require("../src/runspace/Function");
const { NumberValue } = require("../src/evaluation/values.js");

module.exports = (rs, ei) => {
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'pid', { pid: '?real_int' }, ({ pid }, evalObj) => {
    if (pid !== undefined) {
      pid = pid.toPrimitive("real_int")
      if (rs.get_process(pid) === undefined) throw new Error(`[${errors.NAME}] Name Error: no process with PID=${pid}`);
      evalObj.exec_instance.pid = pid;
    }
    return new NumberValue(rs, evalObj.exec_instance.pid);
  }, 'Get/set current procedd id (warning: setting PID is undefined behaviour)'), ei.pid);
};