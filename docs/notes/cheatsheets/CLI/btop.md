# btop

[btop](https://github.com/aristocratos/btop) is an interactive, GPU-capable terminal resource monitor. It displays real-time statistics for CPU, memory, disks, network, and running processes with a customizable, mouse-supportable graphical UI.

---

## 1. Quick Comparison with standard `top`

| Feature | `top` | `btop` |
| --- | --- | --- |
| **User Interface** | Plain text / Minimalist | ✅ Rich, colorized graphs with box layouts |
| **Mouse Interaction** | ❌ No | ✅ Yes (fully clickable menu, boxes, and lists) |
| **GPU Monitoring** | ❌ No | ✅ Yes (monitors NVIDIA, AMD, Intel GPU usage) |
| **Process Control** | Basic commands only | ✅ Simplified filtering, tree toggling, and signaling |
| **Interface Customization**| ❌ No | ✅ Yes (change layouts, update rate, themes on-the-fly) |

---

## 2. Command Line Options

Use startup flags to customize performance, themes, or configure layout before launching.

```bash
# Basic launch
btop

# Force TTY mode (useful for SSH connections - uses 16 colors and basic graphs)
btop --tty

# Use low-color mode (disables truecolor 24-bit rendering, uses 256 colors)
btop --low-color

# Set startup update rate in milliseconds (e.g. 500ms)
btop --update 500

# Start with an initial process search filter
btop --filter "nginx"

# Load a custom configuration file
btop --config /path/to/custom/btop.conf
```

---

## 3. General Navigation & Interface Controls

Adjust panels, presets, and main options using these hotkeys.

| Key | Action | Description |
| --- | --- | --- |
| `m` | **Main Menu** | Open settings, change color theme, and read help documentation. |
| `p` | **Next Preset** | Cycle through preset box view combinations. |
| `1` | **Toggle CPU** | Show/hide CPU box. |
| `2` | **Toggle Memory** | Show/hide Memory and Disk box. |
| `3` | **Toggle Network**| Show/hide Network traffic box. |
| `4` | **Toggle Processes**| Show/hide Process tracking box. |
| `+` / `-` | **Update Speed** | Increase / decrease refresh frequency by 100ms. |
| `Esc` / `q`| **Quit** | Exit the program. |

---

## 4. Process Panel Controls

Manage running services and threads interactively.

| Key | Action | Description |
| --- | --- | --- |
| `↑` / `↓` (or `j` / `k`) | **Navigate List** | Scroll through the running processes. |
| `Enter` | **Process Details**| View memory, path, CPU usage, and parent info for the selected process. |
| `f` | **Filter** | Search processes by typing name. Press `Enter` to search or `Esc` to clear. |
| `t` | **Tree View** | Toggle nested parent/child tree formatting. |
| `r` | **Reverse Sort** | Reverse sorting order of active column. |
| `k` | **Kill Process** | Send `SIGKILL` (9) immediately to selected process. |
| `s` | **Send Signal** | Open menu to select custom Unix signal (e.g. `SIGTERM`, `SIGINT`). |

---

## 5. Network Panel Controls

Check bandwidth status.

| Key | Action | Description |
| --- | --- | --- |
| `n` | **Switch Interface**| Cycle through active network cards (e.g. `eth0`, `wlan0`). |
| `b` | **Toggle Unit** | Switch display format between bytes (B/s) and bits (b/s). |
| `a` | **Auto-Scale** | Toggle automatic scaling of graph heights. |
| `z` | **Zero Counters** | Reset total download and upload data statistics to 0. |

---

## 6. Configurations (`btop.conf`)

You can modify btop's defaults directly in the configuration file.

* **File Location**: `~/.config/btop/btop.conf`
* **Theme Directory**: `~/.config/btop/themes/`

### Common Config Tweaks (`~/.config/btop/btop.conf`):
```toml
# Enable Vim keys navigation (h, j, k, l, g, G)
vim_keys = true

# Change default sampling interval (in milliseconds)
update_ms = 1000

# Customize visible panels on startup
shown_boxes = "cpu mem net proc"

# Enable/disable mouse input
disable_mouse = false

# Toggle terminal transparency background
theme_background = false
```
