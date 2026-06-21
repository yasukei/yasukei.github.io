# fd

[fd](https://github.com/sharkdp/fd) is a simple, fast, and user-friendly alternative to the traditional `find` command. It features sensible defaults (ignoring hidden files and `.gitignore` by default) and is built in Rust for high performance.

---

## 1. Quick Comparison with `find`

| Feature | `find` | `fd` |
| --- | --- | --- |
| **Syntax** | Verbose and complex | ✅ Clean and intuitive |
| **Search Pattern** | Literal/glob by default | ✅ Regex by default (`--glob` optional) |
| **Default Traversal** | Recursive | ✅ Recursive |
| **Respects `.gitignore`** | ❌ No | ✅ Yes (ignores Git-hidden files by default) |
| **Skips Hidden Files** | ❌ No | ✅ Yes (skips hidden files by default) |
| **Colored Output** | ❌ No | ✅ Yes (colorized output by default) |
| **Command Execution** | Complex (`-exec {} \;`) | ✅ Simplified parallel execution (`-x` / `-X`) |

---

## 2. Basic Search Commands

`fd` searches the current directory recursively unless paths are specified.

```bash
# Basic syntax
# fd [options] [pattern] [search-path]

# Search for any file/directory containing "report" in its name
fd report

# Search specifically within the 'src/' folder
fd component src/

# List all files in the current directory (matches anything)
fd
```

---

## 3. Search and Pattern Matching

Control how your search queries are interpreted.

| Option | Long Option | Description |
| --- | --- | --- |
| `-s` | `--case-sensitive` | Forces case-sensitive search (default is smart-case). |
| `-i` | `--ignore-case` | Forces case-insensitive search. |
| `-g` | `--glob` | Use wildcard glob-based search instead of regex. |
| `-H` | `--hidden` | Include hidden files and directories in search results. |
| `-I` | `--no-ignore` | Search files ignored by `.gitignore` or `.fdignore`. |
| `-p` | `--full-path` | Match pattern against the full path, not just the filename. |
| `-d <N>` | `--max-depth <N>` | Restrict search to `<N>` directory levels deep. |
| `-E <pattern>`| `--exclude <pattern>`| Exclude matching paths (supports globs/regex). |

```bash
# Force a case-sensitive match
fd -s "Config"

# Use simple wildcards instead of regex
fd -g "*.config.js"

# Search for "token" inside hidden files (excluding .git)
fd -H "token"

# Search all files, including git-ignored files
fd -I "temporary"
```

---

## 4. Search Filtering

Narrow down your search results by file type, extension, size, or modification date.

### By Type (`-t` / `--type`)
Filter results by filesystem type. Common types:
- `f` (file), `d` (directory), `l` (symlink), `x` (executable), `e` (empty file/directory).

```bash
# Search only for directories matching "dist"
fd -t d dist

# Search only for empty files
fd -t f -t e
```

### By Extension (`-e` / `--extension`)
Matches files by extension without needing globs.

```bash
# Search for all markdown files
fd -e md

# Search for all python or shell scripts
fd -e py -e sh
```

### By Size (`-S` / `--size`)
Filter files using comparison limits. Supported units: `B`, `K`, `M`, `G`, `T` (also supports `+` and `-`).

```bash
# Find files larger than 10 Megabytes
fd -S +10M

# Find files smaller than 1 Kilobyte
fd -S -1K
```

### By Modification Date
Filter files by when they were last modified.

```bash
# Files modified within the last 24 hours
fd --changed-within 1d

# Files modified before 2 weeks ago
fd --changed-before 2w
```

---

## 5. Command Execution

`fd` can execute commands on the files it finds, running tasks in parallel by default.

### Single-File Execution (`-x` / `--exec`)
Executes the command once **for each search result** (in parallel).

```bash
# Unzip all zip archives found in the directory
fd -e zip -x unzip

# Convert all .jpg files to .png in parallel
fd -e jpg -x convert {} {.}.png
```

### Batch Execution (`-X` / `--exec-batch`)
Launches the command once, with **all search results as arguments** (sequential).

```bash
# Open all python test files in Vim at once
fd -g 'test_*.py' -X vim

# Count lines of all markdown files in the project
fd -e md -X wc -l
```

---

## 6. Execution Placeholders

When using `-x` or `-X`, you can format file paths using placeholders.

| Placeholder | Output Style | Example Output (for `src/utils/math.js`) |
| --- | --- | --- |
| `{}` | Full path of the result | `src/utils/math.js` |
| `{.}` | Path without the extension | `src/utils/math` |
| `{/}` | Basename (filename only) | `math.js` |
| `{/.}` | Basename without the extension | `math` |
| `{//}` | Parent directory path | `src/utils` |
| `{.}` | Absolute path (with `--absolute-path`) | `/absolute/path/src/utils/math.js` |

---

## 7. Essential Recipes

### 1. Highlight file metadata (like `ls -l`)
Use the short option `-l` to display full file information:
```bash
fd -e py -l
```

### 2. Find and delete files safely
Find temporary files and delete them in one command:
```bash
fd -H "^\.DS_Store$" -X rm
```

### 3. Integrate with Ripgrep
Search for code inside specific file types:
```bash
fd -e rs -X rg "unwrap"
```
