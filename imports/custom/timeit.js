const { RunspaceBuiltinFunction } = require("../../src/runspace/Function");
const { NumberValue } = require('../../src/evaluation/values');

module.exports = rs => {
    rs.define(new RunspaceBuiltinFunction(rs, 'timeit', { fn: 'func', args: '?array' }, ({ fn, args }) => {
        fn = fn.getFn();
        const start = Date.now();
        fn.eval(args ? args.toPrimitive('array').map(t => t.eval('any')) : []); // Call .eval('any') to resolve any variables
        return new NumberValue(rs, Date.now() - start);
    }, 'Time the excution of function <fn> given arguments <args>'));
};