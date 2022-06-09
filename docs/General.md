# TriflicScript Docs

See `./README.md` and `docs/README.md` before reading this document.

This document contains general documentation of the TriflicScript language.

## Built-Ins
Base definitions to a `Runspace` instance are present in `src/def.js`
For more information on built-ins, enter `help()`.

### Variables
- `ans` : `any`. Present if `--ans` is truthy. Contains value of last executed expression.
- `_isMain` : `bool`. Boolean indicating if script was run or is imported.
- `headers` : `map`. Contains all headers used to initialise the application, including the value of all CLI argument described above.

### `exit(code: ?real_int)`
**NB no longer unceremoniously calls `process.exit()`

Exits the current script execution (sets eval flag to `-1`) with a current code.

After everything is cleared up, calls `#<Runspace>.onExitHandler(code)`

### `import(file: string)`
Internal: calls `#<Runspace>.import()`

This functions is used to import scripts into the current runspace. `file` may be any valid file.

If in format `<file>`, the full path to the imported file is resolves as follows: `root + "imports/" + file + ".js"` where
- `currentWorkingDirectory` is the path of the directory in which `cli.js` lies. Note that this is always static to `cli.js`, not to the current executing file.
- `"imports/"` is a standard directory where all core JavaScript import files are kept
- `file` is the argument to the function
Essentially, any file in `<>` are built-in JavaScript import files

Else, `file` loads and executes the file. Path is relative to the current file. (see import stack in `import_stack()`)

If the file is a `.js` (JavaScript) file:
- `module.exports` must be set to a single function
- `module.exports` is called (with `await`) with two argument: `await module.exports(#Runspace, exec_instance)`

Any other extension:
- The file is read
- The file contents are passed into `Runspace#execute`

For details on each library, see `Libraries.md`

## Internal Methods
Some functions call a method of the argument. As such, implementation may be changed by external code.

- `del(a, b)` calls `a.__del__(b)`
- `copy(a)` calls `a.__copy__()`
- `len(a, ?b)` calls `a.__len__(b)` (`b` is used to set length of object)
- `abs(a)` calls `a.__abs__()`
- `getprop(a, b)` calls `a.__get__(b)`. Used by `<a>.<b>`.
- `setprop(a, b, c)` calls `a.__set__(b, c)`. Used by `<a>.<b> = <c>`
- `reverse(a)` calls `a.__reverse__()`
- `find(a, b)` calls `a.__find__(b)`
- `min(a)` calls `a.__min__()`
- `max(a)` calls `a.__max__()`

## Input
A program may be interpreted and executed via `Runspace#execute`

- `Runspace#parse` takes source code and returns an array of `TokenLine` objects
- `Runspace#interpret` takes `TokenLine[]` and evaluates them

## Syntax

There is no syntax highlighter for TriflicScript, although syntax highlighting for the Rust language is suitable for TriflicScript.

### Literals
These are structures in the code which define values:

- `// ...` - single line comment. Ends on a newline `\n` (ignored)
- `/* ... */` - multiline comment. Ends on `*/` (ignored)
- `123...` define numbers. Numbers:
  - May start with a sign `+/-`. Default is `+`.
  - Radix indicator `0[x|b|o|d]`. Default is `d`.
  - Digits in the declared base (these are optional)
  - A decimal point `.`
  - More digits in the decimal point
  - An exponent `e`, followed by another valid number (note, this number may not contain `e`)
  - Numbers may end with the imaginary letter which by default is `i` to make it imaginary
  *N.B.* Numbers may contain the seperator `_`. This cannot be at the start/end of a number.

- `"..."` represents a strings.
  - `{...}` inside the string is string interpolation.
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
- `x([0-9A-Fa-f]+)` - inserts character with hexadecimal ascii code of `[0-9A-Fa-f]+` into literal.
- `o([0-7]+)` - inserts character with octal ascii code of `[0-7]+` into literal.
- `d([0-9]+)` - inserts character with decimal ascii code of `[0-9]+` into literal.

### Strings
Syntax: `"..."`

Strings are sequences of characters. A character is defined by `'...'` and behaves like a `real`.

#### Interpolation
Syntax: `"{<expr>}"`

This is the method of inserting values into string literals.

Strings may be interpolated by placing an expression inside `{}`. This may be any valid expression and is evaluated at runtime.

Notable features include:
- `{...=}` - if `=` is the last token in `<expr>`, the unevaluated `<expr>` is inserted before the evaluated `<expr>`
  - `"{pi=}"` -> `pi=3.14159`
  - `"{sin(1)=}"` -> `sin(1)=0.8414709848078965`
  
  Note that this only happens if `<expr>` contains something other then `=`.

#### Formatting
Syntax: `<string> % <values>`

- `<string>` - a string `"..."`.
- `<values>` - a single value or an array of values. These are inserted into the string at `%<opt>`

