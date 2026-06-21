# Neovim + LazyVim configuration

::: v-pre

This cheatsheet provides structural guidelines and code snippets to customize Neovim with LazyVim using the files under `~/.config/nvim/lua/`.

---

## 1. Directory Structure & Execution Order

LazyVim uses standard paths to load configuration files automatically. Avoid manually calling `require()` on these files in your `init.lua`.

```text
~/.config/nvim/
├── init.lua              # Entrypoint (loads lua/config/lazy.lua)
└── lua/
    ├── config/
    │   ├── lazy.lua      # Bootstraps lazy.nvim and imports plugin specs
    │   ├── options.lua   # Editor settings (loaded BEFORE plugins)
    │   ├── keymaps.lua   # Custom keybindings (loaded AFTER plugins)
    │   └── autocmds.lua  # Event-triggered commands (loaded AFTER plugins)
    └── plugins/
        ├── example.lua   # Plugin specification overrides (any filename works)
        └── lsp.lua       # LSP configuration overrides (recommended file)
```

---

## 2. Editor Options (`lua/config/options.lua`)

Use `options.lua` to define basic settings (tabs, relative numbers, clipboard, global vars).

```lua
-- Set leader keys (must be done before plugins load)
vim.g.mapleader = " "
vim.g.maplocalleader = "\\"

-- Global LazyVim Variables
vim.g.autoformat = true        -- Set false to disable autoformat-on-save globally
vim.g.snacks_animate = false   -- Set false to disable UI animations (snacks.nvim)
vim.g.lazyvim_picker = "auto"   -- Define fuzzy finder: "telescope", "fzf", or "auto"
vim.g.lazyvim_cmp = "auto"      -- Define autocomplete: "nvim-cmp", "blink.cmp", or "auto"

-- General options using vim.opt
local opt = vim.opt

opt.relativenumber = true      -- Show relative line numbers
opt.shiftwidth = 2             -- Size of an indent
opt.tabstop = 2                -- Number of spaces tabs count for
opt.expandtab = true           -- Use spaces instead of tabs
opt.clipboard = "unnamedplus"  -- Sync with system clipboard
opt.mouse = "a"                -- Enable mouse support
opt.wrap = false               -- Disable line wrapping
opt.scrolloff = 4              -- Lines of context above/below cursor
```

---

## 3. Global Keymaps (`lua/config/keymaps.lua`)

Configure custom shortcuts. Use `vim.keymap.set` (do NOT use `LazyVim.safe_keymap_set`).

```lua
-- Add a custom keymap
-- vim.keymap.set(mode, key, command/function, options)
vim.keymap.set("n", "<leader>w", "<cmd>w<cr>", { desc = "Save File" })
vim.keymap.set("n", "<leader>pv", vim.cmd.Ex, { desc = "Open Netrw File Explorer" })

-- Move visual selections up/down (preserving indentations)
vim.keymap.set("v", "J", ":m '>+1<cr>gv=gv", { desc = "Move Selection Down" })
vim.keymap.set("v", "K", ":m '<-2<cr>gv=gv", { desc = "Move Selection Up" })

-- Disable/Delete a default LazyVim keymap
vim.keymap.del("n", "<leader>L") -- Disable changelog popup
```

---

## 4. Custom Autocommands (`lua/config/autocmds.lua`)

Use event-driven behaviors. LazyVim defines default groups prefixed with `lazyvim_`.

```lua
-- Create an augroup to manage namespace overrides
local function augroup(name)
  return vim.api.nvim_create_augroup("my_custom_" .. name, { clear = true })
end

-- Example: Disable line numbers in Terminal buffers
vim.api.nvim_create_autocmd("TermOpen", {
  group = augroup("terminal_settings"),
  pattern = "*",
  callback = function()
    vim.opt_local.number = false
    vim.opt_local.relativenumber = false
  end,
})

-- Example: Remove a default LazyVim autocommand
-- Default groups: checktime, highlight_yank, resize_splits, last_loc, wrap_spell
vim.api.nvim_del_augroup_by_name("lazyvim_wrap_spell")
```

---

## 5. Customizing & Disabling Plugins (`lua/plugins/`)

Any `.lua` file placed directly in `lua/plugins/` will be parsed for plugin specifications.

### Customizing Option Tables (`opts`)
To tweak an existing plugin's settings, declare it in `lua/plugins/` and specify the fields you want to merge.

```lua
-- lua/plugins/telescope.lua
return {
  {
    "nvim-telescope/telescope.nvim",
    -- opts will be merged with LazyVim's defaults
    opts = {
      defaults = {
        layout_strategy = "horizontal",
        sorting_strategy = "ascending",
      },
    },
  },
}
```

### Disabling a Core Plugin
Set `enabled = false` inside the plugin's spec.

```lua
-- lua/plugins/disabled.lua
return {
  { "folke/trouble.nvim", enabled = false },
  { "akinsho/bufferline.nvim", enabled = false },
}
```

### Disabling Core Plugin Keymaps
Specify the keymap pattern and bind it to `false` in the `keys` table.

```lua
return {
  {
    "nvim-telescope/telescope.nvim",
    keys = {
      -- Disables default search keymap for buffers
      { "<leader>,", false },
      -- Add a new one in its place
      { "<leader>fb", "<cmd>Telescope buffers<cr>", desc = "Find Buffer" },
    },
  },
}
```

---

## 6. LSP, Formatting & Linters Configuration

### Customizing LSP Servers
Configure language servers via `opts.servers` in `nvim-lspconfig`.

```lua
-- lua/plugins/lsp.lua
return {
  {
    "neovim/nvim-lspconfig",
    opts = {
      -- Add/Override LSP options
      servers = {
        -- Set up a server with default options
        pyright = {},
        
        -- Set up a server with custom LSP settings
        lua_ls = {
          settings = {
            Lua = {
              diagnostics = {
                globals = { "vim" },
              },
            },
          },
        },
      },
    },
  },
}
```

### Customizing Conform.nvim (Formatting)
Formatters are defined in `conform.nvim`. Do **not** override the `config` field as it breaks formatting integrations; only change the `opts` table.

```lua
-- lua/plugins/formatting.lua
return {
  {
    "stevearc/conform.nvim",
    opts = {
      formatters_by_ft = {
        lua = { "stylua" },
        python = { "isort", "black" },
        javascript = { "prettierd", "prettier", stop_after_first = true },
      },
    },
  },
}
```

---

## 7. Useful Diagnostic Styling

You can customize diagnostic UI markers and severity symbols globally inside your configuration.

```lua
-- Example config inside lua/config/options.lua or lua/config/lazy.lua (before setup)
vim.diagnostic.config({
  virtual_text = {
    spacing = 4,
    source = "if_many",
    prefix = "●",
  },
  severity_sort = true,
  signs = {
    text = {
      [vim.diagnostic.severity.ERROR] = "✘",
      [vim.diagnostic.severity.WARN] = "▲",
      [vim.diagnostic.severity.HINT] = "⚑",
      [vim.diagnostic.severity.INFO] = "»",
    },
  },
})
```

:::
