# NodeJS Console Maths Interpreter
A simple maths interpreter for the console

Input maths problems to be solved. Supports dynamic operators, variables and functions.

## Execution Methods
- `cli.js` - prompt a console-based CLI
- `discord.js` - connect to a discord bot and listens on a particular channel (defined as `BOT_TOKEN` and `CHANNEL` in `.env`)
  Type `!start` to start the maths environment. Everything after this point will be fed into the engine. Type `!close` to close session.

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

Comments may be includes as `// ...`. Enything after `//` will be ignored. If a comment is included in a function/variable definition, the contents of this comment will be displayed when `help(<thing>)` is called.

Strings are marcked by `"..."`.