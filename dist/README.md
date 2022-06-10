# Dist

Non-core execution environment for TriflicScript

- `web/` - execute TriflicScript in the web browser
  - Open a terminal in `web/` and run `npm run build`. The build file will be places in `web/dist/`. Open `web/dist/index.html`.

- `discord/` - execute TriflicScript in discord. Connects to a discord bot and listens on a particular channel (defined as `BOT_TOKEN` and `CHANNEL` in `.env`)

  Type `!start` to start the maths environment. Everything after this point will be fed into the engine. Type `!close` to close session.