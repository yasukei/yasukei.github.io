# kitty

[kitty](https://sw.kovidgoyal.net/kitty/) is a fast, GPU-accelerated, feature-rich terminal emulator. It is highly customizable, cross-platform (Linux/macOS), and supports tabs, tiling layouts, startup sessions, extension scripting ("kittens"), and a built-in graphics protocol.

---

## 1. The `kitty_mod` Key

Almost all default shortcuts in kitty use a special modifier key sequence defined as `kitty_mod`.
* **Linux/BSD**: `ctrl+shift` (default)
* **macOS**: `cmd` or `ctrl+shift` (often mapped to command keys)

> [!NOTE]
> You can rebind this in your config via `kitty_mod ctrl+alt` or any custom combination.

---

## 2. Window (Split-Pane) Management

Kitty supports splits/panes within a single tab without needing multiplexers like tmux.

| Action | Shortcut | Description |
| --- | --- | --- |
| **New Window** | `kitty_mod` + `Enter` | Opens a new pane in the current tab. |
| **Close Window** | `kitty_mod` + `w` | Closes the active pane. |
| **Next Window** | `kitty_mod` + `]` | Focus the next window. |
| **Previous Window** | `kitty_mod` + `[` | Focus the previous window. |
| **Move Window Forward**| `kitty_mod` + `f` | Swaps the position of the active window forward. |
| **Move Window Backward**| `kitty_mod` + `b` | Swaps the position of the active window backward. |
| **Pick Window to Focus**| `kitty_mod` + `f7` | Displays overlays to select and focus a window by numbers. |
| **Pick Window to Swap**| `kitty_mod` + `f8` | Displays overlays to swap windows by numbers. |

### Layout Navigation
Kitty has built-in tiling layouts (e.g., `tall`, `fat`, `grid`, `stack`, `splits`).
* **Next layout**: `kitty_mod` + `l`
* **Toggle zoom (Maximize current pane)**: `kitty_mod` + `f10` (or `kitty_mod` + `l` to cycle to the `stack` layout)

---

## 3. Tab Management

Tabs represent multiple top-level shells running in a single application window.

| Action | Shortcut |
| --- | --- |
| **New Tab** | `kitty_mod` + `t` |
| **Close Tab** | `kitty_mod` + `q` |
| **Next Tab** | `kitty_mod` + `Right` |
| **Previous Tab** | `kitty_mod` + `Left` |
| **Move Tab Right** | `kitty_mod` + `.` |
| **Move Tab Left** | `kitty_mod` + `,` |
| **Rename Tab** | `kitty_mod` + `alt` + `t` (or double-click the tab title) |
| **Go to Tab N** | `kitty_mod` + `1` through `9` |

---

## 4. Scrolling and Scrollback

Navigate your command outputs and historical buffers.

| Action | Shortcut |
| --- | --- |
| **Scroll Line Up** | `kitty_mod` + `Up` (or `kitty_mod` + `k`) |
| **Scroll Line Down** | `kitty_mod` + `Down` (or `kitty_mod` + `j`) |
| **Scroll Page Up** | `kitty_mod` + `Page Up` |
| **Scroll Page Down** | `kitty_mod` + `Page Down` |
| **Scroll to Top** | `kitty_mod` + `Home` |
| **Scroll to Bottom** | `kitty_mod` + `End` |
| **Show Scrollback in Pager** | `kitty_mod` + `h` (opens search/scroll history in your default pager) |

---

## 5. Clipboard & Selections

| Action | Shortcut | Description |
| --- | --- | --- |
| **Copy to Clipboard** | `kitty_mod` + `c` | Copies selected text. |
| **Paste from Clipboard**| `kitty_mod` + `v` | Pastes clipboard content. |
| **Paste from Selection**| `kitty_mod` + `s` | Pastes from primary selection (middle mouse). |
| **Pass Selection to Program**| `kitty_mod` + `o` | Opens highlighted URLs/paths in your browser or editor. |

---

## 6. Fonts and Display Size

Quickly adjust terminal scaling for presentations or screens.

* **Increase Font Size**: `kitty_mod` + `+` (or `kitty_mod` + `=`)
* **Decrease Font Size**: `kitty_mod` + `-`
* **Reset Font Size**: `kitty_mod` + `Backspace`

---

## 7. Configuration (`kitty.conf`)

Configuration is stored in plain text and can be reloaded instantly without restarting the terminal.

### Configuration File Locations
* **Linux/macOS**: `~/.config/kitty/kitty.conf`
* **Global Default**: `/etc/xdg/kitty/kitty.conf`

> [!TIP]
> Run `kitty --config-file` or press `kitty_mod + f2` to open your active configuration file directly.

### Reloading & Debugging
* **Reload configuration**: `kitty_mod` + `f5`
* **Toggle Fullscreen**: `kitty_mod` + `f11`
* **Open Kitty Command Palette**: `kitty_mod` + `f1` (search bindings and config commands)
* **Open Kitty Shell**: `kitty_mod` + `Escape`

---

## 8. Managing Color Schemes (Themes)

You can customize the color palette and background of the terminal through configuration files or built-in utilities.

### 1. Interactive Theme Selector
Kitty comes with a built-in theme manager that allows you to preview and select from 300+ pre-installed themes.

```bash
# Launch the interactive theme browser
kitty +kitten themes
```
* Use arrow keys to scroll and preview, `Enter` to select and save, or `q` to exit.
* Selecting a theme will automatically update your `kitty.conf`.

### 2. Switch Theme Non-Interactively
To change the theme instantly via command line or scripts, specify the theme name:

```bash
# Switch to Dimmed Monokai theme immediately in all running instances
kitty +kitten themes --reload-in=all "Dimmed Monokai"
```

### 3. Manual Customization in `kitty.conf`
Specify individual colors directly inside your `~/.config/kitty/kitty.conf` file:

```ini
# Main Colors
foreground            #dcdccc
background            #1f1f1f
selection_foreground  #000000
selection_background  #f0e68c

# Terminal Colors (ANSI colors)
color0  #3f3f3f
color8  #5f5f5f
color1  #705050
color9  #dca3a3
```

---

## 9. Extensibility: Kittens

Kittens are python scripts that run inside kitty to add advanced UI helpers.

```bash
# Display an image in the terminal using kitty's graphics protocol
kitty +kitten icat image.png

# Diff files side-by-side with highlighting
kitty +kitten diff file1.txt file2.txt

# Run SSH connection with automatic config propagation
kitty +kitten ssh user@remote-host
```
