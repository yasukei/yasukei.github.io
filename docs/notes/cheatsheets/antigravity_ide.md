# Antigravity IDE

Here is your quick-reference cheatsheet for **Google Antigravity IDE**, the agentic development platform designed for autonomous, multi-step engineering tasks across your editor, terminal, and browser.

---

## 1. Essential Keyboard Shortcuts

These shortcuts define the core Antigravity workflow.

| Action | Mac | Windows / Linux |
| --- | --- | --- |
| **Toggle Editor <-> Agent Manager** | `Cmd + E` | `Ctrl + E` |
| **Toggle Agent Panel** (Focus Chat) | `Cmd + L` | `Ctrl + L` |
| **Inline AI Generation / Command** | `Cmd + I` | `Ctrl + I` |
| **Start New Agent Conversation** | `Cmd + Shift + L` | `Ctrl + Shift + L` |
| **Toggle Integrated Terminal Panel** | `Ctrl + `` | `Ctrl + `` |
| **Accept Code Autocomplete** (Supercomplete) | `Tab` | `Tab` |
| **Focus Next Code Hunk (Diff)** | `Alt + J` | `Alt + J` |
| **Accept Focused Hunk (Diff)** | `Alt + Enter` | `Alt + Enter` |

> 💡 **Pro-Tip:** Need to feed errors into the agent? Simply highlight any log output in your terminal and hit `Cmd + L` (Mac) or `Ctrl + L` (Windows) to instantly attach it to your prompt.

---

## 2. Core Slash ( / ) Commands

Type these directly into your prompt or Agent panel to instantly control conversation states, run sub-agents, or pivot behaviors.

| Command | Category | What it does |
| --- | --- | --- |
| `/planning` | Mode | Switches the agent into a deep-thinking multi-turn loop (reviews plans *before* writing code). |
| `/fast` | Mode | Bypasses long planning stages for quick edits and single-step adjustments. |
| `/browser <query>` | Sub-agent | Explicitly launches a background Chrome sub-agent to debug or gather runtime context. |
| `/review` | Task | Initiates a full deep-scan of workspace changes to check for bugs or logic patterns. |
| `/test` | Task | Automatically writes and runs unit tests for the active, focused file. |
| `/fork` (or `/branch`) | Session | Clones your current session thread into a parallel workspace to test a different approach safely. |
| `/rewind` (or `/undo`) | Session | Rolls back conversation history to a specified previous message state. |
| `/schedule` | Automation | Sets up recurring tasks for the agent to execute at fixed intervals (e.g., checks for dead code weekly). |
| `/mcp` | Configurations | Opens the Model Context Protocol (MCP) tool manager screen. |

---

## 3. Context Referencing with `@` Commands

Instead of copying and pasting huge blocks of code, type `@` to grab indexed workspace resources and explicitly pass them to the agent.

* `@workspace` — Feeds the entire codebase layout and index to the agent context.
* `@file` — Prompts a quick-picker to reference a specific file by name or path.
* `@selection` — Attaches only the code you currently have highlighted in the editor.
* `@terminal` — Sends the active terminal's buffer and output straight into the prompt.
* `@problems` — Attaches all current errors and warnings from your IDE's Problems tab.
* `@codebase` — Runs a semantic search across all files to pull in highly relevant matches.

---

## 4. Model Context Protocol (MCP) Integration

Antigravity leverages MCP to allow agents to interact directly with your external infrastructure, platforms, and third-party tools. You can connect them via `mcp_config.json` or spin up quick local instances using `npx`:

```bash
# Connect to your local filesystem
npx @modelcontextprotocol/server-filesystem [path]

# Connect to database tools (Postgres/Supabase)
npx @modelcontextprotocol/server-postgres [connection-string]

# Connect to continuous integration or project management
npx @modelcontextprotocol/server-github

```

Once configured, you can call them directly in chat using their server names (e.g., `@Supabase`, `@Linear`, `@Vercel`).

---

## 5. Setting Custom Instructions & System Rules

You can lock in exact style guides and behavioral preferences across your development cycles without repeating yourself. Antigravity reads structural context from markdown files inside your projects:

* **Global Preferences:** Edited via `Cmd + Shift + P` -> *Antigravity: Open User Customizations* (Saves to `~/.gemini/GEMINI.md`).
* **Workspace Rules:** Create a `.agent/rules/` directory in your project root and drop in `.md` files (e.g., `TESTING.md`, `STYLE_GUIDE.md`).

### The Golden Framework: Plan -> Execute -> Verify

For complex features, always dictate this mental loop to your sub-agents:

```markdown
1. /plan [detailed requirements + tech stack]
2. "Review this plan as a Staff Engineer. Find gaps."
3. "Implement Phase 1."
4. "Prove to me this works. Run the test suite."

```