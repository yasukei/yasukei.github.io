# Antigravity CLI

Here is a quick-reference cheatsheet of the most useful commands, shortcuts, and features to help you get started with Antigravity CLI (`agy`).


## 1. Essential Slash Commands (Within `agy`)

Type these directly into the prompt box inside an active session:

| Command | Action | When to use it |
| --- | --- | --- |
| `/help` or `?` | Show all commands | When you forget a command or want to check options. |
| `/clear` | Clear conversation | Resets the conversation context to start fresh. |
| `/undo` or `/rewind` | Rewind last step | If the agent went down the wrong path and you want to step back. |
| `/fork` | Fork workspace | Creates an isolated branch workspace for experimenting. |
| `/resume` | Resume past chats | Lists previous conversations to pick up where you left off. |
| `/config` or `/settings` | Config screen | Customizes agent model settings and permissions. |
| `/exit` | Exit the CLI | Ends the session and returns to your main bash shell. |


## 2. Typing & Navigation Shortcuts

* **`@` (File Completion):** Type `@` in the prompt to trigger interactive auto-completion of files in your workspace directory.
* **`!` (Direct Shell Execution):** Prefix a line with `!` to run a shell command on your local system immediately without involving the agent (e.g., `!git status` or `!npm install`).
* **`Esc` then `Esc`:** Press the Escape key twice to quickly clear whatever you've typed in the active prompt box.


## 3. CLI Launch Commands (From your terminal)

* `agy` — Starts a session using the default settings in your current directory.
* `agy --model <model-name>` — Launches the session with a specific AI model.
* `agy update` — Upgrades your CLI tool to the latest version.
* `agy changelog` — Lists the latest release updates and patches.


## 4. Pro-Tips for Beginners

1. **Always open from the Workspace Root:** Run `agy` from the root directory of your repository. This ensures it understands the full context of your codebase and avoids workspace state conflicts.
2. **Use `/goal` for complex tasks:** If you have a large refactoring job or a task that might take a long time (e.g., migrating tests), use the `/goal` command. This instructs the agent to run in a thorough, multi-step background loop until the job is completed.


## 5. Slash Command Reference

| Command | Description |
| --- | --- |
| `/add-dir` | Add a directory to the workspace |
| `/agents` | List available custom agents |
| `/artifact` | View and review artifacts |
| `/btw` | Ask a side question without interrupting the current task |
| `/changelog` | Show release notes and changes |
| `/clear` (new) | Clear conversation and start a new one |
| `/config` (settings) | Open settings panel |
| `/context` | Visualize current context usage |
| `/copy` | Copy the last planner response to the clipboard (may require allowing clipboard access in your terminal) |
| `/credits` | Show remaining G1 credits and purchase link |
| `/diff` | View uncommitted changes and per-turn diffs |
| `/exit` (quit) | Exit the CLI |
| `/fast` | Agent will execute tasks directly. Use for simple tasks that can be completed faster |
| `/feedback` | Submit qualitative feedback to improve the agent |
| `/fork` (branch) | Create a branch of the current conversation at this point |
| `/help` | Show available commands and keybindings |
| `/hooks` | Manage hook configurations for tool events |
| `/keybindings` | Set custom keybindings |
| `/logout` | Log out |
| `/mcp` | Manage MCP servers |
| `/model` | Set a model |
| `/open` | Open a file or view opened/edited files |
| `/permissions` | Manage tool permissions |
| `/planning` | Agent can plan before executing tasks. Use for deep research, complex tasks, or collaborative work |
| `/rename` | Rename the current conversation |
| `/resume` (switch, conversation) | Browse and resume past conversations |
| `/rewind` (undo) | Rewind conversation to a previous message |
| `/skills` | List available skills |
| `/statusline` | Toggle the statusline |
| `/tasks` | View background tasks |
| `/title` | Toggle custom terminal window title |
| `/usage` (quota) | View model quota usage |
| `/goal` | Run until the specified goal is completely finished |
| `/schedule` | Run an instruction on a recurring schedule or as a one-time timer |
| `/grill-me` | Interview me to align on a plan |
| `/teamwork-preview` | Invoke a team of agents to autonomously tackle large projects |


## 6. Shortcuts Reference

| Shortcut / Keybinding | Action |
| --- | --- |
| `/` | Open slash commands |
| `\ + enter` | Insert newline fallback |
| `alt+enter`, `ctrl+j`, `shift+enter` | Insert newline |
| `alt+j` | Manage subagent |
| `ctrl+_`, `ctrl+shift+-` | Undo |
| `ctrl+c`, `esc` | Go back / dismiss |
| `ctrl+d` | Exit |
| `ctrl+end` | Go to bottom |
| `ctrl+g` | Open prompt in `$EDITOR` |
| `ctrl+home` | Go to top |
| `ctrl+k` | Approve subagent fast |
| `ctrl+l` | Clear CLI screen |
| `ctrl+o` | Toggle trajectory view |
| `ctrl+r` | Review artifact |
| `ctrl+shift+z` | Redo |
| `ctrl+v` | Paste image/video |
| `ctrl+y` | Yank (paste from kill ring) |
| `ctrl+z` | Suspend CLI |
| `down` | Move down |
| `e` | Edit command |
| `enter` | Send message or confirm |
| `left` | Move left / Prev tab |
| `pgdown`, `shift+down` | Page down |
| `pgup`, `shift+up` | Page up |
| `right` | Move right / Next tab |
| `shift/alt+click` | Select and copy text |
| `tab` | Tab |
| `up` | Move up |
