# Neovim + LazyVim

::: v-pre

LazyVim is a modern, fast, and pre-configured Neovim distribution built around the `lazy.nvim` plugin manager. This cheatsheet highlights the most essential LazyVim default keymaps, LSP navigations, buffer controls, and UI toggles.

> [!TIP]
> The default `<leader>` key in LazyVim is **Space**. The default `<localleader>` is `\`.
> Pressing `<space>` will trigger a **Which-Key** popup at the bottom of the screen showing all available next-key actions.

---

## 1. General & Window Navigation

These maps optimize movement, window swapping, and line operations.

| Keymap | Mode | Action / Description |
| --- | --- | --- |
| `j` / `k` | Normal, Visual | Better up/down movement (wraps on display lines instead of logical lines) |
| `<C-h>` | Normal | Move to left window / split |
| `<C-j>` | Normal | Move to lower window / split |
| `<C-k>` | Normal | Move to upper window / split |
| `<C-l>` | Normal | Move to right window / split |
| `<C-Up>` / `<C-Down>` | Normal | Increase / decrease window height |
| `<C-Left>` / `<C-Right>` | Normal | Decrease / increase window width |
| `<A-j>` / `<A-k>` | Normal, Insert | Move current line down / up |
| `<A-j>` / `<A-k>` | Visual | Move selected block down / up |
| `<` / `>` | Visual | Indent left / right (stays in Visual mode) |
| `n` / `N` | Normal, Vis, Op | Next / Previous search result (auto-centers cursor and opens folds) |
| `<esc>` | Normal, Ins, Snip | Clear search highlight (`noh`) and stop snippet active expansion |
| `<leader>ur` | Normal | Redraw screen, clear search highlight, and update diffs |

---

## 2. Buffer & Tab Management

LazyVim manages buffers using `bufferline.nvim` and provides shortcuts to navigate and clean up files quickly.

### Buffer Controls
| Keymap | Mode | Action / Description |
| --- | --- | --- |
| `<S-h>` or `[b` | Normal | Go to **previous** buffer |
| `<S-l>` or `]b` | Normal | Go to **next** buffer |
| `<leader>bb` or ` ``<leader>``` ` | Normal | Switch to **other (last active)** buffer |
| `<leader>bd` | Normal | Delete (close) active buffer safely (keeps window layout) |
| `<leader>bo` | Normal | Delete **all other** buffers |
| `<leader>bi` | Normal | Delete **all invisible** buffers |
| `<leader>bD` | Normal | Delete buffer and close current window |

### Tab Controls
| Keymap | Mode | Action / Description |
| --- | --- | --- |
| `<leader><tab><tab>` | Normal | Create **new tab** |
| `<leader><tab>d` | Normal | Close current tab |
| `<leader><tab>]` | Normal | Go to **next tab** |
| `<leader><tab>[` | Normal | Go to **previous tab** |
| `<leader><tab>o` | Normal | Close **all other tabs** |
| `<leader><tab>f` | Normal | Go to **first tab** |
| `<leader><tab>l` | Normal | Go to **last tab** |

---

## 3. Search & Fuzzy Finding (via Snacks.picker)

LazyVim utilizes `snacks.nvim` for fast fuzzy finding, grep searching, and workspace exploration.

| Keymap | Mode | Action / Description |
| --- | --- | --- |
| `<leader><space>` | Normal | Find files in the **project root directory** |
| `<leader>,` | Normal | List and switch between open buffers |
| `<leader>/` | Normal | Grep search for a string across all project files (from root) |
| `<leader>:` | Normal | Open command history |
| `<leader>ff` | Normal | Find files (root directory) |
| `<leader>fF` | Normal | Find files (current working directory - cwd) |
| `<leader>fc` | Normal | Find and edit Neovim configuration files |
| `<leader>fn` | Normal | Create new empty buffer/file |
| `<leader>fr` | Normal | Open recent files history |
| `<leader>fR` | Normal | Open recent files history (cwd specific) |
| `<leader>fp` | Normal | Select and open recent projects |
| `<leader>sg` | Normal | Live grep search (root directory) |
| `<leader>sG` | Normal | Live grep search (cwd specific) |
| `<leader>sw` | Normal, Vis | Search word/selection under cursor (root directory) |
| `<leader>sW` | Normal, Vis | Search word/selection under cursor (cwd specific) |
| `<leader>sh` | Normal | Search Neovim help pages |
| `<leader>sk` | Normal | Search active keymaps and documentation |
| `<leader>s"` | Normal | Search registers |
| `<leader>s/` | Normal | Search history |

---

## 4. LSP (Language Server Protocol) & Coding

Powerful integrations for editing code, navigating syntax trees, and refactoring.

