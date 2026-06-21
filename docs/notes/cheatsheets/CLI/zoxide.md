# zoxide

[zoxide](https://github.com/ajeetdsouza/zoxide) is a smarter `cd` command, written in Rust. It remembers your most frequently and recently used directories (using a "frecency" algorithm), allowing you to jump to them instantly with minimal typing.

---

## 1. Quick Comparison with `cd`

| Feature | `cd` | `zoxide` (`z`) |
| --- | --- | --- |
| **Path Requirements** | Must specify exact relative/absolute path | ✅ Supports fuzzy matching and keyword jumps |
| **Frecency Tracking** | ❌ No (no memory of past visits) | ✅ Yes (ranks directories by frequency & recency) |
| **Interactive Selection** | ❌ No | ✅ Yes (`zi` / interactive search with `fzf`) |
| **Shell Compatibility** | Native | ✅ Support for Bash, Zsh, Fish, PowerShell, etc. |

---

## 2. Shell Installation & Setup

Before using `zoxide`, you must initialize it in your shell configuration.

### 1. Installation
Install `zoxide` via your system's package manager:
```bash
# macOS/Linux (Homebrew)
brew install zoxide

# Debian/Ubuntu (APT)
sudo apt install zoxide

# Fedora/CentOS (DNF)
sudo dnf install zoxide

# Manual install script (Linux/WSL)
curl -sSfL https://raw.githubusercontent.com/ajeetdsouza/zoxide/main/install.sh | sh
```

### 2. Shell Configuration
Add the initialization script to your shell's rc file:

* **Bash** (add to `~/.bashrc`):
  ```bash
  eval "$(zoxide init bash)"
  ```
* **Zsh** (add to `~/.zshrc`):
  ```bash
  eval "$(zoxide init zsh)"
  ```
* **Fish** (add to `~/.config/fish/config.fish`):
  ```fish
  zoxide init fish | source
  ```
* **PowerShell** (add to your profile):
  ```powershell
  Invoke-Expression (& { (zoxide init powershell | Out-String) })
  ```

---

## 3. Basic Navigation

`zoxide` replaces or wraps the `cd` command with `z` (and the interactive search with `zi`).

```bash
# Jump to the highest ranked directory matching "foo"
z foo

# Jump using multiple keywords (e.g. matching both "foo" and "bar")
z foo bar

# Jump to a subdirectory starting with "foo"
z foo/

# Interactive jump (opens an fzf list of all remembered directories)
zi

# Regular cd fallback (works exactly like cd if path exists)
z ~/projects/my-website
z ..
z -
```

---

## 4. Core Subcommands

Behind the scenes, you can inspect or modify `zoxide`'s database using its subcommands.

| Command | Description | Example |
| --- | --- | --- |
| `zoxide add <dir>` | Manually add a directory to the database (or increment rank). | `zoxide add /var/log` |
| `zoxide query <query>` | Query the database for a path without changing directories. | `zoxide query project` |
| `zoxide remove <dir>` | Remove a directory from the database. | `zoxide remove ~/old-project` |
| `zoxide import <file>` | Import database paths from another program (fasd, autojump, etc.). | `zoxide import zsh-z` |
| `zoxide --help` | View help and documentation flags. | `zoxide --help` |

---

## 5. Configuration Environment Variables

Configure `zoxide`'s behavior by exporting these environment variables **before** calling `zoxide init` in your shell configuration.

| Environment Variable | Default Value | Description |
| --- | --- | --- |
| `_ZO_DATA_DIR` | Platform specific | Storage directory for the zoxide database. |
| `_ZO_ECHO` | `0` | Set to `1` to print the matched path before navigating. |
| `_ZO_EXCLUDE_DIRS` | None | List of directory globs to ignore (separated by `:` or `;`). |
| `_ZO_FZF_OPTS` | None | Custom options to pass to `fzf` for the `zi` interactive menu. |
| `_ZO_MAXAGE` | `10000` | Limits the maximum frecency rank. Ranks decay when this is exceeded. |
| `_ZO_RESOLVE_SYMLINKS`| `0` | Set to `1` to resolve symlinks before adding directories to the database. |

### Example Setup in `.zshrc`:
```bash
# Zoxide customizations
export _ZO_ECHO=1
export _ZO_MAXAGE=5000
export _ZO_EXCLUDE_DIRS="$HOME/tmp/*:$HOME/.cache/*"

# Initialize
eval "$(zoxide init zsh)"
```

---

## 6. Tips & Tricks

### 1. Custom Aliases
If you want to map `z` to `cd` directly, you can pass the `--cmd` flag to the initializer:
```bash
# Replaces 'cd' with zoxide's jump behavior
eval "$(zoxide init zsh --cmd cd)"
```

### 2. Shell Autocomplete
Once `zoxide` is initialized, it hooks into your shell's tab-completion. Simply type `z` followed by space and `Tab` to list matches interactively:
```bash
z proj<TAB>
# Displays interactive matching folders list:
# ~/projects/my-website
# ~/projects/my-app
```
