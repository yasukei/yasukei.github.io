# eza

[eza](https://github.com/eza-community/eza) is a modern, feature-rich replacement for the `ls` command. It is written in Rust and serves as a maintained fork of the original `exa` command.

---

## 1. Quick Comparison with `ls`

| Feature | `ls` | `eza` |
| --- | --- | --- |
| **Written in** | C | Rust |
| **Color Support** | Basic / Manual | Rich, context-aware colors by default |
| **Icons** | ❌ No | ✅ Yes (`--icons`) |
| **Git Integration** | ❌ No | ✅ Yes (`--git`) |
| **Tree View** | ❌ No (requires `tree`) | ✅ Yes (`--tree`) |
| **Hyperlinks** | ❌ No | ✅ Yes (`--hyperlink`) |

---

## 2. Basic Usage & Common Aliases

To fully replace `ls`, many users set up aliases in their `.bashrc` or `.zshrc`.

```bash
# Basic replacement
alias ls="eza --icons=auto"

# Detailed list view (long format)
alias ll="eza -la --icons=auto --group-directories-first"

# Grid view
alias lg="eza -G --icons=auto"

# Tree view
alias lt="eza --tree --level=2 --icons=auto"
```

---

## 3. Core Display Modes

`eza` provides different layout views for listing files.

| Mode | Short Option | Long Option | Description |
| --- | --- | --- | --- |
| **Grid** (Default) | `-G` | `--grid` | Displays entries as a multi-column grid sorted downwards. |
| **Across** | `-x` | `--across` | Displays entries as a grid sorted horizontally. |
| **One-line** | `-1` | `--oneline` | Displays one entry per line (useful for scripting). |
| **Long View** | `-l` | `--long` | Displays extended details (permissions, size, owner, date). |
| **Tree** | `-T` | `--tree` | Recursively displays files in a tree-like hierarchy. |

---

## 4. Filtering and Sorting

Customize which files are displayed and how they are ordered.

| Action | Option | Description |
| --- | --- | --- |
| **Show All** | `-a`, `--all` | Show hidden and dotfiles. Pass twice (`-aa`) to also show `.` and `..`. |
| **Directories Only** | `-D`, `--only-dirs` | List only directories. |
| **Files Only** | `-f`, `--only-files` | List only files. |
| **List Directory Entry** | `-d`, `--list-dirs` | List directory names, not their contents. |
| **Group Directories First** | `--group-directories-first` | Show directories at the top of the list. |
| **Reverse Order** | `-r`, `--reverse` | Reverses the sorting order. |
| **Ignore Git Files** | `--git-ignore` | Skip files specified in `.gitignore`. |
| **Custom Ignore Glob** | `-I`, `--ignore-glob="<glob>"` | Exclude files matching glob patterns (pipe-separated). |

### Sorting by Field (`-s` / `--sort`)
Sort files by specific attributes:
- `name` (default), `Extension`, `extension`
- `size`, `type`, `inode`
- `modified` (or `date`, `time`), `accessed`, `created`
- `none` (no sorting)

```bash
# Sort by file size, largest first
eza -lh -s size -r

# Group directories first, and sort by file extension
eza -l --group-directories-first -s extension
```

---

## 5. Long View Details (`-l`)

When using the long view (`-l`), you can toggle additional metadata columns and format them.

### Column Customization

| Column / Feature | Option | Description |
| --- | --- | --- |
| **Header Row** | `-h`, `--header` | Adds a header row labeling the columns. |
| **Octal Permissions** | `-o`, `--octal-permissions` | Shows permissions in both symbolic and octal formats (e.g., `755`). |
| **Git Status** | `--git` | Displays Git status for each file (`M` modified, `A` added, etc.). |
| **Git Repo Status** | `--git-repos` | Displays high-level Git status for directories. |
| **Byte Sizes** | `-B`, `--bytes` | List file sizes in bytes, without formatting prefixes. |
| **Binary Units** | `-b`, `--binary` | Lists file sizes with binary units (KiB, MiB, etc.). |
| **Mount Points** | `-M`, `--mounts` | Shows mount point details (Linux/macOS only). |
| **Inode Numbers** | `-i`, `--inode` | Lists each file's inode number. |
| **Hard Links** | `-H`, `--links` | Lists the number of hard links. |
| **Security Context** | `-Z`, `--context` | Lists security context details (e.g., SELinux contexts). |

### Timestamp & Size Customization

| Action | Option | Description |
| --- | --- | --- |
| **Choose Time Field** | `-t <field>` / `--time=<field>` | Select `modified` (default), `accessed`, `created`, or `changed`. |
| **Show Total Size** | `--total-size` | Recursively calculates and shows folder sizes (Linux/macOS). |
| **Format Timestamps** | `--time-style=<style>` | Format using `default`, `iso`, `long-iso`, `full-iso`, `relative`, or custom `+<FORMAT>` (chrono syntax). |

```bash
# Long view with git status, headers, and octal permissions
eza -lh --git -o

# Show folder contents with relative time (e.g., "3m ago")
eza -lh --time-style=relative

# Show the actual physical block sizes on the filesystem
eza -lh -S
```

---

## 6. Icons & Aesthetic Enhancements

`eza` provides visual upgrades to make command-line listing cleaner and more descriptive.

### Icons
- **`--icons=always`**: Render Nerd Font filetype icons in output.
- **`--icons=auto`**: Detects if the terminal supports icons before printing.
- **`--icons=never`**: Disable icons.

> [!NOTE]
> Nerd Fonts must be installed and configured in your terminal emulator for icons to display correctly.

### Color Scales
Highlight file attributes (such as sizes or age) with distinct color gradients to spot large/old files instantly.
- **`--color-scale=all`**: Scale colors for all supporting fields.
- **`--color-scale=age`**: Highlight newer vs. older files.
- **`--color-scale=size`**: Highlight larger files with brighter colors.
- **`--color-scale-mode=gradient`**: Uses smooth color transitions (default).
- **`--color-scale-mode=fixed`**: Uses distinct block colors.

```bash
# Color scale based on file size
eza -lh --color-scale=size

# Interactive Hyperlinks (clickable file paths in compatible terminals)
eza -l --hyperlink
```

---

## 7. Advanced Recursion & Tree Layouts

Generate directory maps with control over depth and structure.

```bash
# View directory tree up to 3 levels deep
eza --tree --level=3

# Combine tree view with detailed long output and headers
eza --tree -l -h --level=2

# Use glob pattern to exclude node_modules or .git from trees
eza --tree -I "node_modules|.git"
```
