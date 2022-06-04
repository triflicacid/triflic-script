const { RunspaceBuiltinFunction } = require("../src/runspace/Function");
const { StringValue } = require('../src/evaluation/values');
const { consoleColours } = require("../src/utils");
const { errors } = require("../src/errors");

module.exports = (rs, pid) => {
    rs.defineFunc(new RunspaceBuiltinFunction(rs, 'c_reset', {}, () => {
        rs.io.output.write(consoleColours.Reset);
        return rs.UNDEFINED;
    }, 'Console: reset styling'), pid);
    rs.defineFunc(new RunspaceBuiltinFunction(rs, 'c_reverse', {}, () => {
        rs.io.output.write(consoleColours.Reverse);
        return rs.UNDEFINED;
    }, 'Console: reverse foreground and background colours'), pid);
    rs.defineFunc(new RunspaceBuiltinFunction(rs, 'c_bright', {}, () => {
        rs.io.output.write(consoleColours.Bright);
        return rs.UNDEFINED;
    }, 'Console: set styling to bright'), pid);
    rs.defineFunc(new RunspaceBuiltinFunction(rs, 'c_dim', {}, () => {
        rs.io.output.write(consoleColours.Dim);
        return rs.UNDEFINED;
    }, 'Console: set styling to dim'), pid);
    rs.defineFunc(new RunspaceBuiltinFunction(rs, 'c_underscore', {}, () => {
        rs.io.output.write(consoleColours.Underscore);
        return rs.UNDEFINED;
    }, 'Console: set styling to underscore'), pid);
    rs.defineFunc(new RunspaceBuiltinFunction(rs, 'c_blink', {}, () => {
        rs.io.output.write(consoleColours.Blink);
        return rs.UNDEFINED;
    }, 'Console: set styling to blink'), pid);
    rs.defineFunc(new RunspaceBuiltinFunction(rs, 'c_hidden', {}, () => {
        rs.io.output.write(consoleColours.Hidden);
        return rs.UNDEFINED;
    }, 'Console: set styling to hidden'), pid);
    rs.defineFunc(new RunspaceBuiltinFunction(rs, 'c_fg', { col: 'string' }, ({ col }) => {
        col = col.toPrimitive("string");
        let code;
        switch (col.toLowerCase()) {
            case "black": code = consoleColours.FgBlack; break;
            case "red": code = consoleColours.FgRed; break;
            case "green": code = consoleColours.FgGreen; break;
            case "yellow": code = consoleColours.FgYellow; break;
            case "blue": code = consoleColours.FgBlue; break;
            case "magenta": code = consoleColours.FgMagenta; break;
            case "cyan": code = consoleColours.FgCyan; break;
            case "white": code = consoleColours.FgWhite; break;
            default:
                throw new Error(`[${errors.BAD_ARG}] Unknown foreground colour '${col}'`);
        }
        rs.io.output.write(code);
        return rs.UNDEFINED;
    }, 'Console: set foreground colour'), pid);
    rs.defineFunc(new RunspaceBuiltinFunction(rs, 'c_bg', { col: 'string' }, ({ col }) => {
        col = col.toPrimitive("string");
        let code;
        switch (col.toLowerCase()) {
            case "black": code = consoleColours.BgBlack; break;
            case "red": code = consoleColours.BgRed; break;
            case "green": code = consoleColours.BgGreen; break;
            case "yellow": code = consoleColours.BgYellow; break;
            case "blue": code = consoleColours.BgBlue; break;
            case "magenta": code = consoleColours.BgMagenta; break;
            case "cyan": code = consoleColours.BgCyan; break;
            case "white": code = consoleColours.BgWhite; break;
            default:
                throw new Error(`[${errors.BAD_ARG}] Unknown background colour '${col}'`);
        }
        rs.io.output.write(code);
        return rs.UNDEFINED;
    }, 'Console: set foreground colour'), pid);
};