const { StringValue, ArrayValue } = require("../src/evaluation/values");
const { RunspaceBuiltinFunction } = require("../src/runspace/Function");

module.exports = rs => {
    rs.define(new RunspaceBuiltinFunction(rs, 'ucase', { str: 'string' }, ({ str }) => new StringValue(rs, str.toString().toUpperCase()), 'String: to upper case'));
    rs.define(new RunspaceBuiltinFunction(rs, 'lcase', { str: 'string' }, ({ str }) => new StringValue(rs, str.toString().toLowerCase()), 'String: to upper case'));
    rs.define(new RunspaceBuiltinFunction(rs, 'tcase', { str: 'string' }, ({ str }) => new StringValue(rs, str.toString().split(' ').map(str => str[0].toUpperCase() + str.substr(1).toLowerCase()).join(' ')), 'String: to title case'));
    rs.define(new RunspaceBuiltinFunction(rs, 'replace', { str: 'string', search: 'string', replace: 'string', once: '?bool' }, ({ str, search, replace, once }) => new StringValue(rs, str.toString().replace((!once || (once && !once.toPrimitive('bool')) ? new RegExp(search.toString(), 'g') : search.toString()), replace.toString())), 'String: replace one/all instances of <search> with <replace>'));
    rs.define(new RunspaceBuiltinFunction(rs, 'substr', { str: 'string', index: 'real_int', length: '?real_int' }, ({ str, index, length }) => new StringValue(rs, str.toString().substr(index.toPrimitive('real_int'), length === undefined ? undefined : length.toPrimitive('real_int'))), 'String: return section of string starting at <index> and extending <length> chars'));
    rs.define(new RunspaceBuiltinFunction(rs, 'split', { str: 'string', splitter: '?string' }, ({ str, splitter }) => new ArrayValue(rs, str.toString().split(splitter === undefined ? '' : splitter.toString())), 'String: split string by <splitter> to form an array'));
    rs.define(new RunspaceBuiltinFunction(rs, 'join', { arr: 'array', seperator: 'string' }, ({ arr, seperator }) => new StringValue(rs, arr.toPrimitive('array').map(v => v.toString()).join(seperator.toString())), 'String: Join elements in an array by <seperator> to form a string'));

    StringValue.prototype.__excl__ = function () {
        return new StringValue(this.rs, this.value.toUpperCase());
    };

    return new StringValue(rs, `Provide some basic string functions: ucase, lcase, tcase, replace, substr, split, join`);
};