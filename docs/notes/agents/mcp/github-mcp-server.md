# github-mcp-server

https://github.com/github/github-mcp-server

## Installation for Antigravity

https://github.com/github/github-mcp-server/blob/main/docs/installation-guides/install-antigravity.md

## Permissions

To treat your **Antigravity CLI (`agy`)** workspace like an autonomous, general developer teammate, you want to grant it enough privileges to manage code, handle pull requests, and manage issue tracking, without handing it administrative control over your account or organization settings.

The following specific scopes should be assigned under **Repository permissions** for a well-rounded agentic setup:

---

## 🛠️ Required Repository Permissions

When setting up a **Fine-grained personal access token**, ignore "Account permissions" and focus entirely on **Repository permissions**. Toggle these scopes to give `agy` general developer privileges:

### 1. Code & Deployment (The Essentials)

- **Contents:** `Read and Write`
- *Why:* This is the core permission. It allows the agent to pull down code, create or switch to feature branches, modify code files, and push commits back to your repository.


* **Commit statuses:** `Read and Write`
* *Why:* Allows the agent to see if CI/CD pipelines or automated test runners passed or failed on a commit, letting it know if its fix broke the build.


* **Workflows:** `Read and Write`
* *Why:* If `agy` is debugging or creating GitHub Actions (`.github/workflows/`), it needs this to edit, update, or trigger workflow files.



### 2. Collaboration & Workflow (The Developer Tools)

* **Pull Requests:** `Read and Write`
* *Why:* Essential for an AI developer. It allows `agy` to open pull requests for you, read feedback on existing PRs, and add comments or request reviews.


* **Issues:** `Read and Write`
* *Why:* Allows the agent to read issues assigned to it, check backlogs, add status updates, or close issues when fixed.


* **Metadata:** `Read-only`
* *Why:* Automatically set to Read-only by GitHub. This lets the agent read basic repository structure data.



---

## 🚫 Permissions to AVOID (Leave as "No Access")

To safely sandbox your agent, **leave these at "No Access"** so a rogue prompt or hallucination can't compromise your settings:

* **Administration:** `No Access` (The agent should never be able to delete the repository, change visibility from private to public, or manage branch protection rules).
* **Secrets** and **Dependabot secrets:** `No Access` (Never allow the agent to read production environment secrets, API tokens, or encryption keys stored in repo settings).
* **Webhooks:** `No Access` (Prevents the agent from creating external network listeners or triggers).

---

## 💡 Quick Tips for `agy`

1. **Repository Selection:** Under **Repository access**, choose **"Only select repositories"** instead of "All repositories". Only grant access to the specific codebase you are currently working on with the CLI. If you start a new project, you can easily go back to GitHub and add that repo to the token's allowed list.
2. **Expiration:** Set the token expiration to **30 or 60 days**. Since `agy` operates locally on your machine, cycling tokens periodically is a great security baseline to protect against accidental credential leakage.