- `%<opt>` - A value is inserted into the string at any `%`. Following the `%` is a format identifier, which tells the program how to format the value prior to interpolation. If not `<opts>` is given, it is treated as `%s`.
  - `%` - One `%` is removed e.g. `"100%%"` -> `"100%"`
  - `s` - String
  - `n` - Number (complex)
  - `i` | `ci` - Complex integer
  - `ri` - Real integer
  - `c` - Character
  - `b` - Boolean
  - `o` - Complex octal
  - `d` - Complex decimal
  - `x` - Complex hexadecimal (lowercase)
  - `X` - Complex hexadecimal (uppercase)
  - `e` - Complex exponential form (lowercase)

If there are more `%`s than values, insert as may values as there are and preserver any other `%`s

If there are less `%`s than values, append left-over values onto end of string, seperated by spaces, as if `%s` was present.

### Variables
Variables store values in memory. There are some predefined variables.

Variables may be assigned to using the `=` assignment operator. Variables may be functions.

- Assignment using `=`:
  - Creates a new local variable `symbol` with value `value`

- Assignment using `=>`
  - Sets `symbol` to `value`. If no binding to `symbol` exists, throws an error.

- Declaration using `let`
  - Declares variable `symbol` in given scope to `undef`

The `ans` variable contains the value of the last executed line. e.g. `2 + 1; ans` -> `3`

#### Unpacking

Unpacking refers to extracting and defining multiple variables from a single value

- Array unpacking

An array assignation expression takes the form `[<symbols>] = [<values>]` where `<symbols>` is a comma-seperated list of symbols. Each variable is assigned to its matching value, or `undef` if there is none.

e.g. `[a, b] = [1, 2]` => `a = 1, b = 2`.

- Map unpacking

A map assignation expression takes the form `{<symbols>} = <map>` where `<symbols>` is a comma-seperated list of symbols. Each variable is assigned to its matching value in `<map>` where `<symbol>` acts as the key, or `undef` if there is no matching key.

e.g. `{a, b} = [b: 11, a: "hi"]` => `a = "hi", b = 11`.

**See `tests/unpacking` for full examples.

### Functions
Functions recieve arguments and return a value.

There are two types of functions: `built-in`s and `user-defined`
- `built-in`s are pre-defined internally using JavaScript.
- `user-defined`s are defined by the user
  - Via `func` keyword
  - Via a lambda

#### lambda
A lambda is a short-hand syntax for defining single-line, anonymous functions

Syntax: `<args>[: <returnType>] -> <body>`
- `<args>` - either a single symbol e.g. `x` or an argument list e.g. `(x, y: ref string)`
- `<returnType>` - return type of function
- `<body>` - function body. Either a block `{...}`, or up to `;` or `,`

`f = x -> x * 2` is equivalent to `f = func(x) { x * 2 }`

If appears at beginning of a line, may have this special format: `<name> -> <body>` to define a function without any arguments called `name`. This will define the function without returning a reference

`hi -> "Hello"` is equivalent to `func hi { "Hello" }`

See `func` keyword for more information.

### Ellipse `...`
The ellipse is part of syntax rather than an operator. Its behaviour depends on the context:

- In function definition e.g. `sum = (...nums) -> reduce(sums, (a,b)->a+b);`
  - Collapses arguments into an array

  *See the func keyword for more*

  `sum(1, 2, 3)` -> `6`
- In call operator: `sum(...<thing>)`
  - Expands `<thing>` into multiple arguments and passes to function
  - **Note** this is done be casting `<thing>` to an array, so e.g. `fn(...1)` will result in an error

### Operators
See `Operators.md` for detailed operator help.

