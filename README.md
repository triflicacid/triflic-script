# NodeJS Scripting Language
Started as a single-line maths-focused interpreter, allowing for maths involving complex number

Now, supports multi-line programs with basic control structures. Due to origins this program, the interpreter has some quirks.

If I has known how this would progress, I would've written this in Java or C++ for speed. As this is written in JavaScript, it is pretty slow: my script is interpreted (probably pretty badly), which is then interpreted by JavaScript's V8 and run as C++. Not very fast :(.

For more help, see `programs/` and the built-in `help` function.

## Important Notes
- Inline function definitions in format `<name>(<args>) = ...` has been disabled
- Short-circuiting does not work. This applies to `&&`, `||`, `??` and `?.`

## TODO
- Nested-expression shortcut. Currently, `a = [a]` infinity recurses as a is equal to an array containing itself. Detecting this and printing e.g. `...` or `<ref a>` would be optimal.
- Do more syntax checking in initial `_tokenify` e.g. cannot be two consecutive constant values e.g. `<number|ientifier> <number|identifier>` will throw.
- proper block-scoped variable scoping (current system doesn't work well with e.g. recursion)
- String interpolation via `{}`
- Expandable/Collapsable argument arrays via `...`

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
- `multiline` : `boolean`. Does the CLI allow multiline input?
- `time` : `boolean`. CLI times each line of execution and displays it.
- `dir` : `string`. Sets import directory.

## Built-Ins
Base definitions to a `Runspace` instance are present in `src/def.js`
For more information on built-ins, enter `help()`.

### `import(file: string)`
This functions is used to import scripts into the current runspace. `file` may be any valid file.

If in format `<file>`, the full path to the imported file is resolves as follows: `currentWorkingDirectory + "imports/" + file + ".js"` where
- `currentWorkingDirectory` is the path of the directory in which `cli.js` lies
- `"imports/"` is a standard directory where all core JavaScript import files are kept
- `file` is the argument to the function
Essentially, any file in `<>` are built-in JavaScript import files

Else, `file` acts as the path from the `cli.js` file.

If the file is a `.js` (JavaScript) file:
- `module.exports` must be set to a single function
- `module.exports` is called (with `await`) with one argument, being the active `Runspace` instance.

Any other extension:
- The file is read
- The file contents are passed into `Runspace#execute`

## Magic Methods
Some functions call a method of the argument. As such, implementation may be changed by external code.

- `del(a, b)` calls `a.__del__(b)` (NB with one argument `del(a)` does not)
- `copy(a)` calls `a.__copy__()`
- `len(a)` calls `a.__len__()`
- `abs(a)` calls `a.__abs__()`
- `get(a, b)` calls `a.__get__(b)`
- `set(a, b, c)` calls `a.__set__(b, c)`
- `reverse(a)` calls `a.__reverse__()`
- `find(a, b)` calls `a.__find__(b)`

## Input
A program may be interpreted and executed via `Runspace#execute`

- `Runspace#parse` takes source code and returns an array of `TokenLine` objects
- `Runspace#interpret` takes `TokenLine[]` and evaluates them

### Syntax

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

- `"..."` represents a strings.
- `[...]` represents an array
- `{...}` represents a set, map or a block
  - **Block** if keyword structure expects a block and `{...}` is present e.g. `do {...}`, `if (...) {...}`.
  - **Map** if first element matches `<x>: ...`. To use to `:` as an operator, therefore, one must wrap `<x>:...` in parenthesis
  `{3:7}` would be interpreted as a map, but `{(3:7)}` would not.
  One cannot use this syntax to define an empty max, as `{}` would create a set.
  - Else, **set**.
- `'...'` is a character literal. Must be empty or contain one character.

Character escaped may appear in string and character literals. Any character following `\` (backslash) is escaped:
- `0` - null (`0x0`)
- `b` - non-destructive backspace (`0x8`)
- `t` - horizontal tab (`0x9`)
- `n` - line feed (`0xA`)
- `v` - vertical tab (`0xB`)
- `r` - carriage return (`0xD`)
- `s` - space (`0x20`)
- `x([0-9A-Fa-f]+)` - inserts character with hexadecimal ascii code of `[0-9A-Fa-f]+` into literal. (`0x([0-9A-Fa-f]+)`)
- Else, simply inserts following character into literal

### Variables
Variables store values in memory. There are some predefined variables (assuming `--define-vars` is truthy).

Variables may be assigned to using the `=` assignment operator. Variables may be functions.

- Assignment using `=`:
  - Does the variable exist?
  - If so, update the value of that variable
  - If not, create a new variable with the value

- Assignment using `let`
  - Defines a new variable in the current scope.

### Functions
Functions recieve arguments and return a value.

There are two types of functions: `built-in`s and `user-defined`
- `built-in`s are pre-defined internally using JavaScript.
- `user-defined`s are defined by the user
  - Inline via `<name>(<arg1>[, <arg2>[, ...]]) = ...`
  - Via `func` keyword

### Operators
See `Operators.md` for detailed operator help.

| Operator | Name | Precedence | Associativity | Description | Example | Method |
| -- | -- | -- | -- | -- | -- | -- |
| . | Member Access | 20 | ltr | Get member on RHS of LHS object | `headers."time"` => `1630433878509` | `__get__` |
| \<fn\>(\<args\>) | Function Call | 20 | ltr | Call function `<fn>` with arguments `<args>` | `sin(1)` => `0.84...` | `__call__` |
| ?. | Optional Member Access | 20 | ltr | Get member on RHS of LHS object. If RHS is undefined, return undefined | `undefined?.1` => `undefined` | `__get__` |
| deg | Degrees | 18 | rtl | Take LHS as degrees and convert to radians | `180 deg` => `3.14159265359` | `__deg__` 
| ~ | Bitwise NOT | 17 | rtl | Bitwise NOT value on LHS | `~20` => `-21` | `__bitwiseNot__` |
| + | Unary plus | 17 | rtl | Convert LHS to number | `+"14"` => `14` | `__pos__` |
| - | Unary minus | 17 | rtl | Convert LHS to number and negate | `-"14"` => `-14` | `__neg__` |
| \<type\> | Type cast | 17 | rtl | Casts RHS to type `type` | `<bool>12` => `true`, `<array>"Hi"` => `["H","i"]` | `castTo` |
| ! | Logical Not | 17 | rtl | Returns opposite boolean value | `!0` => `true` | `__not__` |
| ** | Exponentation | 16 | rtl | Returns LHS to the power of the RHS | `2 ** 4` => `16` | `__pow__` |
| : | Sequence | 16 | rtl | Attempts to create sequence from LHS to RHS | `3:7` => `[3,4,5,6]`, `"a":"f"` => `["a","b","c","d","e"]` | `__seq__` |
| / | Division | 15 | ltr | Divide LHS by RHS | `5 / 2` => `2.5` | `__div__` |
| % | Modulo/Remainder | 15 | ltr | Return remainder of LHS divided by RHS | `5 % 2` => `1` | `__mod__` |
| * | Multiplication | 15 | ltr | Multiply LHS by RHS | `5 * 2` => `10` | `__mul__` |
| ∩ | Intersection | 15 | ltr | Find the intersection between the LHS and RHS | `{1,2} ∩ {2,3}` => `{2}` | `__intersect__` |
| ∪ | Union | 14 | ltr | Find the union between the LHS and RHS | `{1,2} ∪ {2,3}` => `{1,2,3}` | `__union__` |
| + | Addition | 14 | ltr | Add RHS to LHS | `5 + 2` => `7` | `__add__` |
| - | Subtraction | 14 | ltr | Subtract RHS from LHS | `5 - 2` => `3` | `__sub__` |
| >> | Right Shift | 13 | ltr | Bit shift LHS right by RHS places | `5 << 2` => `20` | `__rshift__` |
| << | Left Shift | 13 | ltr | Bit shift LHS left by RHS places | `5 << 2` => `1` | `__lshift__` |
| <= | Less Than or Equal To | 12 | ltr | Return boolean result of comparison between LHS and RHS | `5 <= 5` => `true` | `__le__` |
| < | Less Than | 12 | ltr | Return boolean result of comparison between LHS and RHS | `4 < 5` => `true` | `__lt__` |
| >= | Greater Than or Equal To | 12 | ltr | Return boolean result of comparison between LHS and RHS | `5 >= 5` => `true` | `__ge__` |
| > | Greater Than | 12 | ltr | Return boolean result of comparison between LHS and RHS | `4 > 5` => `false` | `__gt__` |
| in | Member Test | 12 | rtl | Is LHS member of RHS (must have space after i.e. "in ") | `"time" in headers` => `true` | `__in__` |
| == | Equality | 11 | ltr | Is the LHS equal to the RHS? | `5 == 5` => `true`, `2 == "2"` => `false` | `__eq__` |
| != | Not Equality | 11 | ltr | Is the LHS not equal to the RHS? | `5 != 5` => `false`, `2 != "2"` => `true` | `__neq__` |
| & | Bitwise And | 10 | ltr | Apply a bitwise AND to LHS and RHS | `5 & 3` => `1` | `__bitwiseAnd__` |
| ^ | Bitwise Xor | 9 | ltr | Apply a bitwise XOR to LHS and RHS | `5 ^ 3` => `6` | `__xor__` |
| \| | Bitwise Or | 8 | ltr | Apply bitwise OR to LHS and RHS | `5 \| 3` => `7` | `__bitwiseOr__` |
| && | Logical And | 7 | ltr | Are both the LHS and RHS truthy? Returns RHS or `false`. | `0 && 1` => `false` | `__and__` |
| \|\| | Logical Or | 6 | ltr | Is either LHS or RHS truthy? | `0 \|\| 1` => `1` | `__or__` |
| ?? | Nullish Coalescing | 5 | ltr | Returns LHS unless LHS is undefined, in which case return RHS | `undefined ?? 2` => `2` | n/a |
| = | Assignment | 3 | rtl | Assigns the RHS to the LHS (creates new symbol binding) | `name = "john"` => `"john"` | `__assign__` |
| => | Nonlocal Assignment | 3 | rtl | Assigns the RHS to the LHS (uses existing symbol binding) | `name => "john"` => `"john"` | `__nonlocalAssign__` |
| += | Addition Assignment | 3 | rtl | Assigns RHS to RHS + LHS | `a = 10, a += 2, a` => `12` | `__assignAdd__` |
| -= | Subtraction Assignment | 3 | rtl | Assigns RHS to RHS - LHS | `a = 10, a -= 2, a` => `8` | `__assignSub__` |
| *= | Multiplication Assignment | 3 | rtl | Assigns RHS to RHS * LHS | `a = 10, a *= 2, a` => `20` | `__assignMul__` |
| /= | Division Assignment | 3 | rtl | Assigns RHS to RHS / LHS | `a = 10, a /= 2, a` => `5` | `__assignDiv__` |
| %= | Modulus Assignment | 3 | rtl | Assigns RHS to RHS % LHS | `a = 10, a %= 3, a` => `1` | `__assignMod__` |
| , | Comma | 1 | ltr | Returns RHS argument | `1, 2` => `2` | n/a |

*ltr = left-to-right*

*rtl = right-to-left*

## Keywords
### `if`, `else`
An `if` structure consists of a condition and a block. If may have additional conditions and blocks using the `else if` statement, and a final block after `else`.

Syntax: `if (<condition>) {<block>} [else if (<condition> <block>), [...]] [else <block>]`

If the `<condition>` is truthy, the `<block>` is executed and the rest of the structure is skipped. If no `if` or `else if` blocks is executed, the `else` block will execute.

The last statement in the `{<block>}` that is run will be returned from the `if` statement e.g. `a = if (1) { "Yes" }; print(a);` --> `"Yes"`

This means that ternary operators kind-of exist: `<var> = if (<cond>) { <truthy> } else { <falsy> }`

### `do`
Defined the following as a block, meaning the block does not need to follow a control-flow statement such as `if`.

Syntax: `do {<block>}`

Defines following `{...}` as a block and allows `break` and `continue` to be used.

### `while`
A `while` structure consists of a condition and a block.

`while (<condition>) {<block>} [then {<block>}]`
- Execute `<block>` while `<condition>` is truthy
- If `then` is present: execute `then <block>` when `<condition>` is falsy

`{<block>} while (<condition>) [then {<block>}]`
- Execute `<block>` and continue to execute `<block>` while `<condition>` is truthy
- If `then` is present: execute `then <block>` when `<condition>` is falsy

### `until`
An `until` structure consists of a condition and a block.

`until (<condition>) {<block>} [then {<block>}]`
- Execute `<block>` until `<condition>` is truthy
- If `then` is present: execute `then <block>` when `<condition>` is falsy

`{<block>} until (<condition>) [then {<block>}]`
- Execute `<block>` and continue to execute `<block>` until `<condition>` is truthy
- If `then` is present: execute `then <block>` when `<condition>` is falsy

*Basically an opposite while loop - `while` runs while true, `until` runs while false*

### `loop`
Syntax: `loop {<block>}`

Runs `{<block>}` infinitely until broken out of (like `while (true)` or `for(;;)`)

### `for`
Syntax: `for (<action>) {<block>} [then {<block>}]`

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

`[then {<block>}]`:
- If present: execute `then <block>` when loop terminates

### `then`
Syntax: `<...loop...> then {<block>}`

A keyword commonly used after loop statements.

`<block>` is executed after the loop terminates *naturally* (i.e. will not execute if `break`/`return` is used)

### `func`
Syntax: `func [name] (<args>) {<block>}`

This defines a function. `name` is optional.
- If `name` is present, this defines a function and stores it in the current scope under a variable called `name`. No value is returned.
- If `name` is absent, an anonymous function is created and a reference is returned. As such, a trailing semicolon must be included after `{<block>};`

i.e. `func hello() { print("Hello"); }` and `hello = func() { print("Hello"); };` achieve the same result.

- `<args>` is a comma-seperated list of identifiers. Syntax: `<arg>[: ["val"|"ref"] [?]<type>][= <value>]`.
  - `<arg>` - argument name
  - `:` - marks that the fllowing information is describing the argument
  - `["val"|"ref"]`: pass-by method of the argument. Is not present, default is `val`.
    - `val`: pass-by-value. The value provided for this argument is copied into a new local variable upon calling.
    - `ref`: pass-by-reference. The value provided for this argument must be a bound variable. Assigning to the parameter will alter the variable passed into the function.
  - `[?]`: A question marke prefixing the type marks if the parameter is optional or not. If optional and a value is not provided, `undefined` is passed as the parameter's value.
  - `<type>`: The type of the argument.
  - `=`: marks following as default value if parameter is omitted
  - `<value>`: default value of the parameter if ommited (*Note, may only be a single token e.g. can't be '1 + 2'*)

Examples:
  - `func fn(a)` -> function `fn` takes an argument `a` of type `any`
  - `func fn(a: ?<type>)` -> function `fn` takes an optional argument `a` of type `<type>`
  - `func fn(a: ref <type>)` -> function `fn` takes a pass-by-reference argument `a` of type `<type>`
  - `func fn(a: ref ?<type>)` -> function `fn` takes a pass-by-reference optional argument `a` of type `<type>`

### `break`
Syntax: `break`

Breaks out of the current loop.

### `continue`
Syntax: `continue`

Terminates current iteration of a loop and continue execution next iteration.

### `return`
Syntax: `return ...`

Terminates current function and returns values `...` from the function.

As everything is an expression and the last value is returned anyway, a `return` statement is not needed on the last line of a function.
i.e. the lines `a = func() { 1; }();` and `a = func() { return 1; }();` are essentially the same.

## Types
Variables all have a type which may change. New types may be added - see `imports/matrix.js` for an example.

- `type` -> the type name
- `description` -> description of the type
- `castable` -> can this be casted to i.e. cast value to `real` via `<real>`
- `initialisable` -> can this type be initialsed via `new("<type>")`

| Type | Description | Castable | Initialisable | Example |
| ---- | ----------- | -------- | ------------- | ------- |
| `any` | Represents any type. Used implicitly in functions when no argument type is provided | `Yes` | `No` | `5`, `"Hello"` |
| `real` | Represents any number without an imaginary component | `Yes` | `Yes` | `5`, `3.14` |
| `real_int`* | Represents a `real` integer | `Yes` | `Yes` | `5`, `3` |
| `complex` | Represents any number with an imaginary component. To make, multiple a `real` by `i` | `Yes` | `Yes` | `5i`, `3.14i` |
| `complex_int`* | Represents a `complex` integer | `Yes` | `Yes` | `5i`, `3i` |
| `string` | Represents a string of characters | `Yes` | `Yes` | `"Hello"` |
| `char` | Represents a single character which behaves like a `real` | `Yes` | `Yes` | `'a'` |
| `bool` | Represents a boolean value | `Yes` | `Yes` | `true`, `false` |
| `array` | Represents a collection of values | `Yes` | `Yes` | `[1, 2]`, `["H", true, [1]]` |
| `set` | Represents a unique collection of values (no repeated values) | `Yes` | `Yes` | `{1, 2}`, `{"H", true, [1]}` |
| `map` | Represents a collection of keys which map to a value | `Yes` | `Yes` | `{1: "a", 2: "b"}`, `{"name": "John Doe", "male": true}` |
| `func` | Contains a function reference which may be called | `No` | `No` | `sin`, `print` |
| `undefined` | Represents an absent value. As such, this is not really a type. | `No` | `No` | `undefined` |

*\*These types are never returned from `type()`*

## Scope
A `scope` is a lexical area in which variables may be defined. The concept of scope is managed by a stack, with entry into a scope pushing a new hashtable of symbols onto the scope stack.

Code blocks have the ability to create a new scope if they are `hard blocks`. A new scope is created when:
- `A program starts`
- `A function is called`
- `scope_push() is called`*

\* This artificially pushes a new symbol hash table to the scope stack. To remove the scope, call `scope_pop()`. This may cause unexpected effects when not used correctly (see `programs/scope_push`)

The assignation operator `=` assigns a value to a symbol **is the current scope**. A new binding for the symbol is created within the current lexical scope.

The assignation operator `=>` assigns a value to a symbol **which is not in the current scope**. It assigns the value to the next available binding to that symbol and, if non is found, an error is thrown.

See the programs in `programs/tests/scope` and compare the two functions.

The scope model is odd, as things like this will not work as `x` is not in the scope stack.
```
func counter() {
  x = 0;
  func() {
    x += 1;
    x;
  };
}
```