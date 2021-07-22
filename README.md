# NodeJS Console Maths Interpreter
A simple maths interpreter for the console

Input maths problems to be solved. Supports dynamic operators, variables and functions.

## Execution Methods
- `cli.js` - prompt a console-based CLI. Takes command line arguments.
- `discord.js` - connect to a discord bot and listens on a particular channel (defined as `BOT_TOKEN` and `CHANNEL` in `.env`)
  Type `!start` to start the maths environment. Everything after this point will be fed into the engine. Type `!close` to close session.

## CLI - Command-line Arguments
All of these arguments are in format `--<name> <value>` or `--<name>=<value>`. They are all optional.

### Position
- `cli.js` - Arguments proceed `node cli.js`
- `discord.js` - Arguments proceed `!start`

### Arguments
- `strict` : `boolean`. Strict mode? (actions are more tightly controlled).
- `bidmas` : `boolean`. Should expressions obey BIDMAS (order of operations)?
- `define-vars` : `boolean`. Whether or not to define common variables such as `pi` and `e`.
- `define-funcs` : `boolean`. Whether or not to define in-built functions such as `sin` and `summation`. Note that core functions such as `exit` are still defined.
- `prompt` : `string`. What prompt to display for input.
- `intro` : `boolean`. Whether or not to print welcome prompt.
- `nice-errors` : `boolean`. Whether or not to catch errors and prinpt nicely to the screen, or to crash the program.
- `ans` : `boolean`. Whether or not to provide the `ans` variable.
- `imag` : `character`. What character to use to represent the imaginary component in complex numbers. Set `--imag " "` to essentially disable complex numbers.
- `gamma-factorial` : `boolean`. Use `gamma` function for factorial operator `!` (use `factorial` or `factorialReal`) ?
- `reveal-headers` : `boolean`. Reveal CLI options and other information to Runspace as `headers` map?

## Implicit Multiplication
Multiplication operations are inserted automatically between tokens in the following cases:
let two tokens in sequence be `a` and `b`:
- `a` is a `Number` and `b` is [`(`, `Function`, `Variable`]
- `a` is a `Variable` and `b` is [`(`, `Function`, `Variable`]
- `a` is a `Function` and `b` is [`(`, `Function`, `Variable`]
- `a` is a `)` and `b` is [`(`, `Function`, `Variable`, `Number`]

The special `!*` operator will be inserted between `a` and `b`. This has higher precendence than all other operators so it is executed first.

e.g. If `e ^ 2ln(2)` -> `e ^ 2 * ln(2)`, `e ^ 2` would be evaluated first which is not what the user wanted.
So, `e ^ 2ln(2)` -> `e ^ 2 !* ln(2)` so `2 !* ln(2)` is evaluated first, as the user expected.

## Built-Ins
Base definitions to an `Environment` are present in `src/def.js`
For more information on built-ins, enter `help()`.

### `import(file: string)`
This functions is used to import scripts into the current runspace. `file` may be any valid file.

The full path to the imported file is resolves as follows: `currentWorkingDirectory + "imports/" + file` where
- `currentWorkingDirectory` is the path of the directory in which `cli.js` lies
- `"imports/"` is a standard directory where all external files are recommended to be kept
- `file` is the argument to the function


If the file is a `.js` (JavaScript) file:
- `module.exports` must be set to a single function
- `module.exports` is called with one argument, being the active `Runspace` instance.

Any other extension:
- The file is read, and the contents are split line-by-line
- Each line is evaluated as if it were input via `Runspace#eval`

## Input
Lines may be inputted and process by using `Environment#eval()`.

The input will be pre-processed in the `eval()` method itself before being parsed as a `TokenString` and evaluated/stored.

### General Syntax

Comments may be includes as `# ...`. Enything after `#` will be ignored. If a comment is included in a function/variable definition, the contents of this comment will be displayed when `help(<thing>)` is called.

Strings are marked by `"..."`.

Arrays are marked by `[...]`.

Sets are marked by `{...}`.

### Variables
Variables store values in memory. There are some predefined variables (assuming `--define-vars` is truthy).

The special `ans` variable holds the value of the last evaluation

Variables may be declared/assigned using `[let|const] <var> = ...`, where `let` or `const` is optional, but more explicit.

### Functions
Functions recieve arguments and return a value.

There are two types of functions: `built-in`s and `user-defined`
- `built-in`s are pre-defined internally using JavaScript.
- `user-defined`s are defined by the user via the syntax `let|const <name>(<arg1>[, <arg2>[, ...]] = ...`, where `let` or `const` is required.

Functions are called using parenthesis `()` containing their arguments, or may be referenced by omitting `()`.