### LSP Navigation
| Keymap | Mode | Action / Description |
| --- | --- | --- |
| `gd` | Normal | **Goto Definition** |
| `gr` | Normal | **Goto References** |
| `gI` | Normal | **Goto Implementation** |
| `gy` | Normal | **Goto Type Definition** |
| `gD` | Normal | **Goto Declaration** |
| `K` | Normal | Show hover documentation (LSP Info) |
| `gK` | Normal | Show signature help |
| `<C-k>` | Insert | Show signature help while typing |

### LSP Refactoring & Actions
| Keymap | Mode | Action / Description |
| --- | --- | --- |
| `<leader>ca` | Normal, Vis | Open **Code Actions** (quick fixes, imports, etc.) |
| `<leader>cr` | Normal | **Rename variable / symbol** (renames across project if supported) |
| `<leader>cf` | Normal, Vis | **Format buffer** (or visual selection) via `conform.nvim` |
| `<leader>ss` | Normal | Search document LSP symbols |
| `<leader>sS` | Normal | Search workspace LSP symbols |
| `gai` / `gao` | Normal | View incoming / outgoing LSP call hierarchy |

### Diagnostics
| Keymap | Mode | Action / Description |
| --- | --- | --- |
| `<leader>cd` | Normal | Open diagnostic popup for current line |
| `]d` / `[d` | Normal | Go to **next / previous** diagnostic |
| `]e` / `[e` | Normal | Go to **next / previous** diagnostic error |
| `]w` / `[w` | Normal | Go to **next / previous** diagnostic warning |

---

## 5. Git Integration (via Snacks & Lazygit)

LazyVim integrates git operations using Snacks and provides built-in support for Lazygit.

| Keymap | Mode | Action / Description |
| --- | --- | --- |
| `<leader>gg` | Normal | Toggle **Lazygit** (in repository root) |
| `<leader>gG` | Normal | Toggle **Lazygit** (in current working directory) |
| `<leader>gl` | Normal | Git log |
| `<leader>gL` | Normal | Git log (cwd specific) |
| `<leader>gb` | Normal | View git blame annotations for the current line |
| `<leader>gf` | Normal | View current file history |
| `<leader>gB` | Normal, Vis | Open git provider web interface for current repository |
| `<leader>gY` | Normal, Vis | Copy git provider URL for current file to system clipboard |

---

## 6. UI & Editor Toggles (via `<leader>u`)

These toggles quickly turn Neovim options or plugin features on or off without writing lua configuration.

| Keymap | Toggle Target | Keymap | Toggle Target |
| --- | --- | --- | --- |
| `<leader>uf` | Auto Format (Global) | `<leader>uF` | Auto Format (Buffer-local) |
| `<leader>us` | Spell Check | `<leader>uw` | Line wrapping |
| `<leader>ul` | Line Numbers (Absolute) | `<leader>uL` | Relative Line Numbers |
| `<leader>ud` | Diagnostics | `<leader>uc` | Conceal Level |
| `<leader>uh` | LSP Inlay Hints | `<leader>ut` | Treesitter Highlighting |
| `<leader>ub` | Dark Background Toggle | `<leader>uD` | Dimming of inactive code block |
| `<leader>uz` | Zen Mode | `<leader>wm` or `<leader>uZ` | Zoom Window (Maximize split toggle) |

---

## 7. Useful Plugins & Extra Keymaps

Keymaps for some of the most popular plugins included with LazyVim:

### Flash.nvim (Seamless Jumping)
*   `s` : Initiate Leap-style jumping. Press 2 characters, then choose the label.
*   `S` : Search for treesitter node selections to jump.
*   `r` / `R` : Start Leap visual selection / jump in visual mode.
*   `<C-s>` : Toggle flash searching while typing an ordinary search `/`.

### Trouble.nvim (Diagnostics & Quick Lists)
*   `<leader>xx` : Toggle Trouble workspace diagnostics.
*   `<leader>xX` : Toggle Trouble document diagnostics.
*   `<leader>cs` : Toggle Trouble LSP symbols view.
*   `<leader>xL` : Toggle Trouble location list.
*   `<leader>xQ` : Toggle Trouble quickfix list.

### Todo-Comments.nvim
*   `]t` / `[t` : Jump to next/previous TODO/FIXME comment.
*   `<leader>st` : Search TODOs in snacks picker.
*   `<leader>xt` : Show Trouble view list for all TODOs.

---

## 8. Managing Plugins & Neovim Configuration

| Command | Action |
| --- | --- |
| `<leader>l` | Open **Lazy** plugin manager window (install, update, clean plugins) |
| `<leader>cm` | Open **Mason** package manager (install LSPs, formatters, linters, debuggers) |
| `<leader>L` | View LazyVim News & Changelog |

:::
