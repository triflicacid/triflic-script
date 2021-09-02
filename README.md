# NodeJS Console Maths Interpreter
A simple maths interpreter for the console

Input maths problems to be solved. Supports dynamic operators, variables and functions.

## Execution Methods
- `cli.js` - prompt a console-based CLI. Takes command line arguments.
- `discord.js` - connect to a discord bot and listens on a particular channel (defined as `BOT_TOKEN` and `CHANNEL` in `.env`)
  Type `!start` to start the maths environment. Everything after this point will be fed into the engine. Type `!close` to close session.
- `file.js` - takes a filename to execute

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
- `define-aliases` : `boolean`. Define aliases for some variables/functions e.g. `W` for `lambertW` and `π` for `pi` (NB these are not aliases, but copies, so `pi` is independant from `π`)
- `multiline` : `boolean`. Does the CLI allow multiline input?

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

Comments may be includes as `# ...`. Enything after `#` will be ignored until a newline is reached. If a comment is included in a function/variable definition, the contents of this comment will be displayed when `help(<thing>)` is called.

### Literals
These are structures in the code which define values:

- `123...` define numbers. Numbers:
  - May start with a sign `+/-`. Default is `+`.
  - Radix indicator `0[x|b|o|d]`. Default is `d`.
  - Digits in the declared base (these are optional)
  - A decimal point `.`
  - More digits in the decimal point
  - An exponent `e`, followed by another valid number (note, this number may not contain `e`)
  *N.B.* Numbers may contain the seperator `_`. This cannot be at the start/end of a number.

- `"..."` represents a strings (as of yet, `"` cannot be escaped)
- `[...]` represents an array
- `{...}` represents a set


### Variables
Variables store values in memory. There are some predefined variables (assuming `--define-vars` is truthy).

The special `ans` variable holds the value of the last evaluation

Variables may be declared/assigned using `<var> = ...`. `=` may be switched to `:=` for constant assignment.

### Functions
Functions recieve arguments and return a value.

There are two types of functions: `built-in`s and `user-defined`
- `built-in`s are pre-defined internally using JavaScript.
- `user-defined`s are defined by the user via the syntax `<name>(<arg1>[, <arg2>[, ...]]) = ...`. `=` may be switched to `:=` for constant assignment.

### Operators
| Operator | Name | Precedence | Description | Example |
| -------- | ---- | ---------- | ----------- | ------- |
| . | Member Access | 20 | Get member on RHS of object on LHS | `headers."time"` => `1630433878509` |
| deg | Degrees | 18 | Take LHS as degrees and convert to radians | `180 deg` => `3.14159265359` |
| ~ | Bitwise NOT | 17 | Bitwise NOT value on LHS | `~20` => `-21` |
| + | Unary plus | 17 | Convert LHS to number | `+"14"` => `14` |
| - | Unary minus | 17 | Convert LHS to number and negate | `-"14"` => `-14` |
| ' | Logical Not | 17 | Returns opposite boolean value | `0'` => `true` |
| ! | Factorial | 17 | Returns factorial of value | `5!` => `120` or `120.00000000000017` |
| ** | Exponentation | 16 | Returns LHS to the power of the RHS | `2 ** 4` => `16` |
| // | Integer division | 15 | Divide LHS by RHS, return as an integer | `5 // 2` => `2` |
| / | Division | 15 | Divide LHS by RHS | `5 / 2` => `2.5` |
| % | Modulo/Remainder | 15 | Return remainder of LHS divided by RHS | `5 % 2` => `1` |
| * | Multiplication | 15 | Multiply LHS by RHS | `5 * 2` => `10` |
| ∩ | Intersection | 15 | Find the intersection between the LHS and RHS | `{1,2} ∩ {2,3}` => `{2}` |
| ∪ | Union | 14 | Find the union between the LHS and RHS | `{1,2} ∩ {2,3}` => `{1,2,3}` |
| + | Addition | 14 | Add RHS to LHS | `5 + 2` => `7` |
| - | Subtraction | 14 | Subtract RHS from LHS | `5 - 2` => `3` |
| << | Right Shift | 13 | Bit shift LHS right by RHS places | `5 << 2` => `20` |
| >> | Left Shift | 13 | Bit shift LHS left by RHS places | `5 << 2` => `1` |
| <= | Less Than or Equal To | 12 | Return boolean result of comparison between LHS and RHS | `5 <= 5` => `true` |
| < | Less Than | 12 | Return boolean result of comparison between LHS and RHS | `4 < 5` => `true` |
| >= | Greater Than or Equal To | 12 | Return boolean result of comparison between LHS and RHS | `5 >= 5` => `true` |
| > | Greater Than | 12 | Return boolean result of comparison between LHS and RHS | `4 > 5` => `false` |
| in | Member Test | 12 | Is LHS member of RHS (must have space after i.e. "in ") | `"time" in headers` => `true` |
| == | Equality | 11 | Is the LHS equal to the RHS? | `5 == 5` => `true`, `2 == "2"` => `false` |
| != | Not Equality | 11 | Is the LHS not equal to the RHS? | `5 != 5` => `false`, `2 != "2"` => `true` |
| & | Bitwise And | 10 | Apply a bitwise AND to LHS and RHS | `5 & 3` => `1` |
| ^ | Bitwise Xor | 9 | Apply a bitwise XOR to LHS and RHS | `5 ^ 3` => `6` |
| \| | Bitwise Or | 8 | Apply bitwise OR to LHS and RHS | `5 | 3` => `7` |
| && | Logical And | 7 | Are both the LHS and RHS truthy? Returns RHS or `false`. | `0 && 1` => `false` |
| \|\| | Logical Or | 6 | Is either LHS or RHS truthy? | `0 || 1` => `1` |
| := | Constant Assignment | 3 | Assigns the RHS to the LHS as a constant | `PI := 3.14159` => `3.14159` |
| = | Assignment | 3 | Assigns the RHS to the LHS | `name := "john"` => `"john"` |
| , | Comma | 1 | Returns RHS argument | `1, 2` => `2` |

## keywords
### `if`, `else`
Syntax: `if (<condition>) {<block>} [else if (<condition> <block>), [...]] [else <block>]`

If the `<condition>` is truthy, the `<block>` is executed and the rest of the structure is skipped. If not `if` or `else if` is executed, the `else` block will execute.

### `do`
Syntax: `do {<block>}`

Defines following `{...}` as a block (not as a set) and executes it

### `while`
Syntax: `{<block>} while (<condition>)` or `while (<condition>) {<block>}`
Either (1) Execute `<block>` and keep executing while `<condition>` is true or (2) Execute `<block>` while `<condition>` is true

### `for`
Syntax: `for (<action>) {<block>}` where `<action>` comprises of THREE parts `(init; cond; step)`
- `init` : this is executed before the loop begins
- `cond` : the loop runs while `<cond>` is truthy
- `step` : this is executed after each loop iteration