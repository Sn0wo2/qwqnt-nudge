# qwqnt-nudge

A plugin that provides automatic poke-back and double-click avatar pokes for QwQNT.

## Features

- Automatically replies to incoming private & group chat pokes (only when **you** are the poke target).
- Group/private blacklist & whitelist with mode switch.
- Configurable reply cooldown and maximum consecutive replies.
- Double-click a message avatar to send a poke in private and group chats.

## Prerequisites

- QQNT >= `v9.9.32.50776`
- QwQNT framework
- [`qwqnt-ipc-interceptor`](https://github.com/qwqnt-community/qwqnt-ipc-interceptor) >= `1.2.0`
- [`qwqnt-hako`](https://github.com/qwqnt-community/qwqnt-hako) >= `1.0.0`
- [`qwqnt-ipc-logger`](https://github.com/qwqnt-community/qwqnt-ipc-logger) >= `1.3.1` (optional, enables structured logging)

The prerequisite plugin must be installed in the same QwQNT plugins directory. It is declared in `qwqnt.dependencies`.

## Installation

1. Download the release ZIP.
2. Extract its contents to `qwqnt-storage/plugins/qwqnt-nudge/`.
3. Restart QQ.
4. Open QQ settings and find `Nudge`.

## Feedback

Report issues at <https://github.com/qwqnt-community/qwqnt-nudge/issues>.

## License

Apache-2.0. See [LICENSE](./LICENSE).

## Thanks

- [QwQNT-PluginTemplate-Vite-pnpm](https://github.com/adproqwq/QwQNT-PluginTemplate-Vite-pnpm/)
- [QQNT-Toolbox](https://github.com/MeiYongAI/QQNT-Toolbox)
