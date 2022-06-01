# Internal

This document will describe the inner workings of TriflicScript

# Basic Model

Everything is contains in a `Runspace` environment. It contains so-called super-globals which can be accessed by every process and are constant, as well as instances which contains every block in the current executing instance. It also contains processes, which allow multiple programs with unique scopes to run in the same Runspace. Each process has a unique process ID (PID) and instance level (ILVL), as well as unique import stacks and variable scopes. Scoping is done by pushing and popping hash tables to the process's variable stack (see `../README.md`).

Every line of code is `await`d when executed in `Runspace`

## `evalObj`
This is an object passed to built-in functions, and is reset after each line evaluation. The property `action` may be changed to alter control flow, and the corresponding `actionValue` provides a value for `action`. Possible values:
- `0` -> nothing; OK.
- `1` -> break out of current block. Triggered by `break`.
- `2` -> continue current block. Triggered by `continue`.
- `3` -> return from current block. Triggered by `return <x>` where `actionValue` = `<x>`.
- `4` -> creates binding for a label. Triggered by `label`. (NOTE this is only in pre-evaluation)
- `5` -> `goto <label>` where `actionValue` = `<label>`. Changes control flow.

Any other halts execution.
- `-1` is used for exit via `exit(c)`. `actionValue` = `<c>` which corresponds to the exit code.
- `-2` is used for program halting after a `goto` call.

## Execution

The basic execution procedure is as follows:
- Create RUnspace environment (the following are optional)
  - Set `Runspace.opts`
  - Include `src/Runspace/Runspace-createImport` to define `Runspace.import`
  - Include `./src/runspace/setup-io` and call `setupIo(rs)` to create input-output interface using the `readline` node module. Then, define `Runspace.onLineHandler` to recieve line feeds from this interface.
- Create execution instance via `Runspace.create_exec_instance`. This created a block instance and a new process
- Feed TriflicScript source code into `Runspace.exec(exec_instance, <source_code>, <singleStatement=false>, <obj>)`. This returns a promise, which will return the last evaluated value. If provided, `obj` will contain the last `evalObj` data.
- Kill the execution instance by executing `Runscape.terminate_exec_instance(...)`
- If IO was added, terminate the interface by calling `Runspace.io.removeAllListeners()` and `Runspace.io.close()`

See `./cli.js` for and interactive CLI

See `./file.js` for taking an input file

## Adding Functionality

By design, TriflicScript is reasonably open and easy to add functionality to

- To add a new **operator**, see `src/evaluation/operators.js` and simply add `operators[<op>] = { <data> }`

- To add new **functions**, see `src/Runspace/RUnspace.js` and `src/Runspace/Function`. See `imports/regex.js` for examples

- To add a new **type**, see `src/evaluation/types.js`. See `imports/vector.js` for an example.