# Jules

This document serves as a summary of Jules’s architecture, workflows, limits, and best practices based on operational usage.

## 💡 System Overview & Core Capabilities
* **Primary Role:** Jules is an asynchronous AI coding agent optimized entirely for end-to-end software engineering workflows (codebase exploration, feature implementation, debugging, and refactoring).
* **What it is NOT:** It is not a general-purpose chatbot. It is not intended for web scraping, creative writing, or live marketing/market research.
* **Environment:** Jules operates entirely inside an isolated, secure Google Cloud Virtual Machine (VM) sandbox running Ubuntu. It automatically clones your GitHub repository into this environment to run tests and make modifications.

## ⚙️ Execution, Limits & Quotas
* **The Subscription Quota:** Limits are counted per task (1 task = 1 unique conversation session/thread or GitHub Issue), not per chat message. Inside a running session, you can send multiple messages to guide Jules. Depending on your tier (Free, AI Pro, AI Ultra), you have different daily task and concurrency limits.
* **Model Capabilities:** Jules is natively powered by Google's Gemini Pro (e.g., Gemini 2.5 Pro / 3 Pro). You do not need to manually toggle or select models; Jules automatically leverages its underlying architecture to handle both deep reasoning and low-level code generation tasks efficiently.
* **Concurrency:** Highly asynchronous. You can spin up multiple parallel conversation sessions on the same repository concurrently (each gets its own fresh cloud VM sandbox). The free tier typically allows up to 3 parallel tasks.
* **Timeouts:** Tasks have built-in execution limits. For example, there is typically a 15-minute execution time limit per active task run to prevent infinite loops during failing test cycles. If it times out, it allows you to commit the work-in-progress (WIP).

---

## 🤝 GitHub Integration & Workflows

### 1. Interacting with GitHub Issues
* **Trigger via Labels:** Tag any GitHub Issue with a specific label (e.g., `jules`). Jules will automatically wake up via webhook, spin up a VM container, read the issue description, and draft an execution plan.
* **Inline Conversations:** You can communicate with Jules entirely through GitHub Issue comments by explicitly tagging **`@jules`** in your replies.

### 2. Multi-Tasking & Scope Adjustments
* **Task Scope:** If you discover a secondary bug or requirement while Jules is actively working, it is often better to open a new issue or let Jules finish its current execution plan first. If you must adjust the scope, request the addition in the active UI chat thread or tag `@jules` in the original GitHub Issue comment thread. Do *not* post instructions in a separate, unlinked GitHub Issue thread expecting it to merge the context automatically.

### 3. Reviewing & Deliverables
* **Pull Requests (PR):** Jules outputs all deliverables by opening a standard GitHub Pull Request. It will never push directly to protected branches.
* **Automated Feedback Loop:** * If you **Merge** or **Close** the PR on GitHub, Jules detects the webhook event and automatically tears down its VM container.
  * If you leave a **Review Comment** on a specific line of code in the PR, Jules automatically wakes up, reads the feedback, applies a corrective patch, and pushes a new commit to the same branch.

### 4. GitHub Actions (CI/CD)
* **Log Reading:** Jules automatically monitors GitHub Actions. If its PR triggers a build or test failure in your pipeline, it reads the runner logs, diagnoses the compilation or test error, and attempts to self-correct by pushing an automated patch commit.
* **Trigger via CI Failures:** You can use the official GitHub Action (`google-labs-code/jules-action`) to automatically summon Jules whenever your main production builds break.

---

## 🛠️ Testing, Containers & Configuration

### Environment & Docker
Unlike basic chat environments, Jules's VM is a robust cloud sandbox with core developer tools like Node.js, Python, Go, Rust, Java, and **Docker preinstalled**.
* **How it handles dependencies:** It can natively install external system software inside its Ubuntu VM runner using `apt` or package managers. It can also run containerized dependencies since Docker is available in the environment.
* **Best Practice:** Ensure your repository has clear setup instructions (like a `setup.sh` script or a `Makefile`) so Jules knows exactly how to build your project and start necessary test databases.

### Controlling Jules Behavior (`AGENTS.md`)
To enforce persistent code standards or structural workflow rules across all sessions, commit an **`AGENTS.md`** file to the root directory of your repository. Jules's critic agent will use this file to verify that its generated code doesn't violate your project's coding conventions.
