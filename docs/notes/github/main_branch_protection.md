# Main Branch Protection Configuration

**Target Branch:** `main`  
**Method:** GitHub Repository Rulesets (Recommended over legacy branch protection)  
**Purpose:** Prevent accidental history overwrites, enforce code review quality, and ensure code stability for the production-ready branch.

---

## 1. Rule Targets
* **Enforcement status:** Active
* **Target branches:** Include default branch (`main`)

## 2. Core Protections (Prevent Overwrites)
* **[x] Restrict deletions:** Prevents anyone from deleting the `main` branch.
* **[x] Block force pushes:** Prevents rewriting commit history. All fixes must be made via new commits or git reverts.
* **[x] Require linear history:** Forces a clean, straight git graph by requiring developers to use **Squash and Merge** or **Rebase and Merge** (blocks standard merge commits).

## 3. Pull Request & Review Gatekeeping
* **[x] Require a pull request before merging:** Direct pushes to `main` are strictly blocked.
    * **Required approving reviews:** `1` (or `2` for strict enterprise defaults).
    * **[x] Dismiss stale pull request approvals when new commits are pushed:** Forces re-review if the author adds new code after an approval.
    * **[x] Require review from Code Owners:** (Optional) If a `CODEOWNERS` file exists, the assigned team must sign off on changes to their files.

## 4. Code Stability & Testing (CI/CD)
* **[x] Require status checks to pass before merging:**
    * Add specific CI pipelines (e.g., GitHub Actions testing, linting, or VitePress `npm run docs:build` verification).
* **[x] Require branches to be up to date before merging:** Forces developers to test their local branch against the absolute latest commit on `main` before the merge button becomes active.
* **[x] Require all comments on the pull request to be resolved:** Blocks merging if there are unresolved comments or active discussions on the PR.

---

## 5. Emergency Bypassing (Break-Glass Protocol)
Unlike legacy rules, rulesets require an explicit list of who can bypass these restrictions in an emergency (e.g., if CI is broken and an urgent hotfix is required).

* **Bypass List Configuration:**
    * **Role:** Repository Admin (or a specific Dev-Ops Team)
    * **Bypass Mode:** Always allow (or "For pull requests only" for a stricter setup)

---


