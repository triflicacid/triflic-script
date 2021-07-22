const { RunspaceBuiltinFunction } = require("../src/runspace/Function");
const { NumberValue } = require("../src/evaluation/values.js");

module.exports = rs => {
	rs.define(new RunspaceBuiltinFunction(rs, 'rect', { n: 'real' }, ({ n }) => {
		let val = Math.abs(n.toPrimitive('real')), out;
		if (val > 0.5) out = 0;
		else if (val == 0.5) out = 0.5;
		else out = 1;
		return new NumberValue(rs, out);
	}));
};