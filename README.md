# NodeJS Console Maths Interpreter
A simple maths interpreter for the console

Input maths problems to be solved. Supports dynamic operators, variables and functions.

## Execution Methods
- `cli.js` - prompt a console-based CLI. Takes command line arguments.
- `discord.js` - connect to a discord bot and listens on a particular channel (defined as `BOT_TOKEN` and `CHANNEL` in `.env`)
  Type `!start` to start the maths environment. Everything after this point will be fed into the engine. Type `!close` to close session.

## CLI - Command-line Arguments
All of these arguments are in format `--<name> <value>` or `--<name>=<value>`. They are all optional.
- `cli.js` - Arguments proceed `node cli.js`
- `discord.js` - Arguments proceed `!start`
- `strict` : `boolean`. Strict mode? (actions are more tightly controlled).
- `bidmas` : `boolean`. Should expressions obey BIDMAS (order of operations)?
- `define-vars` : `boolean`. Whether or not to define common variables such as `pi` and `e`.
- `define-funcs` : `boolean`. Whether or not to define in-built functions such as `sin` and `summation`. Note that core functions such as `exit` are still defined.
- `prompt` : `string`. What prompt to display for input.
- `intro` : `boolean`. Whether or not to print welcome prompt.
- `nice-errors` : `boolean`. Whether or not to catch errors and prinpt nicely to the screen, or to crash the program.
- `ans` : `boolean`. Whether or not to provide the `ans` variable.
- `imag` : `character`. What character to use to represent the imaginary component in complex numbers. Set `--imag " "` to essentially disable complex numbers.

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

## Input
Lines may be inputted and process by using `Environment#eval()`.

The input will be pre-processed in the `eval()` method itself before being parsed as a `TokenString` and evaluated/stored.

Input may be an assignment; either `<var> = ...` or `<function>(<args>...) = ...`.

Comments may be includes as `# ...`. Enything after `#` will be ignored. If a comment is included in a function/variable definition, the contents of this comment will be displayed when `help(<thing>)` is called.

Strings are marcked by `"..."`.

Arrays are marked by `[...]`.

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