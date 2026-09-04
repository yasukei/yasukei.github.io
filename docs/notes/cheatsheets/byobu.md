# byobu

Here is a comprehensive, scannable cheat sheet for Byobu (using the default **tmux** backend).

Byobu relies heavily on the **Function keys (F1–F12)**, which makes it much faster than raw tmux once you get the hang of it.

---

## 1. Getting Started & Session Management

| Action | Command / Shortcut | Description |
| --- | --- | --- |
| **Start Byobu** | `byobu` | Starts a new session or attaches to an existing one. |
| **Enable on Login** | `byobu-enable` | Automatically starts Byobu whenever you log into the server. |
| **Disable on Login** | `byobu-disable` | Stops Byobu from launching automatically on login. |
| **Detach Session** | `F6` | Leaves the session running in the background and drops you back to your normal terminal. |
| **Logout & Kill** | `Ctrl` + `d` (or type `exit`) | Closes the current shell. If it's the last tab, it kills the session. |

---

## 2. Managing Tabs (Windows)

Tabs are the main screens listed along the bottom notification bar.

| Action | Shortcut |
| --- | --- |
| **Create New Tab** | `F2` |
| **Move to Next Tab** | `F4` or `Alt` + `Right` |
| **Move to Previous Tab** | `F3` or `Alt` + `Left` |
| **Rename Current Tab** | `F8` |
| **Move Tab Left (Reorder)** | `Ctrl` + `Shift` + `F3` |
| **Move Tab Right (Reorder)** | `Ctrl` + `Shift` + `F4` |

---

## 3. Managing Splits (Panes)

Splits let you divide a single tab into multiple, simultaneous terminal viewports.

* **Split Vertically (Side-by-Side):** `Ctrl` + `F2`
* **Split Horizontally (Top/Bottom):** `Shift` + `F2`
* **Move Focus Between Splits:** `Shift` + `Arrow Keys` (Up/Down/Left/Right)
* **Resize a Split:** `Alt` + `Shift` + `Arrow Keys`
* **Zoom/Maximize Current Split:** `Shift` + `F11` *(Press again to minimize back into place)*
* **Toggle Split Layouts:** `Shift` + `F8` *(Cycles through preset grid layouts)*
* **Close Current Split:** `Ctrl` + `d` (or type `exit`)

---

## 4. Scrolling, Copying & Searching

Because Byobu hijacks the terminal, standard mouse scrolling can sometimes be tricky. Use **View Mode** to navigate history.

1. **Enter View/Scroll Mode:** Press F7.
This freezes the screen and lets you scroll up through your terminal history.


2. **Navigate History:** Use Arrow Keys or Vim keys.
Use **Page Up / Page Down** or **Up/Down arrows** to look back through your logs. (Vim bindings like `G`, `g`, `/` search also work).


3. **Select and Copy Text:** Press Spacebar to start.
Move your cursor to the start of the text, press **Spacebar**, move the cursor to highlight your selection, and press **Enter** to copy it to Byobu's clipboard.


4. **Paste Copied Text:** Press Alt + Insert.
To paste what you just copied into any active Byobu prompt, use **`Alt` + `Insert**` (or `Ctrl` + `a` then `]`).


---

## 5. System Configuration & Help

* **Open Configuration Menu:** `F9` *(Allows you to toggle status bar notifications like CPU, RAM, IP address, and change escape keys).*
* **View Keyboard Shortcuts:** `Shift` + `F1` *(Opens the built-in quick reference help sheet).*
* **Reload Configuration:** `F5` *(Useful if you manually edited your `.byobu/` config files).*

