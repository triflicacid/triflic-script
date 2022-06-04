const readline = require("readline");

function setupIO(rs) {
  rs.io = readline.createInterface({
    input: rs.stdin,
    output: rs.stdout,
  });
  rs.io.on('line', line => rs.onLineHandler?.(rs.io, line));
  rs.stdin.on('data', async key => {
    if (rs.onDataHandler) await rs.onDataHandler(rs.io, key);
  });
}

function destroyIO(rs) {
  rs.io.removeAllListeners();
  rs.io.close();
}

module.exports = { setupIO, destroyIO };