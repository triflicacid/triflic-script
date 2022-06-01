const { ArrayValue, StringValue, BoolValue, NumberValue } = require("../src/evaluation/values");
const { RunspaceBuiltinFunction } = require("../src/runspace/Function");
const fs = require("fs");
const { errors, errorDesc } = require("../src/errors");

function fexists(filepath) {
  return new Promise((resolve) => {
    fs.access(filepath, (err) => {
      resolve(err == undefined);
    });
  });
}

function fread(filepath, offset, length) {
  return new Promise((resolve) => {
    fs.readFile(filepath, (err, buf) => {
      if (err) throw err;
      resolve(buf.toString());
    });
  });
}

function fdelete(filepath) {
  return new Promise((resolve) => {
    fs.unlink(filepath, (err) => {
      resolve(!err);
    });
  });
}

function fwrite(filepath, data, offset, length) {
  return new Promise((resolve) => {
    fs.writeFile(filepath, data, (err) => {
      if (err) throw err;
      resolve(data.length);
    });
  });
}

function main(rs, ei) {
  errors.EFILE = 'EFILE';
  errorDesc[errors.EFILE] = 'Unable to complete file action';

  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'fexists', { filepath: 'string' }, async ({ filepath }) => new BoolValue(rs, await fexists(filepath.toString())), 'does the given file exist?'), ei.pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'fread', { filepath: 'string' }, async ({ filepath }) => {
    filepath = filepath.toString();
    if (!(await fexists(filepath))) throw new Error(`[${errors.EFILE}] Unable to read file: file '${filepath}' does not exist`);
    return new StringValue(rs, await fread(filepath));
  }, 'reads a file'), ei.pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'fwrite', { filepath: 'string', data: 'string' }, async ({ filepath, data }) => {
    filepath = filepath.toString();
    data = data.toString();
    return new NumberValue(rs, await fwrite(filepath, data));
  }, 'write to a file (creates is not exist)'), ei.pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'fdelete', { filepath: 'string' }, async ({ filepath }) => {
    filepath = filepath.toString();
    return new BoolValue(rs, await fdelete(filepath));
  }, 'deletes (unlinks) a file'), ei.pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'mkdir', { path: 'string' }, async ({ path }) => {
    path = path.toString();
    return await new Promise(resolve => {
      fs.mkdir(path, undefined, (err) => {
        resolve(new BoolValue(rs, !err));
      });
    });
  }, 'creates a directory'), ei.pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'isdir', { path: 'string' }, async ({ path }) => {
    path = path.toString();
    if (!(await fexists(path))) return false;
    return new BoolValue(rs, await new Promise(resolve => {
      fs.lstat(path, (err, stats) => {
        if (err) return resolve(false);
        else resolve(stats.isDirectory());
      });
    }));
  }, 'is the given path a directory'), ei.pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'lsdir', { path: 'string' }, async ({ path }) => {
    path = path.toString();
    if (!(await fexists(path))) throw new Error(`[${errors.BAD_ARG}] Unable to list directory '${path}' as it does not not exist`);
    return new ArrayValue(rs, await new Promise(resolve => {
      fs.readdir(path, { withFileTypes: true }, (err, files) => {
        if (err) throw new Error(`[${errors.BAD_ARG}] Unable to list directory '${path}':\n${err}`);
        resolve(files.map(file => new StringValue(rs, file.name)));
      });
    }));
  }, 'list files/directories in a directory'), ei.pid);
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'rmdir', { path: 'string', recurse: '?bool' }, async ({ path, recurse }) => {
    recurse = recurse ? recurse.toPrimitive('bool') : false;
    path = path.toString();
    return await new Promise(resolve => {
      fs.rmdir(path, { recursive: recurse }, (err) => {
        resolve(new BoolValue(rs, !err));
      });
    });
  }, 'deleted a directory (recursive?)'), ei.pid);
}

module.exports = main;