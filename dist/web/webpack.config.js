const path = require("path");

module.exports = {
  mode: "production",
  // devtool: 'eval-source-map',
  entry: "./main.js",
  output: {
    path: path.join(__dirname, "dist/"),
    filename: "script.js",
  }
};