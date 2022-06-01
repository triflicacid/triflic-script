const { UndefinedValue, StringValue, ArrayValue, NumberValue, MapValue, BoolValue } = require("../src/evaluation/values");
const { RunspaceBuiltinFunction } = require("../src/runspace/Function");

function main(rs, ei) {
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'regex_match', { input: 'string', pattern: 'string', flags: '?string' }, ({ input, pattern, flags }) => {
    let matches = input.toString().match(new RegExp(pattern.toString(), flags ? flags.toString() : undefined));
    return matches ? new ArrayValue(rs, matches.map(x => new StringValue(rs, x))) : new UndefinedValue(rs);
  }, 'Regex: match pattern against string. Return array of all matches.'), ei.pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'regex_find', { input: 'string', pattern: 'string', flags: '?string' }, ({ input, pattern, flags }) => {
    let matches = input.toString().matchAll(new RegExp(pattern.toString(), 'g' + (flags ? flags.toString() : '')));
    let array = [];
    for (let match of matches) {
      let map = new Map();
      let captures = [];
      for (let capture of match) captures.push(capture);
      map.set('captures', new ArrayValue(rs, captures.map(c => new StringValue(rs, c))));
      map.set('pos', new NumberValue(rs, match.index));
      map.set('input', input);
      array.push(new MapValue(rs, map));
    }
    return new ArrayValue(rs, array);
  }, 'Regex: match pattern against string. Return array of all captures with information.'), ei.pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'regex_test', { input: 'string', pattern: 'string', flags: '?string' }, ({ input, pattern, flags }) => {
    return new BoolValue(rs, new RegExp(pattern.toString(), flags ? flags.toString() : undefined).test(input.toString()));
  }, 'Regex: test pattern against an input. Return boolean match.'), ei.pid);
}

module.exports = main;