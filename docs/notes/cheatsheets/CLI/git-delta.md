# git-delta

[delta](https://github.com/dandavison/delta) is a syntax-highlighting pager for git, diff, and grep output. It replaces the default git pager and enhances code reviews in the terminal by providing side-by-side views, line numbers, word-level diff highlights, and code theme support.

---

## 1. Quick Comparison with Standard `git diff`

| Feature | Standard `git diff` | `git-delta` |
| --- | --- | --- |
| **Word-Level Highlight** | Basic (highlights changed lines) | ✅ Advanced (highlights exact changed words) |
| **Side-by-Side Diff** | ❌ No (inline only) | ✅ Yes (`--side-by-side`) |
| **Line Numbers** | ❌ No | ✅ Yes (`--line-numbers`) |
| **Syntax Highlighting** | ❌ No | ✅ Yes (supports Dracula, Monokai, etc.) |
| **Interactive Navigation**| ❌ No | ✅ Yes (jump between changes with `n`/`N`) |

---

## 2. Installation

Install `delta` using your system's package manager:

```bash
# macOS/Linux (Homebrew)
brew install git-delta

# Debian/Ubuntu (APT)
sudo apt install git-delta

# Arch Linux (Pacman)
sudo pacman -S git-delta
```

---

## 3. Git Configuration (`~/.gitconfig`)

Configure Git to use `delta` as its default pager by modifying your `~/.gitconfig` file.

```ini
[core]
    # Set delta as the default pager for git commands
    pager = delta

[interactive]
    # Use delta for interactive command displays (e.g. git add -p)
    diffFilter = delta --color-only

[add]
    # Configure interactive staging behavior
    interactive = true

[delta]
    # General preferences
    side-by-side = true
    line-numbers = true
    navigate = true    # Use 'n' and 'N' to jump between file diff blocks
    light = false      # Set to true if using a light terminal theme

[merge]
    # Show conflict markers using zdiff3 layout
    conflictStyle = zdiff3
```

---

## 4. Visual Layout Configurations

Customize your diff formatting inside the `[delta]` section of `~/.gitconfig`.

### 1. Side-by-Side Diff
Display changed code blocks next to each other rather than inline.

```ini
[delta]
    side-by-side = true
```

### 2. Displaying Line Numbers
Enable line number columns on both sides of the diff.

```ini
[delta]
    line-numbers = true
```

### 3. Combining Features and Custom Styles
Enable both side-by-side layout, line numbers, and custom decorations together.

```ini
[delta]
    side-by-side = true
    line-numbers = true
    features = decorations
```

---

## 5. Themes & Colors

### Syntax Themes
Delta matches syntax highlighting with themes. You can list all themes by running `delta --list-syntax-themes`.

```ini
[delta]
    syntax-theme = Dracula
    # Alternative: syntax-theme = "Monokai Extended"
    # Alternative: syntax-theme = none (disables syntax highlighting)
```

### Advanced Styling Options
Customize colors and decorations for modified blocks, headers, and lines.

```ini
[delta "decorations"]
    commit-decoration-style = bold yellow box ul
    file-style = bold yellow ul
    file-decoration-style = none
    hunk-header-decoration-style = cyan box ul

[delta "line-numbers"]
    line-numbers-left-style = cyan
    line-numbers-right-style = cyan
    line-numbers-minus-style = 124
    line-numbers-plus-style = 28
```

---

## 6. CLI Usage (Outside Git)

Delta can also be used as a standalone file comparator or diff pager in the terminal.

```bash
# Compare two files directly
delta file1.txt file2.txt

# Pipe standard diff command into delta
diff -u file1.txt file2.txt | delta

# Compare sorted files using process substitution
delta <(sort list1.txt) <(sort list2.txt)
```

### One-Time Git Overrides
You can temporarily bypass or change Delta parameters using the `-c` git configuration override flag.

```bash
# Run diff inline (temporary override to disable side-by-side)
git -c delta.side-by-side=false diff

# Temporarily disable line numbers
git -c delta.line-numbers=false show
```
