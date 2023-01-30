# TriflicScript: NodeJS Scripting Language
In TriflicScript everything is an expression. This project started as a single-line maths-focused interpreter, allowing for maths involving complex number. It bow, supports multi-line programs with basic control structures. Due to origins this program, the interpreter has some quirks.

If I had known how this would progress, I would've written this in Java or C++ for speed. As this is written in JavaScript, it is pretty slow: my script is interpreted (probably pretty badly), which is then interpreted by JavaScript's V8 and run as C++. Not very fast :(.

For more help, see `docs/` for more documentation, `programs/` for example programs, and the built-in `help` function.

## Important Notes
- TriflicScript is under active development
- Short-circuiting is not a feature - this applies to `&&`, `||`, `??` and `?.`

## TODO
- `continue` statement may be followed by a label.
- Add `docs/funcs/` which describes and contains usage of every core-defined function **IN PROGRESS**
  - All core functions done, now functions defined in `defineFuncs`
- Check standard libraries for bugs (`<vector>` is broken)

## Bugs
- `discord.js` and `docs/syntax/test.js` need changing to latest version
- Attempting to print out circular references results in a crash/error
  - Re-Write array/map/set string casting to handle circular references

## Available Distributions

- Core. These distributions expose every aspect of TrifliScript with no limitations imposed.
  - CLI (`cli.js`) - enter code line-by-line in an active environment.
    - Enter the command `node cli.js [args]` to start.
    - `<io>` is imported by default.
    - Accepts the following command-line argument:
      - `--bidmas [bool]` - enables/disables BIDMAS rules. Can be set via `headers.bidmas`.
      - `--imag [string]` - sets the "imaginary unit" variable.
      - `--import [string[,string[, ...]]]` - comma-seperated list of library paths to import. These are passed to `import()`.
      - `--multiline` - allows mutliple lines to be entered into the CLI.
      - `--prompt [string]` - sets the CLI prompt. Can be set via `headers.prompt`.
      - `--time` - times the parsing and execution of each statement. Can be set via `headers.timeExec`.
  - File execution (`file.js`) - takes a filename to execute.
    - Enter command `node file.js <file> [args]` to exeute.
     - `<io>` is imported by default.
     - Accepts the following command-line arguments:
      - `--bidmas [bool]` - enables/disables BIDMAS rules. *Note* this **cannot** be set via `headers.bidmas`.
      - `--imag [string]` - sets the "imaginary unit" variable.
- Non-core. These remaining distributions are seperated from the core language and have unique restrictions.
  - Discord (`dist/discord/`) - an interpreter which is fed via a discord bot.
    - Necessary environment variables must be defined in `dist/discord/.env`
      - `BOT_TOKEN` is the bot's token.
      - `CHANNEL` is the ID of the channel for the bot to listen in.
    - The bot must have the following permissions: `MessageContent`, `Guilds`, `GuildMessages`.
    - `import()` is disabled
      - Standard `<io>` is **not** imported. Several polyfills (e.g. `print`) are defined uniquely.
    - To run, enter the command `node main.js`.
      
      Navigate to the discord channel. Instances are session-based and are tied to a user. To start a session, type `!start [args]`. For then on, every message sent will be interpreted until the session is terminated (via `exit()` or `!exit`).

    - `!start` accepts the following command-line arguments:
      - `--bidmas [bool]` - enables/disables BIDMAS rules. Can be set via `headers.bidmas`.
      - `--imag [string]` - sets the "imaginary unit" variable.
      - `--time` - times the parsing and execution of each statement. Can be set via `headers.timeExec`.
  - Web Interpreter (`dist/web/`) - an interpreter based in a webpage.
    - `import()` is disabled
      - Standard `<io>` is **not** imported. Several polyfills (e.g. `print`) are defined uniquely.
    - To compile, run `npm run build`. This will populate the source in `dist/`. To launch, open `dist/index.html` (either on a webserver, or simply double-click).
    - No command-line arguments are available, although some can be emulated by changing the appropriate properties in `headers`.