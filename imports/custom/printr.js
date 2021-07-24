const { RunspaceBuiltinFunction } = require("../../src/runspace/Function");

module.exports = rs => {
    rs.define(new RunspaceBuiltinFunction(rs, 'printr', { arg: 'any' }, ({ arg }) => {
        console.log(arg);
        return arg;
    }, 'Print raw object as stored internally'));
};