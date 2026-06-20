# Homebrew

Homebrew (also known as Linuxbrew on Linux) is a free and open-source package manager that simplifies installing software.

## 1. Installation on Ubuntu

Before installing, install the required dependencies (compiler tools and curl):

```bash
# Update APT package indexes
sudo apt update

# Install build dependencies
sudo apt install build-essential curl git -y
```

Run the official Homebrew installation script:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

---

## 2. Post-Installation Path Configuration

After installation completes, you must add Homebrew to your shell environment so the `brew` command is available in the terminal.

For **Bash** (default on Ubuntu), run the following commands:

```bash
# Add Homebrew environment script to your shell startup file
echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> ~/.bashrc

# Apply changes to your current terminal session
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
```

For **Zsh** (if using Zsh), run:

```bash
echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> ~/.zshrc
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
```

---

## 3. Essential Commands

Basic usage of `brew` CLI commands.

### Package Installation & Removal

```bash
# Install a package (formula)
brew install <formula>

# Uninstall a package
brew uninstall <formula>

# Reinstall a package
brew reinstall <formula>
```

### Search & Information

```bash
# Search for available packages
brew search <formula>

# Show detailed information about a package (dependencies, homepage, etc.)
brew info <formula>

# List all packages installed via Homebrew
brew list
```

### Updates & Upgrades

```bash
# Update Homebrew itself and all package definitions (formulae)
brew update

# Show what packages would be upgraded (dry run)
brew upgrade --dry-run

# Upgrade all outdated packages to their latest versions
brew upgrade

# Upgrade a specific package
brew upgrade <formula>
```

---

## 4. Maintenance & Diagnostics

Keep Homebrew running smoothly.

```bash
# Run system diagnostics to find potential configuration issues
brew doctor

# Remove old lock files, outdated downloads, and prune cache
brew cleanup

# Show where Homebrew is installed and its current environment variables
brew shellenv
```
