const { RunspaceBuiltinFunction } = require("../src/runspace/Function");
const { NumberValue } = require('../src/evaluation/values');

module.exports = rs => {
    rs.defineFunc(new RunspaceBuiltinFunction(rs, 'timeit', { fn: 'func', args: '?array', iterations: '?real_int' }, ({ fn, args, iterations }) => {
        iterations = iterations ? iterations.toPrimitive('real_int') : 1;
        fn = fn.castTo("any").getFn();
        const start = Date.now();
        for (let c = 0; c < iterations; c++) {
            fn.call(args ? args.toPrimitive('array').map(t => t.castTo('any')) : []);
        }
        return new NumberValue(rs, Date.now() - start);
    }, 'Time the excution of function <fn> given arguments <args> for <iterations=1> iterations'));
};