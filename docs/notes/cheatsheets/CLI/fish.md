# fish

::: v-pre

The **Friendly Interactive Shell (fish)** is a smart and user-friendly command-line shell for macOS, Linux, and other Unix-like operating systems. It features auto-suggestions, syntax highlighting, and clean configuration scripting.

---

## 1. Installation

### Ubuntu / Debian

```bash
# Add official PPA for the latest version
sudo apt-add-repository ppa:fish-shell/release-4
sudo apt update
sudo apt install fish -y
```

### macOS

```bash
brew install fish
```

---

## 2. Setting Fish as Default Shell

```bash
# Find the path of fish (usually /usr/bin/fish or /opt/homebrew/bin/fish)
which fish

# Add fish to valid shells list (if not already present)
echo (which fish) | sudo tee -a /etc/shells

# Change your default shell
chsh -s (which fish)
```

---

## 3. Configuration & Startup Files

Unlike Bash or Zsh, Fish configuration is written in its own syntax and resides in:
*   **Main Configuration**: `~/.config/fish/config.fish` (Created manually if not present)
*   **Custom Functions**: `~/.config/fish/functions/` (Files named `<func_name>.fish` are lazy-loaded automatically)

### Adding Paths

```fish
# Add directory to $PATH (safely appends and checks for duplicates)
fish_add_path /opt/my-app/bin
```

### Aliases vs. Abbreviations

Fish introduces **abbreviations**, which expand interactively as you type them in the terminal, keeping history clean.

```fish
# Define an alias (creates a wrapper function under the hood)
alias gs="git status"

# Define an abbreviation (expands to the full command when space is pressed)
abbr -a gd git diff
abbr -a gp git push
```

---

## 4. Keybindings & Interactive Features

Fish has powerful interactive features out of the box.

| Keymap | Action / Description |
| --- | --- |
| `Tab` | Open autocomplete suggestions (lists files, flags, command history) |
| `Right Arrow` or `Ctrl + f` | Accept the entire gray autosuggestion |
| `Alt + Right Arrow` or `Alt + f` | Accept only the **next word** of the autosuggestion |
| `Up Arrow` (after typing) | Search history for commands starting with what you typed |
| `Ctrl + r` | Search command history interactively |
| `Alt + w` | Show man page description for command under cursor |

---

## 5. Variables

Fish uses the `set` command to manage variables.

### Scope & Export Controls

| Command | Description |
| --- | --- |
| `set var value` | Set local variable (scope is the current block/function) |
| `set -g var value` | Set global variable (persists for the entire session) |
| `set -x var value` | Export variable (makes it visible to child processes) |
| `set -gx var value` | Set a global exported environment variable (similar to POSIX `export`) |
| `set -e var` | Erase / Delete a variable |

### Universal Variables

Universal variables are shared between all running Fish sessions and persist automatically across shell restarts **without** editing configuration files:

```fish
set -U EDITOR nvim
```

### Lists / Arrays

Variables in Fish are lists by default. Note that indices are **1-indexed**.

```fish
# Define a list
set my_list apple banana cherry

# Access items
echo $my_list[1]   # Output: apple
echo $my_list[-1]  # Output: cherry (last item)

# Append to list
set -a my_list date
```

---

## 6. Fish Scripting & Syntax (vs. Bash/POSIX)

Fish syntax is designed to be clean and consistent, removing many quirks of POSIX shells.

### Command Substitution

```fish
# Capture command output (POSIX: var=$(date) or var=`date`)
set current_date (date)

# Modern Fish (3.4.0+) also supports standard $() syntax
set current_date $(date)
```

### Conditionals (If / Else)

```fish
# Use `test` to perform boolean evaluations
if test -f ~/.config/fish/config.fish
    echo "Config file exists"
else
    echo "Config file not found"
end
```

### Logical Operators

```fish
# Fish uses explicit 'and', 'or', and 'not' keywords instead of &&, ||, !
git add .
and git commit -m "update"
and git push
```

### Loops

```fish
# Loop through a list of values
for animal in cat dog bird
    echo "I love my $animal"
end

# Loop through files
for file in *.md
    echo "Processing file: $file"
end
```

### Functions

```fish
# Define custom functions
function lsg
    # $argv captures all arguments passed to the function
    gls --color=auto --group-directories-first $argv
end
```

---

## 7. Customization & Prompts

### Web Configuration Tool

Fish comes with a built-in web-based config tool to customize colors, prompt, and keybindings visually:

```bash
fish_config
```

### Custom Prompts

To define a custom prompt, create a function called `fish_prompt` in `~/.config/fish/functions/fish_prompt.fish`:

```fish
function fish_prompt
    echo -n (set_color green)(prompt_pwd) (set_color normal)'> '
end
```

:::
