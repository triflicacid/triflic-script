/** SAME AS def.js BUT INCLUDE NODE FUNCTIONS */

const { errors } = require("../errors");
const { StringValue } = require("../evaluation/values");
const { RunspaceBuiltinFunction } = require("../runspace/Function");
const { system } = require("../utils-node");

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
};