| Operator | Name | Precedence | Associativity | Description | Example | Method |
| -- | -- | -- | -- | -- | -- | -- |
| . | Member Access | 20 | ltr | Get member on RHS of LHS object | `headers.time` => `1630433878509` | `__get__` |
| [\<prop\>] | Computed Member Access | 20 | ltr | Evaluate `<prop> and` get member `<prop>` of LHS object | `headers["time"]` => `1630433878509` | `__get__` |
| \<fn\>(\<args\>) | Function Call | 20 | ltr | Call function `<fn>` with arguments `<args>` | `sin(1)` => `0.84...` | `__call__` |
| ?. | Optional Member Access | 20 | ltr | Get member on RHS of LHS object. If RHS is undef, return undef | `undef?.1` => `undef` | `__get__` |
| deg | Degrees | 18 | rtl | Take LHS as degrees and convert to radians | `180 deg` => `3.14159265359` | `__deg__` 
| ~ | Bitwise NOT | 17 | rtl | Bitwise NOT value on LHS | `~20` => `-21` | `__bitwiseNot__` |
| + | Unary plus | 17 | rtl | Convert LHS to number | `+"14"` => `14` | `__pos__` |
| - | Unary minus | 17 | rtl | Convert LHS to number and negate | `-"14"` => `-14` | `__neg__` |
| \<type\> | Type cast | 17 | rtl | Casts RHS to type `type` | `<bool>12` => `true`, `<array>"Hi"` => `["H","i"]` | `castTo` |
| ! | Logical Not | 17 | rtl | Returns opposite boolean value | `!0` => `true` | `__not__` |
| ** | Exponentation | 16 | rtl | Returns LHS to the power of the RHS | `2 ** 4` => `16` | `__pow__` |
| : | Sequence | 16 | rtl | Attempts to create sequence from LHS to RHS | `3:7` => `[3,4,5,6]`, `"a":"f"` => `["a","b","c","d","e"]` | `__seq__` |
| / | Division | 15 | ltr | Divide LHS by RHS | `5 / 2` => `2.5` | `__div__` |
| % | Modulo/Remainder/String Format | 15 | ltr | Return remainder of LHS divided by RHS, or interpolate items in RHS to string RHS | `5 % 2` => `1` | `__mod__` |
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
| in | Member Test | 12 | rtl | Is LHS member of RHS | `"time" in headers` => `true` | `__in__` |
| == | Equality | 11 | ltr | Is the LHS equal to the RHS? | `5 == 5` => `true`, `2 == "2"` => `false` | `__eq__` |
| != | Not Equality | 11 | ltr | Is the LHS not equal to the RHS? | `5 != 5` => `false`, `2 != "2"` => `true` | `__neq__` |
| & | Bitwise And | 10 | ltr | Apply a bitwise AND to LHS and RHS | `5 & 3` => `1` | `__bitwiseAnd__` |
| ^ | Bitwise Xor | 9 | ltr | Apply a bitwise XOR to LHS and RHS | `5 ^ 3` => `6` | `__xor__` |
| \| | Bitwise Or | 8 | ltr | Apply bitwise OR to LHS and RHS | `5 \| 3` => `7` | `__bitwiseOr__` |
| && | Logical And | 7 | ltr | Are both the LHS and RHS truthy? Returns RHS or `false`. | `0 && 1` => `false` | `__and__` |
| \|\| | Logical Or | 6 | ltr | Is either LHS or RHS truthy? | `0 \|\| 1` => `1` | `__or__` |
| ?? | Nullish Coalescing | 5 | ltr | Returns LHS unless LHS is undef, in which case return RHS | `undef ?? 2` => `2` | n/a |
| ?: | Conditional | 4 | rtl | syntax `(<cond>) ? (<ifTrue>) [: (<ifFalse>)]` | `(0) ? ("Yes") : ("No")` => `"No"`, (0) ? ("Yes")` => `false` | n/a |
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

Syntax: `if (<condition>) {<block>} [else if (<condition>) {<block>}, [...]] [else {<block>}]`

If the `<condition>` is truthy, the `<block>` is executed and the rest of the structure is skipped. If no `if` or `else if` blocks is executed, the `else` block will execute.

The conditional operator is a one-line alternative to IF. See the `Operators` table above. See `programs/tests/conditional-op`

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
  - A map `{ key: value }` is considered as `[[key, value]]` for the above calculations

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
Syntax: `func [name] [(<args>)][: <rettype>] {<block>}`

This defines a function. `name` is optional.
- If `name` is present, this defines a function and stores it in the current scope under a variable called `name`. No value is returned.
- If `name` is absent, an anonymous function is created and a reference is returned. As such, a trailing semicolon must be included after `{<block>};`

i.e. `func hello() { print("Hello"); }` and `hello = func() { print("Hello"); };` achieve the same result.

- `<args>` is a comma-seperated list of identifiers. Syntax: `[...][?]<arg>[: ["val"|"ref"] [?]<type>][= <value>]`. If ommited, the function takes no parameters
  - `<arg>` - argument name
  - `[...]` - marks parameter as compact.
    - Must only be one parameter
    - Parameter must be pass-by-value
    - When called, this parameter takes any arguments and combines them into an array.
  
    Examples given `f = (a, ...b, c) -> ;`
    - `f(1,2)` -> `a=1, b=[], c=2`
    - `f(1,2,3)` -> `a=1, b=[2], c=3`
    - `f(1,2,3,4,5)` -> `a=1, b=[2,3,4], c=5`
  - `[?]`: A question marke prefixing the type marks if the parameter is optional or not. If optional and a value is not provided, `undef` is passed as the parameter's value.
  - `[:]` - marks that the following information is describing the argument
  - `["val"|"ref"]`: pass-by method of the argument. Is not present, default is `val`.
    - `val`: pass-by-value. The value provided for this argument is **copied** into a new local variable upon calling.
    - `ref`: pass-by-reference. The value provided for this argument is **transfered** into a new local variable upon calling (i.e. changing argument will change variable). This is suggested when the value will not be changed inside the function (as this will save copying the value and therefore speed and memory space).
  - `<type>`: The type of the argument.
  - `[?]`: Supported for legacy reasons. Syntax error is previous `?` was encountered before parameter name.
  - `=`: marks following as default value if parameter is omitted
  - `<value>`: default value of the parameter if ommited (may only be a single token e.g. can't be '1 + 2' but may be `(1 + 2)`)

- `<rettype>` is the return type of the function
  - Default is `any`
  - Value returned from function is casted to `<rettype>`

- `<block>` is the body of the function. This code is executed on invocation.

Examples:
  - `func fn(a)` -> function `fn` takes an argument `a` of type `any`
  - `func fn(a: ?<type>)` -> function `fn` takes an optional argument `a` of type `<type>`
  - `func fn(a: ref <type>)` -> function `fn` takes a pass-by-reference argument `a` of type `<type>`
  - `func fn(a: <type>): <rtype>` -> function `fn` takes an argument `a` of type `<type>` and returns type `<rtype>`

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

### `switch`
Syntax:
```
switch (<match>) { 
  case (<value>)[, (<value2>)[, ...]] { <block> }
  [else { <block> }]
}
```

Tests the value `<match>` against each case `<value>`. If a case `<block>` is enetered, the rest of `case`s are skipped. `else` is executed if no `case` is matched.

### `label`
Syntax: `label <label>`

Defines a label at the current position.
- `<label>` is any valid symbol

`label` statements are executed before the rest of the program. As such, they prior to the `label` statement e.g. `goto here; ...; label here`

Labels are defined from the current scope upwards. Multiple labels may exit in different scopes, but in higher scopes the latter will be referenced when the label is used.

Labels may be references no matter the scope - whether it is in a higher or lower scope, or if the block the `label` lies in has been executed yet.

### `goto`
Syntax: `goto <label>`

**Unstable**

Jumps to label `<label>` and continues execution from that point.
- `<label>` is a label created by the `label` statement.

A `goto` statement may reference a label before is is defined via `label`. This is due to the `label` statement being evaluated before the progam.

This keyword is dangerous and behaviour is undefined when used to jump across scopes. No scope managment or the like is carried out.

It is **not** recommended to jump across scopes i.e. jumping into a function

### `let`
Syntax: `let <symbol>`

Defines variable `<symbol>` in the local scope. May be a single symbol, an array of symbols or a set of symbols.

Used to ensure that `<symbol>` is a local variable. See `tests/let` for examples.

### `true`
Syntax: `true`

Represent the truthy boolean value

### `false`
Syntax: `false`

Represent the falsey boolean value

### `begin`, `end`
Use to open/close blocks. They are equivalent to using `{` and `}`.

`func f(x) begin x + 1 end`

is equivalent to

`func f(x) { x + 1 }`

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
| `undef` | Represents an absent value. As such, this is not really a type. | `No` | `No` | `undef` |

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

## Inheritance
TriflicScript supports a an extremely simple inheritance, wherein `map` types may be an instance of, and inherit from other `map` types. Inheritance links `map`s together and allows inherited maps to use parent `map`s properties and methods.

When instantiated, the inheritance tree if traversed. Any property which is not a function will be deep copied into the newly created `map`.
When a map is instantiated, it There are multiple ways be instantiate a map (i.e. create a copy from a template):
- Use the `new` function. Calling `call($map)` will instantiate `$map` and return it.
- `$map(...args)` has two cases. If `$map._Construct` is not defined, `$map` is instantiated and returned. If it is defined, `$map._Construct(...args)` will be called, with a reference to the newly instantiated `$map` being passed as the first argument.
  - `_Construct` must have at least one argument
  - The first argument must have the following signature: `[name]: ref map`
  - `_Construct` must not return a value (the returned value is ignored)

Call `isinstance(A, B)` to test if `A` is an instance of `B`

To inherit from a `map`, use the built-in `inherit()` function. For example, if `B` is to inherit from `A`, define and bind `A` and `B`, then call `inherit(A, B)`.
Call `inherit(A)` to return a `set` of `map`s that `A` is inherited from.

When instantiating a `map` which is inherited from other `map`s, nothing happens behind the scenes. The programmer must include calls to the appropriate constructors in `_Construct`. Continuing the example above, in `B`s constructor there would be `A._Construct(self, ...)` (**not** `A(self, ...)`).

When calling a method (function) on a map instance, the map will be automatically passed as the first argument.
- Any methods designed to be called by instances must take at least one argument
- For a method to be able to modify the passed instance, it must be a `ref map` argument

* Note, TriflicScripts inheritance model uses the maps themselves. The bound name does not matter; the name could be changed, or the symbol deleted entirely, and any inheriting maps would continue to work*

See `docs/inherit/`