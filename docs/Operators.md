# Operators

There are some types listed that are general terms:
- `numeric` - any numeric type: `real` | `complex` | `char` | `boolean`
- `real-like` - `real` | `char` | `boolean`
- `complex-like` - `complex` | `char` | `boolean`
- `symbol` - a variable

| Operator | Argument 1 | Argument 2 | Action | Example |
| -------- | ---------- | ---------- | ------ | ------- |
| `+` | `any` | n/a | Casts arg1 to type `complex` | `+"5"` => `5` |
| `-` | `any` | n/a | Casts arg1 to type `complex` and negate | `-"5"` => `-5` |
| `!` | `any` | n/a | Casts arg1 to type `boolean` and inverts | `!1` => `false` |
| `in` | `any` | `array\|set` | Is arg1 an element present in arg2? | `2 in [1,2,3]` => `true` |
| `in` | `any` | `string` | Is arg1 a character in arg2? | `'o' in "Hello"` => `true` |
| `in` | `any` | `map` | Is arg1 a key in arg2? | `"name" in { "name": "Joe" }` => `true` |
| `!=` | `any` | n/a | Invert result of `==` | `1 != 2` => `true` |
| `&&` | `any` | `any` | Return arg2 if both arg1 and arg2 are truthy, else false | `1 && 2` => `2` |
| `||` | `any` | `any` | Return arg1/args if arg1/arg2 are truthy, else false of both falsy | `0 || 2` => `2` |
| `[...]` | `any` | n/a | Evaluate `[...]` and get property `...` of arg1 | `headers["time"]` => `1633036878666` |
| `==` | `undefined` | `any` | Return true if arg2 is undefined | `undefined == undefined` => `true` |
| `deg` | `numeric` | n/a | Converts arg1 from degrees to radians : `arg1 * (PI / 180)` | `180 deg` => `3.141592653589793` |
| `==` | `numeric` | `any` | Returns true if arg2 is numeric and the numbers are equivalent | `65 == 65.0` => `true` |
| `~` | `real-like` | n/a | Inverts bits of number (note: twos complement) | `~12` => `-13` |
| `&` | `real-like` | `real-like` | ANDs bits of numbers together | `12 & 20` => `4` |
| `\|` | `real-like` | `real-like` | ORs bits of numbers together | `12 & 20` => `28` |
| `^` | `real-like` | `real-like` | XORs bits of numbers together | `12 & 20` => `24` |
| `**` | `numeric` | `numeric` | Raises arg1 to arg2 | `2 ** 8` => `256` |
| `/` | `numeric` | `numeric` | Divides arg1 by arg2 | `10 / 2` => `5` |
| `%` | `numeric` | `numeric` | Divides arg1 by arg2 and returns the remainder | `10 / 3` => `1` |
| `*` | `numeric` | `numeric` | Multiplies arg1 by arg2 | `10 * 2` => `20` |
| `*` | `numeric` | `string` | Casts arg2 to a number and multiplies arg1 by arg2 | `10 * "2"` => `20` |
| `+` | `numeric` | `numeric` | Adds arg2 and arg2 | `5 + 3` => `8` |
| `+` | `numeric` | `undefined` | Returns `nan` | `10 + undefined` => `nan` |
| `+` | `numeric` | `string` | Concatenates arg1 (as a string) and arg2 | `10 + "2"` => `"102"` |
| `-` | `numeric` | `numeric` | Subtracts arg2 from arg1 | `10 - 3` => `7` |
| `-` | `numeric` | `string` | Casts arg2 to a number and subtracts arg2 from arg1 | `10 - "3"` => `7` |
| `<<` | `real-like` | `real-like` | Shifts arg1 arg2-bits to the left | `20 << 2` => `80` |
| `>>` | `real-like` | `real-like` | Shifts arg1 arg2-bits to the right | `20 << 2` => `5` |
| `<=` | `real-like` | `real-like` | Is arg1 less than or equal to arg2? | `12 <= 15` => `true` |
| `<` | `real-like` | `real-like` | Is arg1 less than arg2? | `12 < 15` => `true` |
| `>=` | `real-like` | `real-like` | Is arg1 greater than or equal to arg2? | `15 >= 12` => `true` |
| `>` | `real-like` | `real-like` | Is arg1 greater than arg2? | `15 > 12` => `true` |
| `:` | `real-like` | `real-like` | Generate a sequence arg1 to arg2 | `1:5` => `[1,2,3,4]` |
| `==` | `string` | `any` | Return true if arg2 is a string and equal to arg1, else false | `"Joe" == "Joe"` => `true` |
| `*` | `string` | `real` | Repeat arg1 arg2 times | `"$" * 5` => `"$$$$$"` |
| `+` | `string` | `any` | Concatenate arg1 and arg2 (as a string) | `"Hello" + "World"` => `"HelloWorld"` |
| `:` | `string` | `string` | arg1 and arg2 must be of length 1. Return sequence using ASCII codes between the two strings. | `"a":"e"` => `["a","b","c","d"]` |
| `[]` | `string` | `any` | arg2 is inside `[]`. Evaluate arg2 and get character (as a string) at index arg2 in array arg1. Note that assigning to this value will alter the original string. The inserted value will be casted to a `char`. | `str = "Hello"; str[0]; str[1] = 69; str;` => `"h", "HEllo"` |
| `%` | `string` | `any` or `array` | Interpolates items in arg2 into string at arg1 using formatting options | `"%s is %i" % ["Joe", 42]` => `"Joe is 42"` |
| `==` | `bool` | `any` | Returns true if arg2 is a bool and has same logical value | `true == true` => `true` |
| `~` | `bool` | n/a | Returns bitwise NOT of bool (true = 1, false = 0) | `~true` => `-2` |
| `&` | `bool` | `real-like` | ANDs arg1 and arg2 | `true & 5` => `1` |
| `\|` | `bool` | `real-like` | ORs arg1 and arg2 | `true | 5` => `5` |
| `^` | `bool` | `real-like` | XORs arg1 and arg2 | `true ^ 5` => `4` |
| `+` | `bool` | `numeric` | Adds arg1 and arg2 | `true + 1` => `2` |
| `[]` | `array` | `any` | arg2 is inside `[]`. Evaluate arg2 and get item at index arg2 in array arg1  | `argv[0]` => `"--intro"` |
| `=` | `array` | `array` | Assign each item in arg1 to the corresponding item in arg2, or `undef` | `[a,b] = [1,2]` => `a=1, b=2` |
| `=` | `set` | `map` | Assign each item in arg1 to the value of the corresponding key in arg2, or `undef` | `{app} = headers` => `app=CLI` |
| `==` | `array` | `any` | Return true is arg2 is array, they are of equal length and each item in arg1 equals each item in arg2 | `[1,2] == [1,2]` => `true` |
| `*` | `array` | `real` | Repeats contents of arg1 arg2 times | `[1] * 4` => `[1,1,1,1]` |
| `*` | `array` | `array` | Returns intersection (overlap) of arg1 and arg2 | `[1,2,3] * [0,1,2]` => `[1,2]` |
| `+` | `array` | `array` | Concatenates arg1 and arg2 | `[1,2] + [3,4]` => `[1,2,3,4]` |
| `+` | `array` | `any` | Pushes arg2 onto arg1 | `[1,2] + 3` => `[1,2,3]` |
| `-` | `array` | `array` | Removes items in arg2 from arg1 | `[1,2,3] - [0,2]` => `[1,3]` |
| `==` | `set` | `any` | Returns true if arg2 is a set and they contain the same items | `{1,2} == {2,1}` => `true` |
| `!` | `set` | n/a | Removes every item in `universal_set` from arg1 | `universal_set = {1,3}`, `!{1,2}` => `{3}` |
| `*` | `set` | `set` | Calculate intersection of arg1 and arg2 | `{0,1,2} * {1,2,3}` => `{1,2}` |
| `+` | `set` | `set` | Join arg1 and arg2 | `{0,1,2} + {1,2,3}` => `{0,1,2,3}` |
| `+` | `set` | `any` | Add arg2 to arg1 | `{0,1,2} + 3` => `{0,1,2,3}` |
| `-` | `set` | `set` | Removes all items in arg2 from arg1 | `{1,2,3} - {0,2}` => `{1,3}` |
| `==` | `map` | `map` | Return true if same size and all keys are equivalent and values are equivalent | `{"name":"Joe"} == {"name":"Joe"}` => `true` |
| `.` | `map` | `symbol` | Access property arg2 of arg1. May be assigned to. | `headers.time` => `1633102709555` |
| `[]` | `map` | `any` | Evaluate arg2 and access property arg2 of arg1. May be assigned to. | `headers["time"]` => `1633102709555` |
| `()` | `func` | argument string | Calls arg1 with arguments arg2 | `sin(1)` => `0.8414709848078965` |
| `==` | `func` | `func` | Return true if function names match | `sin == sin` => `true` |
| `=` | `symbol` | `any` | Creates new binding for symbol arg1 and sets to arg2 | `a = 10, a` => `10` |
| `=>` | `symbol` | `any` | Sets existing binding to symbol arg1 to arg2* | `a => 10, a` => `10` |
| `+=` | `symbol` | `any` | Adds arg2 to variable arg1 | `a = 10, a += 5, a` => `15` |
| `-=` | `symbol` | `any` | Subtracts arg2 from variable arg1 | `a = 10, a -= 5, a` => `5` |
| `*=` | `symbol` | `any` | Multiplies variable arg1 by arg2 | `a = 10, a *= 2, a` => `20` |
| `/=` | `symbol` | `any` | Divides variable arg1 by arg2 | `a = 10, a /= 2, a` => `5` |
| `%=` | `symbol` | `any` | Sets arg1 to arg1 % arg2 | `a = 10, a %= 3, a` => `1` |

## Notes

- `=>` : the symbol(s) must already be defined. This operator otherwise behaves equivalently to `=`.