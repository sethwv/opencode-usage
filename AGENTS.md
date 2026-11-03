# Development install

OpenCode loads the development copy of this plugin from:

```text
~/.config/opencode/plugin/opencode-usage/
```

After changing anything under `src/`, synchronize the development install before testing:

```sh
rsync -a --delete src/ ~/.config/opencode/plugin/opencode-usage/
```

Restart the OpenCode service when the running plugin does not reload the changed files. A restart interrupts active OpenCode sessions, so ask first.
