# chezmoi

[chezmoi](https://www.chezmoi.io/) is a fast, secure, and cross-platform dotfile manager. It helps you manage your personal configuration files (dotfiles) across multiple diverse machines.

---

## 1. Installation

Install `chezmoi` via your preferred package manager.

```bash
# Using Homebrew (macOS/Linux)
brew install chezmoi

# Using APT (Debian/Ubuntu)
sudo apt install chezmoi

# Binary installation script (installs to ./bin)
sh -c "$(curl -fsLS get.chezmoi.io)"
```

---

## 2. Initialization

Initialize `chezmoi` on a new machine.

```bash
# Initialize a local source state in ~/.local/share/chezmoi
chezmoi init

# Initialize and clone an existing dotfiles repository (GitHub)
chezmoi init https://github.com/username/dotfiles.git

# Initialize, clone, and apply the dotfiles immediately
chezmoi init --apply https://github.com/username/dotfiles.git

# Initialize with a one-line setup for GitHub (shorthand)
chezmoi init $GITHUB_USERNAME
```

---

## 3. Daily Workflow

Typical commands for managing configuration files.

### Adding and Modifying Files

```bash
# Add a file to chezmoi management (copies to source directory)
chezmoi add ~/.bashrc

# Edit a managed file (opens editor, updates source, but does NOT apply yet)
chezmoi edit ~/.bashrc

# Edit and apply changes to destination immediately
chezmoi edit --apply ~/.bashrc

# Change file attributes (e.g. mark as executable or template)
chezmoi chattr +x ~/.local/bin/myscript
chezmoi chattr +template ~/.gitconfig
```

### Viewing and Applying Changes

```bash
# Show status of managed files (modified, added, etc.)
chezmoi status

# Show the diff between destination and target state
chezmoi diff

# Apply changes from source directory to the actual dotfiles
chezmoi apply

# Force apply without prompting, dry-run, or verbosely
chezmoi apply -v
chezmoi apply --dry-run
```

---

## 4. Source Directory & Git Management

chezmoi keeps all managed configurations in a local Git repository, usually at `~/.local/share/chezmoi`.

```bash
# Open a shell in the chezmoi source directory
chezmoi cd

# Run git commands directly in the chezmoi source directory
chezmoi git status
chezmoi git add .
chezmoi git commit -m "Update bashrc"
chezmoi git push

# Print the path of the source directory
chezmoi source-path
```

---

## 5. Templates & Variables

::: v-pre
Templates let you generate configurations dynamically based on the operating system, hostname, or custom variables.

### Adding Templates

```bash
# Add a file directly as a template (creates a .tmpl extension in source)
chezmoi add --template ~/.gitconfig
```

### Common Built-in Variables

You can run `chezmoi data` to see all available variables on the current machine.

| Variable | Description | Example Values |
| --- | --- | --- |
| `.chezmoi.os` | Operating system | `"linux"`, `"darwin"`, `"windows"` |
| `.chezmoi.arch` | CPU Architecture | `"amd64"`, `"arm64"` |
| `.chezmoi.hostname` | Host name of the machine | `"my-laptop"`, `"work-pc"` |
| `.chezmoi.username` | Current username | `"username"` |
| `.chezmoi.homeDir` | Path to home directory | `/home/username` |

### Template Syntax and Conditionals

Use Go `text/template` syntax inside files with `.tmpl` extension:

```go
# .gitconfig.tmpl
[user]
    name = Username
    email = {{ if eq .chezmoi.hostname "work-pc" }}work@example.com{{ else }}personal@example.com{{ end }}

[core]
    # Check operating system
    {{- if eq .chezmoi.os "darwin" }}
    editor = code --wait
    {{- else }}
    editor = nano
    {{- end }}
```

> [!TIP]
> The hyphens in `{{-` and `-}}` strip leading and trailing whitespace/newlines, preventing unwanted blank lines in your output configuration.

### Testing Templates

```bash
# Execute/preview template output to stdout without modifying files
chezmoi execute-template < ~/.local/share/chezmoi/dot_gitconfig.tmpl

# Test a snippet directly
chezmoi execute-template '{{ .chezmoi.os }} / {{ .chezmoi.arch }}'
```
:::

---

## 6. Target & Ignore Lists

::: v-pre
Control which files chezmoi ignores or handles in specific directories.

Create a file named `.chezmoiignore` in the root of your source directory (`chezmoi source-path`).

```text
# ~/.local/share/chezmoi/.chezmoiignore
# Ignore VS Code settings on non-macOS systems
{{ if ne .chezmoi.os "darwin" }}
.config/karabiner
{{ end }}

# Always ignore these files
README.md
LICENSE
.git
```
:::

---

## 7. Password Manager Integration

::: v-pre
Retrieve secrets securely within your templates to avoid hardcoding credentials.

### 1Password

```go
# Retrieve password or secret field
password = {{ onepasswordRead "op://Personal/MyLogin/password" }}
token = {{ onepasswordRead "op://VaultName/ItemName/FieldName" }}
```

### Bitwarden

```go
# Retrieve an item field using Bitwarden CLI
password = {{ (bitwarden "item" "item-uuid-or-name").login.password }}
```

### Pass (gopass / standard pass)

```go
# Retrieve password from pass store
api_key = {{ pass "api/token" }}
```

### Generic CLI Output

If your password manager isn't natively supported, use `secret`:

```go
secret_token = {{ secret "my-vault-cli" "get" "secret-name" }}
```
:::

---

## 8. Troubleshooting & Diagnostics

```bash
# Run system diagnostics and verify your installation and dependencies
chezmoi doctor

# View active configurations and templating data
chezmoi data
```
