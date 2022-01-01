const path = require("path");

module.exports = {
  mode: "production",
  // devtool: 'eval-source-map',
  entry: "./web.js",
  output: {
    path: path.join(__dirname, "web/"),
    filename: "source.js",
  }
};