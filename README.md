# NodeJS Scripting Language
Started as a single-line maths-focused interpreter, allowing for maths involving complex number

Now, supports multi-line programs with basic control structures. Due to origins this program, the interpreter has some quirks.

If I has known how this would progress, I would've written this in Java or C++ for speed. As this is written in JavaScript, it is pretty slow: my script is interpreted (probably pretty badly), which is then interpreted by JavaScript's V8 and run as C++. Not very fast :(.

## Important Notes
- Inline function definitions in format `<name>(<args>) = ...` has been disabled 
- Optional arguments in `func` are not implemented
- `&&` operator short-circuiting does not work

## TODO
- Nested-expression shortcut
Currently, `a = [a]` infinity recurses as a is equal to an array containing itself. Detecting this and printing e.g. `...` or `<ref a>` would be optimal.
- Add `(call)` operator with proper precedence. Is hidden.
- Do more syntax checking in initial `_tokenify` e.g. cannot be two consecutive constant values e.g. `<number|ientifier> <number|identifier>` will throw.
- Implement keywords `return`, `break`, `continue` in blocks.
- Optional function parameters

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
- `file.js` - Arguments proceed `node file.js <file>`

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
- `reveal-headers` : `boolean`. Reveal CLI options and other information to Runspace as `headers` map?
- `define-aliases` : `boolean`. Define aliases for some variables/functions e.g. `W` for `lambertW` and `π` for `pi` (NB these are not aliases, but copies, so `pi` is independant from `π`)
- `multiline` : `boolean`. Does the CLI allow multiline input?
- `time` : `boolean`. CLI times each line of execution and displays it.

## Built-Ins
Base definitions to a `Runspace` instance are present in `src/def.js`
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
- The file is read
- The file contents are passed into `Runspace#execute`

## Input
A program may be interpreted and executed via `Runspace#execute`

- `Runspace#parse` takes source code and returns an array of `TokenLine` objects
- `Runspace#interpret` takes `TokenLine[]` and evaluates them

### General Syntax

Comments may be includes as `# ...`. Enything after `#` will be ignored until a newline is reached. If a comment is included in a function/variable definition, the contents of this comment will be displayed when `help(<thing>)` is called.

### Literals
These are structures in the code which define values:

- `#...` - comment is ignored
- `123...` define numbers. Numbers:
  - May start with a sign `+/-`. Default is `+`.
  - Radix indicator `0[x|b|o|d]`. Default is `d`.
  - Digits in the declared base (these are optional)
  - A decimal point `.`
  - More digits in the decimal point
  - An exponent `e`, followed by another valid number (note, this number may not contain `e`)
  *N.B.* Numbers may contain the seperator `_`. This cannot be at the start/end of a number.

- `"..."` represents a strings
- `[...]` represents an array
- `{...}` represents a set, map or a block
  - **Block** if keyword structure expects a block and `{...}` is present e.g. `do {...}`, `if (...) {...}`.
  - **Map** if first element matches `<x>: ...`. To use to `:` as an operator, therefore, one must wrap `<x>:...` in parenthesis
  `{3:7}` would be interpreted as a map, but `{(3:7)}` would not.
  One cannot use this syntax to define an empty max, as `{}` would create a set.
  - Else, **set**.
- `'...'` is a character literal. Must be empty or contain one character.


### Variables
Variables store values in memory. There are some predefined variables (assuming `--define-vars` is truthy).

The special `ans` variable holds the value of the last evaluation

Variables may be declared/assigned using `<var> = ...`. `=` may be switched to `:=` for constant assignment.

### Functions
Functions recieve arguments and return a value.

There are two types of functions: `built-in`s and `user-defined`
- `built-in`s are pre-defined internally using JavaScript.
- `user-defined`s are defined by the user
  - Inline via `<name>(<arg1>[, <arg2>[, ...]]) = ...`
  - Via `func` keyword

### Operators
| Operator | Name | Precedence | Associativity | Description | Example |
| -- | -- | -- | -- | -- | -- |
| . | Member Access | 20 | ltr | Get member on RHS of LHS object | `headers."time"` => `1630433878509` |
| ?. | Optional Member Access | 20 | ltr | Get member on RHS of LHS object. If RHS is undefined, return undefined | `undefined?.1` => `undefined` |
| deg | Degrees | 18 | rtl | Take LHS as degrees and convert to radians | `180 deg` => `3.14159265359` |
| ~ | Bitwise NOT | 17 | rtl | Bitwise NOT value on LHS | `~20` => `-21` |
| + | Unary plus | 17 | rtl | Convert LHS to number | `+"14"` => `14` |
| - | Unary minus | 17 | rtl | Convert LHS to number and negate | `-"14"` => `-14` |
| ! | Logical Not | 17 | rtl | Returns opposite boolean value | `!0` => `true` |
| ** | Exponentation | 16 | rtl | Returns LHS to the power of the RHS | `2 ** 4` => `16` |
| : | Sequence | 16 | rtl | Attempts to create sequence from LHS to RHS | `3:7` => `[3,4,5,6]`, `"a":"f"` => `["a","b","c","d","e"]` |
| // | Integer division | 15 | ltr | Divide LHS by RHS, return as an integer | `5 // 2` => `2` |
| / | Division | 15 | ltr | Divide LHS by RHS | `5 / 2` => `2.5` |
| % | Modulo/Remainder | 15 | ltr | Return remainder of LHS divided by RHS | `5 % 2` => `1` |
| * | Multiplication | 15 | ltr | Multiply LHS by RHS | `5 * 2` => `10` |
| ∩ | Intersection | 15 | ltr | Find the intersection between the LHS and RHS | `{1,2} ∩ {2,3}` => `{2}` |
| ∪ | Union | 14 | ltr | Find the union between the LHS and RHS | `{1,2} ∪ {2,3}` => `{1,2,3}` |
| + | Addition | 14 | ltr | Add RHS to LHS | `5 + 2` => `7` |
| - | Subtraction | 14 | ltr | Subtract RHS from LHS | `5 - 2` => `3` |
| << | Right Shift | 13 | ltr | Bit shift LHS right by RHS places | `5 << 2` => `20` |
| >> | Left Shift | 13 | ltr | Bit shift LHS left by RHS places | `5 << 2` => `1` |
| <= | Less Than or Equal To | 12 | ltr | Return boolean result of comparison between LHS and RHS | `5 <= 5` => `true` |
| < | Less Than | 12 | ltr | Return boolean result of comparison between LHS and RHS | `4 < 5` => `true` |
| >= | Greater Than or Equal To | 12 | ltr | Return boolean result of comparison between LHS and RHS | `5 >= 5` => `true` |
| > | Greater Than | 12 | ltr | Return boolean result of comparison between LHS and RHS | `4 > 5` => `false` |
| in | Member Test | 12 | rtl | Is LHS member of RHS (must have space after i.e. "in ") | `"time" in headers` => `true` |
| == | Equality | 11 | ltr | Is the LHS equal to the RHS? | `5 == 5` => `true`, `2 == "2"` => `false` |
| != | Not Equality | 11 | ltr | Is the LHS not equal to the RHS? | `5 != 5` => `false`, `2 != "2"` => `true` |
| & | Bitwise And | 10 | ltr | Apply a bitwise AND to LHS and RHS | `5 & 3` => `1` |
| ^ | Bitwise Xor | 9 | ltr | Apply a bitwise XOR to LHS and RHS | `5 ^ 3` => `6` |
| \| | Bitwise Or | 8 | ltr | Apply bitwise OR to LHS and RHS | `5 \| 3` => `7` |
| && | Logical And | 7 | ltr | Are both the LHS and RHS truthy? Returns RHS or `false`. | `0 && 1` => `false` |
| \|\| | Logical Or | 6 | ltr | Is either LHS or RHS truthy? | `0 \|\| 1` => `1` |
| ?? | Nullish Coalescing | 5 | ltr | Returns LHS unless LHS is undefined, in which case return RHS | `undefined ?? 2` => `2` |
| := | Constant Assignment | 3 | rtl | Assigns the RHS to the LHS as a constant | `PI := 3.14159` => `3.14159` |
| = | Assignment | 3 | rtl | Assigns the RHS to the LHS | `name = "john"` => `"john"` |
| , | Comma | 1 | ltr | Returns RHS argument | `1, 2` => `2` |

*ltr = left-to-right*

*rtl = right-to-left*

## keywords
### `if`, `else`
An `if` structure consists of a condition and a block. If may have additional conditions and blocks using the `else if` statement, and a final block after `else`.

Syntax: `if (<condition>) {<block>} [else if (<condition> <block>), [...]] [else <block>]`

If the `<condition>` is truthy, the `<block>` is executed and the rest of the structure is skipped. If no `if` or `else if` blocks is executed, the `else` block will execute.

The last statement in the `{<block>}` that is run will be returned from the `if` statement e.g. `a = if (1) { "Yes" }; print(a);` --> `"Yes"`

This means that ternary operators kind-of exist: `<var> = if (<cond>) { <truthy> } else { <falsy> }`

### `do`
Defined the following as a block. (*NB this is largely redundant and does nothing - the keyword is simply removed at runtime*)

Syntax: `do {<block>}`

Defines following `{...}` as a block and executes it

### `while`
A `while` structure consists of a condition and a block.

`while (<condition>) {<block>}`
- Execute `<block>` while `<condition>` is truthy

`{<block>} while (<condition>)`
- Execute `<block>` and continue to execute `<block>` while `<condition>` is truthy

### `until`
An `until` structure consists of a condition and a block.

`until (<condition>) {<block>}`
- Execute `<block>` until `<condition>` is truthy

`{<block>} until (<condition>)`
- Execute `<block>` and continue to execute `<block>` until `<condition>` is truthy

*Basically an opposite while loop - `while` runs while true, `until` runs while false*

### `loop`
Syntax: `loop {<block>}`

Runs `{<block>}` infinitely until broken out of (like `while (true)` or `for(;;)`)

### `for`
Syntax: `for (<action>) {<block>}`

`(<action>)` in form `(<vars> in <collection>)`
- `vars` : comma-seperated list of variables e.g. `a, b, c`. These will be allocated sepending on the collection.
- `collection` : the value must be iterable (the method `__iter__` will be called). The variables in `var` will be assigned from this value as follows:
  - If `collection` is a linear array, one variable is expected and will contain each value in `collection` each iteration
  - If `collection` is a 2D array, and there is one variable, this variable will contain the array value in `collection` each iteration
  - If `collection` is a 2D array, and there are multiple variable, the number of variables must match the length of the array value in `collection` and each value from the array will be unpacked into the corresponding variable each Iteration

  See examples in `tests/for-in`

`(<action>)` in form `(init; cond; step)`:
- `init` : this is executed before the loop begins
- `cond` : the loop runs while `<cond>` is truthy. If empty, this will evaluate to `true`.
- `step` : this is executed after each loop iteration
Each one of these may be empty e.g. to construct an infitite loop: `for(;;)` where each `init`, `cond` and `step` is empty (empty `cond` is truthy).

### `func`
Syntax: `func [name] (<args>) {<block>}`

This defines a function. `name` is optional.
- If `name` is present, this defines a function and stores it in the current scope under a variable called `name`. No value is returned.
- If `name` is absent, an anonymous function is created and a reference is returned. As such, a trailing semicolon must be included after `{<block>};`

i.e. `func hello() { print("Hello"); }` and `hello = func() { print("Hello"); };` achieve the same result.

- `<args>` is a comma-seperated list of identifiers. Types may be defined as a `?` before the type i.e.:
  - `func fn(a)` -> function `fn` takes an argument `a` of type `any`
  - `func fn(a: ?any)` -> function `fn` takes an optional argument `a` of type `any` (*NB for optional arguments, a type must be present*)
  - `func fn(a: real)` -> function `fn` takes an argument `a` of type `real`
  - `func fn(a: ?real)` -> function `fn` takes an optional argument `a` of type `real`