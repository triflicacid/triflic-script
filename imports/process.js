const { RunspaceBuiltinFunction } = require("../src/runspace/Function");
const { NumberValue, ArrayValue, BoolValue } = require("../src/evaluation/values.js");
const { errors } = require("../src/errors");
const { createEvalObj } = require("../src/utils");

module.exports = (rs, pid) => {
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'getpid', { pid: '?real_int' }, ({ pid }, evalObj) => {
    if (pid !== undefined) {
      pid = pid.toPrimitive("real_int");
      if (rs.get_process(pid) === undefined) throw new Error(`[${errors.NAME}] Name Error: no process with PID=${pid}`);
      evalObj.pid = pid;
    }
    return new NumberValue(rs, evalObj.pid);
  }, 'Get/set current process id (warning: setting PID is undefined behaviour)'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'pids', {}, () => {
    return new ArrayValue(rs, Array.from(rs._procs.keys()).map(x => new NumberValue(rs, x)));
  }, 'Get/set current process id (warning: setting PID is undefined behaviour)'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'pkill', { pid: '?real_int', code: '?real_int', }, ({ code, pid }, evalObj) => {
    code = code === undefined ? -1 : code.toPrimitive("real_int");
    pid = pid === undefined ? evalObj.pid : pid.toPrimitive("real_int");
    let proc = rs.get_process(pid);
    if (proc === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: no such process PID=${pid}`);
    rs.terminate_process(pid, code, true);
    return new NumberValue(rs, code);
  }, 'Kill the provided process (default=current process) with the given code (default=-1)'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'pcreate', {}, (_, evalObj) => {
    const pid = rs.create_process();
    return new NumberValue(rs, pid);
  }, 'Create process and return PID'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'pchildren', { pid: '?real_int' }, ({ pid }, evalObj) => {
    pid = pid ? pid.toPrimitive("real_int") : evalObj.pid;
    let proc = rs.get_process(pid);
    if (proc === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: no process with PID=${pid}`);
    return new ArrayValue(rs, proc.children.map(c => new NumberValue(rs, c)));
  }, 'Return array of PIDs that are the given process\' children'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'getppid', { pid: '?real_int' }, ({ pid }, evalObj) => {
    pid = pid ? pid.toPrimitive("real_int") : evalObj.pid;
    let proc = rs.get_process(pid);
    if (proc === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: no process with PID=${pid}`);
    return proc.parent === null ? rs.UNDEFINED : new NumberValue(rs, proc.parent);
  }, 'Get PID of parent process of given process'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'padopt', { parentPID: 'real_int', childPID: 'real_int' }, ({ parentPID, childPID }) => {
    const b = rs.process_adopt(parentPID.toPrimitive("real_int"), childPID.toPrimitive("real_int"));
    return new BoolValue(rs, b);
  }, 'Make childPID a child process of parentPID. Return success/failiure.'), pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'punadopt', { parentPID: 'real_int', childPID: 'real_int' }, ({ parentPID, childPID }, evalObj) => {
    const b = rs.process_unadopt(parentPID.toPrimitive("real_int"), childPID.toPrimitive("real_int"));
    return new BoolValue(rs, b);
  }, 'Opposite of padopt: remove relationship. Return success/failiure.'), pid);

  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'pexec', { pid: 'real_int', source: 'string' }, ({ pid, source }, evalObj) => {
    pid = pid.toPrimitive("real_int");
    let proc = rs.get_process(pid);
    if (proc === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: no such process PID=${pid}`);
    rs.exec(pid, source.toPrimitive("string"));
    return rs.UNDEFINED;
  }, 'Execute given code inside process with given PID'), pid);

  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'pcall', { pid: 'real_int', fn: 'string', args: { type: 'array', optional: true, ellipse: true } }, ({ pid, fn, args }, evalObj) => {
    pid = pid.toPrimitive("real_int");
    let proc = rs.get_process(pid);
    if (proc === undefined) throw new Error(`[${errors.BAD_ARG}] Argument Error: no such process PID=${pid}`);
    fn = fn.castTo("any").getFn();
    const obj = createEvalObj(evalObj.blockID, evalObj.lineID, pid);

    proc.state = 1;
    proc.stateValue = {};
    proc.stateValue.promise = fn.call(obj, args ? args.toPrimitive("array").map(t => t.castTo("any")) : []);
    proc.stateValue.promise.then(() => {
      if (proc.state === 1) {
        proc.state = 0;
        proc.stateValue = undefined;
      }
    });
    return rs.UNDEFINED;
  }, 'Call function <fn> with <args> provided as arguments in process PID=<pid>'), pid);
};