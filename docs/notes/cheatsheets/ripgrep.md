# ripgrep (rg)

[ripgrep](https://github.com/BurntSushi/ripgrep) is a line-oriented search tool that recursively searches the current directory for a regex pattern. By default, it respects gitignore rules, skips hidden files/directories, and skips binary files, making it extremely fast compared to standard `grep`.

---

## 1. Quick Comparison with `grep`

| Feature | `grep` | `ripgrep` (`rg`) |
| --- | --- | --- |
| **Speed** | Moderate | ✅ Extremely fast (written in Rust) |
| **Recursive by Default** | ❌ No (requires `-r` or `-R`) | ✅ Yes (searches current directory recursively) |
| **Respects `.gitignore`** | ❌ No | ✅ Yes (automatically skips ignored files) |
| **Skips Hidden/Binary** | ❌ No (searches everything) | ✅ Yes (by default, skips hidden and binary files) |
| **Color Output** | Option-dependent | ✅ Yes (rich colored output by default) |

---

## 2. Basic Search Commands

Search patterns in files, directories, or stdin.

```bash
# Search for a pattern in all text files recursively (default)
rg "pattern"

# Search for a pattern in a specific file
rg "pattern" path/to/file.txt

# Search in a specific directory
rg "pattern" path/to/directory/

# Pipe content into ripgrep
cat logs.txt | rg "ERROR"
```

---

## 3. Matching and RegEx Options

Fine-tune how patterns are matched.

| Option | Long Option | Description |
| --- | --- | --- |
| `-i` | `--ignore-case` | Perform case-insensitive search. |
| `-S` | `--smart-case` | Case-insensitive if pattern is all lowercase, case-sensitive otherwise. |
| `-w` | `--word-regexp` | Match whole words only. |
| `-v` | `--invert-match` | Invert match (show lines that do **not** match). |
| `-F` | `--fixed-strings` | Treat the pattern as a literal string (disable regex). |
| `-x` | `--line-regexp` | Match pattern only if it matches the entire line. |
| `-U` | `--multiline` | Permit matches spanning across multiple lines. |

```bash
# Smart case match (matches "Error" or "error", but "Error" matches only "Error")
rg -S "error"

# Match exactly "foo" as a whole word (e.g. will not match "foobar")
rg -w "foo"

# Literal search for strings containing special regex characters (like dots or brackets)
rg -F "user.info[0]"
```

---

## 4. File and Directory Filtering

Control which files are included or excluded in the search scope.

| Action | Option | Description |
| --- | --- | --- |
| **Search Hidden Files** | `--hidden` | Search hidden files and directories (like `.env`). |
| **Ignore Gitignore** | `--no-ignore` | Do not respect `.gitignore` rules. |
| **Search Everything** | `-u` / `-uu` / `-uuu` | `-u` (no gitignore), `-uu` (hidden + no gitignore), `-uuu` (binary + hidden + no gitignore). |
| **Glob Include/Exclude** | `-g "<glob>"` | Include/exclude files matching glob pattern (prefix with `!` to exclude). |
| **Filter by File Type** | `-t <type>` | Limit search to specific file types (e.g. `rust`, `js`, `py`). |
| **Exclude File Type** | `-T <type>` | Exclude specific file types from the search. |

```bash
# Search inside hidden files (excluding .git)
rg --hidden "api_key"

# Search only inside JavaScript and TypeScript files
rg -t js -t ts "const config"

# Search everything except python files
rg -T py "import"

# Search files while excluding any node_modules directory
rg "react" -g "!**/node_modules/*"
```

> [!NOTE]
> Run `rg --type-list` to see a full list of supported file type aliases (e.g., `web`, `py`, `cpp`).

---

## 5. Output Customization

Modify how matching lines are formatted and displayed.

| Option | Long Option | Description |
| --- | --- | --- |
| `-l` | `--files-with-matches` | Print only the filenames of matching files (not the lines). |
| `-o` | `--only-matching` | Print only the matched text, not the whole line. |
| `-c` | `--count` | Show a count of matching lines for each file. |
| `-n` | `--line-number` | Show line numbers (enabled by default when outputting to terminal). |
| `-N` | `--no-line-number` | Suppress line numbers in output. |
| `-A <N>` | `--after-context=<N>` | Show `<N>` lines of context after the match. |
| `-B <N>` | `--before-context=<N>` | Show `<N>` lines of context before the match. |
| `-C <N>` | `--context=<N>` | Show `<N>` lines of context before and after the match. |
| | `--replace="<str>"` | Replace matched text with `<str>` in the output. |

```bash
# Find only filenames containing a pattern
rg -l "todo"

# Print match with 2 lines of before-and-after context
rg -C 2 "database connection failed"

# List files that ripgrep would search, without actually searching them
rg --files
```

---

## 6. Configuration File

You can set default flags for `ripgrep` by pointing to a configuration file using the `RIPGREP_CONFIG_PATH` environment variable.

### 1. Create a config file (`~/.ripgreprc`)
```ini
# Search hidden files/directories by default
--hidden

# Use smart-case by default
--smart-case

# Exclude .git directories from search
--glob=!.git/*

# Limit long line prints and show previews
--max-columns=150
--max-columns-preview
```

### 2. Export the environment variable
Add this line to your `.bashrc` or `.zshrc`:
```bash
export RIPGREP_CONFIG_PATH="$HOME/.ripgreprc"
```

---

## 7. Useful Command Combinations

### 1. Count occurrences of a word globally
```bash
rg --stats "TODO"
```

### 2. Find and Replace (via `sed`)
Combine `rg -l` with `xargs` and `sed` to search and replace text across files:
```bash
rg -l "old_endpoint" | xargs sed -i 's/old_endpoint/new_endpoint/g'
```

### 3. Search and format output as JSON
Useful for parsing matches in scripts:
```bash
rg "pattern" --json
```
