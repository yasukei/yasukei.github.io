# starship

[starship](https://starship.rs/) is a minimal, blazing-fast, and infinitely customizable prompt for any shell. It is written in Rust and uses Nerd Font symbols to build rich, informative command prompts.

---

## 1. Quick Start & Shell Integration

Initialize starship by adding the following activation line to your shell startup file.

### 1. Installation
Install `starship` via your package manager:
```bash
# macOS/Linux (Homebrew)
brew install starship

# Debian/Ubuntu (APT)
sudo apt install starship

# Arch Linux (Pacman)
sudo pacman -S starship
```

### 2. Shell Configurations
Add this line to your configuration file (usually at the very end):

* **Bash** (add to `~/.bashrc`):
  ```bash
  eval "$(starship init bash)"
  ```
* **Zsh** (add to `~/.zshrc`):
  ```bash
  eval "$(starship init zsh)"
  ```
* **Fish** (add to `~/.config/fish/config.fish`):
  ```fish
  starship init fish | source
  ```
* **PowerShell** (add to your profile):
  ```powershell
  Invoke-Expression (& { (starship init powershell | Out-String) })
  ```

---

## 2. Configuration Basics (`starship.toml`)

All configurations are defined in a single TOML file.

### Configuration File Locations
* **Default Location**: `~/.config/starship.toml`
* **Custom Location**: Export the `STARSHIP_CONFIG` environment variable in your shell rc:
  ```bash
  export STARSHIP_CONFIG="~/.config/starship/starship.toml"
  ```

### General Configuration Keys
Place these at the top level of your `starship.toml`:
```toml
# Don't print a blank line before the prompt
add_newline = false

# Timeout for checking files in directories (in milliseconds)
scan_timeout = 10

# Set a custom color palette
palette = "my_palette"

[palettes.my_palette]
blue = "21"
mustard = "#af8700"
```

---

## 3. Formatting the Prompt

Use `format` (left-aligned prompt) and `right_format` (right-aligned prompt) to customize the layout.

```toml
# Main format string
format = """
$username\
$hostname\
$directory\
$git_branch\
$git_status\
$line_break\
$character"""

# Right side format string
right_format = """$cmd_duration"""
```

---

## 4. Key Module Customizations

Customize individual blocks/modules of the prompt in your `starship.toml`.

### Character (`[character]`)
Controls the final prompt symbol (e.g. `❯`).
```toml
[character]
success_symbol = "\u005b❯\u005d(bold green)"
error_symbol = "\u005b❯\u005d(bold red)"
vimcmd_symbol = "\u005b❮\u005d(bold green)"
```

### Directory (`[directory]`)
Controls how the current path is printed.
```toml
[directory]
style = "bold cyan"
truncation_length = 3
truncation_symbol = "…/"
truncate_to_repo = true # Truncate to the root of git repos

# Substitute directory names with custom icons
[directory.substitutions]
"Documents" = "📄 "
"Downloads" = "📥 "
"Developer" = "💻 "
```

### Git Branch (`[git_branch]`) and Git Status (`[git_status]`)
Render git information in repository folders.
```toml
[git_branch]
symbol = "git: "
style = "bold purple"
format = "on \u005b$symbol$branch\u005d($style) "

[git_status]
conflicted = "="
ahead = "⇡"
behind = "⇣"
diverged = "⇕"
untracked = "?"
modified = "!"
staged = "+"
deleted = "✘"
style = "red"
format = "\u005b($all_status$ahead_behind)\u005d($style) "
```

### Command Duration (`[cmd_duration]`)
Shows how long the previous command took to execute.
```toml
[cmd_duration]
min_time = 2000 # Only show if command takes 2+ seconds
format = "under \u005b⏱ $duration\u005d($style) "
style = "bold yellow"
```

---

## 5. Popular Presets

`starship` provides built-in presets that you can apply with one command.

```bash
# Print a list of all available presets
starship preset --help

# Preview a preset
starship preset pure

# Apply a preset (overwrites your starship.toml)
starship preset pure -o ~/.config/starship.toml
```

### Common Presets:
- **Pure**: Minimal, clean, two-line layout.
- **Catppuccin**: Powerline styled layout with Pastel palette color sets.
- **Nerd Fonts**: Loaded with developer tool icons.

---

## 6. Starship CLI Commands

Utility commands for debugging and configuring the prompt.

| Command | Description |
| --- | --- |
| `starship explain` | Explains every module currently shown in your prompt. |
| `starship timings` | Print how long each module took to compute (useful for troubleshooting lag). |
| `starship init <shell>` | Generates the initialization script for the given shell. |
| `starship bug-report` | Generates a template for opening a Github issue. |
| `starship config` | Interact with your config (e.g. `starship config <key> <value>`). |
