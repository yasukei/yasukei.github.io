# fzf

[fzf](https://github.com/junegunn/fzf) is a general-purpose, command-line fuzzy finder. It is an interactive filter program for lists of files, command history, processes, git commits, and more, written in Go.

---

## 1. Shell Initialization & Integration

Initialize `fzf` keybindings and completion in your shell config:

### 1. Installation
Install `fzf` via your package manager:
```bash
# macOS/Linux (Homebrew)
brew install fzf

# Debian/Ubuntu (APT)
sudo apt install fzf

# Arch Linux (Pacman)
sudo pacman -S fzf
```

### 2. Shell Configuration
Add the initialization script to your shell's rc file:

* **Bash** (add to `~/.bashrc`):
  ```bash
  eval "$(fzf --bash)"
  ```
* **Zsh** (add to `~/.zshrc`):
  ```bash
  source <(fzf --zsh)
  ```
* **Fish** (add to `~/.config/fish/config.fish`):
  ```fish
  fzf --fish | source
  ```

---

## 2. Default Shell Shortcuts

Once initialized, `fzf` binds the following hotkeys in your terminal:

| Hotkey | Action | Description |
| --- | --- | --- |
| `Ctrl` + `t` | **Find Files** | Paste selected file paths onto the command line. |
| `Ctrl` + `r` | **History Search** | Search through past shell commands and paste the selected command. |
| `Alt` + `c` | **Quick cd** | Search directories and `cd` directly into the selected directory. |

---

## 3. Search Syntax & Operators

`fzf` matches fuzzy patterns by default. You can search using space-separated terms and operators to narrow down matches:

| Search Term | Match Type | Description |
| --- | --- | --- |
| `core` | Fuzzy Match | Match lines containing `c`, `o`, `r`, `e` in any order. |
| `'core` | Exact Match | Match lines containing the exact substring `"core"`. |
| `^core` | Prefix Match | Match lines starting with `"core"`. |
| `core$` | Suffix Match | Match lines ending with `"core"`. |
| `!core` | Inverse Match | Match lines that do **not** contain `"core"`. |
| `!^core` | Inverse Prefix | Match lines that do **not** start with `"core"`. |
| `!core$` | Inverse Suffix | Match lines that do **not** end with `"core"`. |

```bash
# Example search inside fzf prompt:
# ^src 'config !.json$
# Matches files starting with 'src', containing 'config' exactly, but not ending with '.json'
```

---

## 4. Interactive Interface Controls

Hotkeys inside the interactive `fzf` UI:

| Category | Shortcut | Action |
| --- | --- | --- |
| **Navigation** | `Ctrl` + `j` / `Ctrl` + `n` / `Down` | Move cursor down. |
| | `Ctrl` + `k` / `Ctrl` + `p` / `Up` | Move cursor up. |
| **Selection** | `Tab` | Toggle selection of the current item (multi-select). |
| | `Shift` + `Tab` | Toggle selection and move cursor up. |
| | `Enter` | Select active item and exit. |
| **Cancel** | `Escape` / `Ctrl` + `g` / `Ctrl` + `c` | Exit `fzf` without selecting anything. |
| **History** | `Ctrl` + `r` | Cycles search history sorting in `Ctrl + R` view. |

---

## 5. Configuration Environment Variables

Customize `fzf` defaults by exporting environment variables in your shell rc.

### 1. Default Options (`$FZF_DEFAULT_OPTS`)
Configure visual settings, layouts, border styles, and colors:
```bash
export FZF_DEFAULT_OPTS='--height 40% --layout=reverse --border --info=inline'
```

### 2. File Finding Command (`$FZF_DEFAULT_COMMAND`)
Replace standard `find` with faster tools like `fd` or `ripgrep`:
```bash
# Use fd to find files (ignoring hidden files and node_modules)
export FZF_DEFAULT_COMMAND='fd --type f --strip-cwd-prefix --hidden --exclude .git'
```

### 3. Shortcut-Specific Custom Options
Pass configurations to specific default keys:
```bash
# Preview file content using bat when pressing Ctrl+T
export FZF_CTRL_T_OPTS="--preview 'bat -n --color=always {}'"

# Preview directories using eza when pressing Alt+C
export FZF_ALT_C_OPTS="--preview 'eza --tree --level=2 --color=always {}'"

# Cycle Ctrl+R sorting chronological / relevance and copy command via Ctrl+Y
export FZF_CTRL_R_OPTS="--bind 'ctrl-y:execute-silent(echo -n {2..} | pbcopy)+abort'"
```

---

## 6. Advanced Pipelines & Recipes

### 1. Interactive file opener
Search files and open the selection in your default editor:
```bash
# Open in $EDITOR (Vim, VS Code, Nano, etc.)
$EDITOR $(fzf)
```

### 2. Interactive Git Checkout (Checkout branches fuzzy-style)
```bash
git checkout $(git branch | cut -c 3- | fzf)
```

### 3. Kill running process fuzzy-style
Lists running processes and kills the selected one:
```bash
ps -ef | fzf --header='Select process to kill' | awk '{print $2}' | xargs kill -9
```

### 4. Fuzzy autocompletion helper
In shells like Bash and Zsh, suffix any command with `**` followed by `Tab` to trigger fuzzy autocompletion:
```bash
# Fuzzy complete file paths
vim **<TAB>

# Fuzzy complete environment variables
export **<TAB>

# Fuzzy complete hosts from /etc/hosts
ssh **<TAB>
```
