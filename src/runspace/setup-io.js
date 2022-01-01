const readline = require("readline");

module.exports = function (rs) {
  rs.io = readline.createInterface({
    input: rs.stdin,
    output: rs.stdout,
  });
  rs.io.on('line', line => rs.onLineHandler?.(rs.io, line));
  rs.stdin.on('data', async key => {
    if (rs.onDataHandler) await rs.onDataHandler(rs.io, key);
  });
};