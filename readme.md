# `f-ts`

> CLI to move faster in software projects

Main CLI is written in Rust and is located [here](https://github.com/1focus-ai/f). This is exploration of this 'move fast' CLI in TS.

## Install CLI

To install CLI, run: `bun i -g @1focus/fts`. This should make `fts` available in your PATH.

You can also run it via `bunx @1focus/fts@latest <command>` to always use the latest version of the CLI.

## Run

See `fts --help` for instructions of what you can do.

## Setup Dev

Install [task](https://taskfile.dev/docs/installation). Then run `task setup` & follow instructions until it says `✔️ you are setup`.

## Commands

Run `task` to see all possible commands.

## Contributing

Any PR to improve is welcome. [codex](https://github.com/openai/codex) & [cursor](https://cursor.com) are nice for dev. Great **working** & **useful** patches are most appreciated (ideally). Issues with bugs or ideas are welcome too.

Note that this CLI is very opinionated in how workflows are done. Suggestions are welcome of course but we want to give our happy path of how we at [1focus.ai](https://1focus.ai) plan to write complex software of any kind.

## Dev Notes

- after changes, can run `bun run src/main.ts <cmd>` to test things
