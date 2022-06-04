# Libraries

This document contains basic descriptions of every library available **by default** in `imports/`. Code in this folder may be imported by using `<>` brackets surrounding the name e.g. `import("<io>")` imports `imports/io.js`

Library test scripts will be in `./libs/`

## `<console>`

Defines functions which manipulate STDOUT (doesn't work in certain consoles), such as changing background/foreground colours.

Functions all begin with 'c_' e.g. 'c_fg', 'c_reset'

## `<fs>`

Defines basic functions for filesystem managment

- `fexists(file: string): bool` - checks if the file exists
- `fread(file: string): string` - reads the contents of `file` and returns as a string
- `fwrite(file: string, data: string)` - writes `data` to `file`
- `fdelete(file: string): bool` - attempts to delete `file`
- `mkdir(path: string): bool` - attempts to create a directory at `path`
- `isdir(path: string): bool` - returns boolean indicating whether given `path` is a directory
- `lsdir(path: string): array` - returns array of all file in directory `path`
- `rmdir(path: string, recurse: ?bool): bool` - attempts to delete the directory at `path`

## `<io>`

Define basic I/O functions

- `clear()` - clears STDOUT
- `input(p: ?string): string` - prints prompt `p` to STDOUT, and waits for user input (until user presses `Enter`)
- `error(str: string)` - throws error internally with description `str`
- `print(o: any)` - prints `o` to STDOUT
- `printf(o: any, ...fmt: array)` - formats `o` with formatting `fmt` and prints to STDOUT
- `println(o: any)` - prints `o` to STDOUT followed by a newline

## `<logsumexp>`

Define function `logsumexp(values: array, w: ?real)` which:

- If applicable, applies constant weight (`type(w) => real`) to each arg, or applies each weight to the corresponding arg (`type(w) => array`)
- Applies `exp()` to each argument
- Calculates the sum of the arguments
- Takes the logarithm (base10) of the arguments

See https://en.wikipedia.org/wiki/LogSumExp

## `<matrix>`

Defines type `matrix` and several useful functions for manipulating matrices (complex numbers)

## `<process>`

**WIP**

Defines functions for manipulating the current process

- `pid(pid: ?real)` - gets/sets the current process ID (**Setting PID is undefined behaviour**)

Eventually, this module will hold the ability to create new processes, run code "simultaneously" and similar

## `<regex>`

Defines functions for using regular expressions (NodeJS flavour)

- `regex_match(input: string, pattern: string, flags: ?string): array` - returns array of matches resulting in matching `pattern` against the input string `input` using the given flags
- `regex_find(input: string, pattern: string, flags: ?string): array` - like `regex_match`, but returns array of `map`s which contain more detailed match information
- `regex_test(input: string, pattern: string, flags: ?string): bool` - returns boolean indicatig if the pattern matched `input`

## `<sum>`

Defines function `sum(items: array): complex` which returns the sum of the arguments (casts `items` to array of `complex`)

## `<timeit>`

Defines function `timeit(fn: func, args: ?array, iterations: ?real_int): real`. Exeutes function `fn` `iterations=1` number of times, given `args` as arguments. Returns time elapsed to execute.

## `<vector>`

Define type `vector` and a function to create the type