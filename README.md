# TriflicScript: NodeJS Scripting Language
In TriflicScript everything is an expression. This project started as a single-line maths-focused interpreter, allowing for maths involving complex number. It bow, supports multi-line programs with basic control structures. Due to origins this program, the interpreter has some quirks.

If I had known how this would progress, I would've written this in Java or C++ for speed. As this is written in JavaScript, it is pretty slow: my script is interpreted (probably pretty badly), which is then interpreted by JavaScript's V8 and run as C++. Not very fast :(.

For more help, see `docs/` for more documentation, `programs/` for example programs, and the built-in `help` function.

## Important Notes
- Short-circuiting does not work. This applies to `&&`, `||`, `??` and `?.`

## TODO
- Optional semi-colons. Expression terminates on
  - `\n`, assuming not inside a bracketed group `[]` or `()`
  - At the end of a block
- Labelled blocks. `break` and `continue` statements may be followed by a block label.
- Add `docs/funcs/` which describes and contains usage of every core-defined function **IN PROGRESS**
  - All core functions done, now functions defined in `defineFuncs`
- Remove dependency of core functionality on node modules (`readline`)

## Bugs
- Negative numbers after block is a syntax error e.g. `func() { if (0) {...} -1; }`
  - As there is something before `-`, it isn't parsed as a unary operator
- `discord.js` and `docs/syntax/test.js` need changing to latest version

## Execution Methods
- `cli.js` - prompt a console-based CLI. Takes command line arguments. `<io>` is imported.
- `file.js` - takes a filename to execute. `<io>` is imported.

See `dist/` for other execution methods

## Interpreter Arguments
All of these arguments are in format `--<name> <value>` or `--<name>=<value>`. They are all optional.

### Position
- `cli.js` - Arguments proceed `node cli.js`
- `discord.js` - Arguments proceed `!start`
- `file.js` - Arguments proceed `node file.js <file>`

### Arguments
Not every argument is used in every execution method.

- `bidmas` : `boolean`. Should expressions obey BIDMAS (order of operations)? *May be changed via headers.bidmas*
- `define-funcs` : `boolean`. Whether or not to define in-built functions such as `sin` and `summation`. Note that core functions such as `exit` are still defined.
- `prompt` : `string`. What prompt to display for input. *May be changed via headers.bidmas*
- `intro` : `boolean`. Whether or not to print welcome prompt.
- `imag` : `character`. What character to use to represent the imaginary component in complex numbers. Set `--imag " "` to essentially disable complex numbers.
- `multiline` : `boolean`. Does the CLI allow multiline input?
- `time` : `boolean`. CLI times each line of execution and displays it.