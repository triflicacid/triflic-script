/** Define functions which are built on a nodejs runtime */

const { errors } = require("../errors");
const { StringValue, ArrayValue, NumberValue } = require("../evaluation/values");
const { RunspaceBuiltinFunction } = require("../runspace/Function");
const { returnTypedArray, numberTypes } = require("../utils");
const { system, uuidv4 } = require("../utils-node");
const crypto = require("crypto");

module.exports = function (rs) {
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'system', { cmd: 'string' }, async ({ cmd }) => {
    cmd = cmd.castTo('string');
    try {
      let ret = await system(cmd.toPrimitive('string'));
      return new StringValue(rs, ret);
    } catch (e) {
      throw new Error(`[${errors.GENERAL}] Error whilst running command '${cmd}':\n${e}`);
    }
  }, 'Execute a system command and return STDOUT'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'crandom', { ntype: '?string', size: '?real_int' }, ({ ntype, size }) => {
    ntype = ntype ? ntype.toPrimitive("string") : "float64";
    if (!numberTypes.includes(ntype)) throw new Error(`[${errors.BAD_ARG}] Argument Error: ${ntype} is not a valid numerical type`);
    if (ntype === "int64" || ntype === "uint64") throw new Error(`[${errors.BAD_ARG}] Argument Error: numeric type ${ntype} is not supported`);
    size = size ? size.toPrimitive("real_int") : 1;
    if (size < 1 || isNaN(size) || !isFinite(size)) size = 1;
    let array = returnTypedArray(ntype, size);
    crypto.randomFillSync(array);
    return new ArrayValue(rs, Array.from(array).map(n => new NumberValue(rs, n)));
  }, 'return array of random numbers of given type (more secure than random())'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'uuid', {}, () => {
    return new StringValue(rs, uuidv4());
  }, 'create and return a UUIDv4'));
};