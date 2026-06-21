# bat

[bat](https://github.com/sharkdp/bat) is a `cat` clone with syntax highlighting and Git integration. It aims to make reading code and structured text in the terminal a premium, modern experience.

---

## 1. Quick Comparison with `cat`

| Feature | `cat` | `bat` |
| --- | --- | --- |
| **Syntax Highlighting** | ❌ No | ✅ Yes (automatic by file extension/header) |
| **Git Integration** | ❌ No | ✅ Yes (displays git modifications in gutter) |
| **Automatic Paging** | ❌ No (spills to stdout) | ✅ Yes (pipes to `less` if output exceeds screen) |
| **Show Non-Printable** | ✅ Yes (`-v`) | ✅ Yes (`-A` / `--show-all`) |
| **Line Numbers & Grid** | ❌ No (only line numbers via `-n`) | ✅ Yes (fully customizable styles) |

---

## 2. Basic Usage & Common Aliases

Typically, users alias `cat` to `bat` for general usage, while keeping a "plain" fallback alias for copying or scripting.

```bash
# Basic usage
bat file.txt

# Common aliases in .bashrc / .zshrc
alias cat="bat --style=plain"     # Behave like cat but with color highlighting
alias batl="bat --style=full"     # Show full headers, grids, and line numbers
```

---

## 3. Style & Display Customization

Control which visual elements are rendered around your file content.

### Predefined Styles (`--style`)
You can pass a comma-separated list of components, or use one of the shorthand styles.

| Style | Option Value | Components Shown |
| --- | --- | --- |
| **Full** (Default) | `full` | Headers, grid, line numbers, git changes. |
| **Plain** | `plain` / `-p` | Text only, retains colors (equivalent to `--style=none`). |
| **Grid** | `grid` | Grid layout without headers or line numbers. |
| **Numbers** | `numbers` / `-n` | Line numbers only. |
| **Changes** | `changes` | Git changes gutter only. |
| **Header** | `header` | File header (name/size) only. |

```bash
# Show file with only line numbers
bat --style=numbers main.js

# Custom style combining line numbers and git changes (no grid/header)
bat --style="numbers,changes" main.js
```

### Specifying Line Ranges (`-r` / `--line-range`)
Only print specific lines of a file.

```bash
# Print lines 10 to 30
bat --line-range 10:30 file.md

# Print from line 50 to the end of the file
bat --line-range 50: file.md

# Print first 15 lines
bat --line-range :15 file.md
```

---

## 4. Syntax & Themes

`bat` automatically detects syntax highlighting based on the file extension and content headers.

### Languages & Mapping
- **List Supported Languages**: `bat --list-languages`
- **Force Specific Syntax**: Use `-l` or `--language`.
- **Map File Patterns**: Map custom file patterns to a specific language syntax.

```bash
# Force YAML syntax highlighting for a file without extension
bat -l yaml custom-config

# Map all *.hql files to SQL syntax highlighting
bat --map-syntax "*.hql:SQL" query.hql
```

### Themes
- **List All Themes**: `bat --list-themes`
- **Change Theme Temporarily**: Use `--theme=<theme-name>`.

```bash
# Highlight using the popular Monokai Extended theme
bat --theme="Monokai Extended" script.py
```

---

## 5. Configuration

Instead of writing long flags every time, you can configure your defaults in a configuration file.

### Config File Location
- **Linux/macOS**: `~/.config/bat/config`
- **Windows**: `%APPDATA%\bat\config`

> [!TIP]
> Run `bat --config-file` to find the exact path of your configuration file on your current system.

### Example Config File (`~/.config/bat/config`)
```ini
# Set theme
--theme="TwoDark"

# Set default style components
--style="numbers,changes,header"

# Always expand tabs to 4 spaces
--tabs=4

# Never wrap text
--wrap=never
```

---

## 6. Git Integration

`bat` communicates with Git to show local modifications in the gutter next to line numbers:

* `+` (Green): Line was **added**.
* `~` (Yellow): Line was **modified**.
* `-` (Red): Line was **deleted** (displays a small indicator showing where deletion happened).

---

## 7. Advanced CLI Integrations

### 1. Interactive File Viewer (`fzf`)
Combine `bat` with `fzf` for an interactive file search with instant preview:

```bash
fzf --preview 'bat --style=numbers --color=always --line-range :500 {}'
```

### 2. Replacing the default `man` pager
Use `bat` to view terminal manuals with color and syntax highlighting:

```bash
# Place this in your .bashrc / .zshrc
export MANPAGER="sh -c 'col -bx | bat -l man -p'"
```

### 3. Tailing Logs with Syntax Highlighting
Pipe streaming output or logs directly into `bat` (note that you must disable paging):

```bash
tail -f production.log | bat --paging=never -l log
```

### 4. Interactive Git Diffing
Use `bat` as a diff highlight viewer:

```bash
git diff | bat -l diff
```
