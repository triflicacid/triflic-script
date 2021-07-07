# NodeJS Console Maths Interpreter
A simple maths interpreter for the console

Input maths problems to be solved. Supports dynamic operators, variables and functions.

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