---
name: check-markdown
description: Check for broken markdown links, syntax, or frontmatter errors, and fix them in a pull request if issues are found.
---

# Check Markdown Skill

This skill validates the markdown files in the repository for broken links, malformed frontmatter, or syntax issues, and automates creating a pull request to resolve them.

## 1. Validation Process
To validate markdown files in this VitePress project, use either or both of these checks:

### Method A: Custom Link-Checking Script (Fast & Lightweight)
Run the custom JavaScript utility to scan for broken relative or root-relative Markdown links:
```bash
node .agents/skills/check-markdown/scripts/check-links.js
```

### Method B: Full Production Build Check
Run the production builder to ensure the site compiles, which runs a thorough dead-link check and captures Vue parser warnings/errors inside Markdown pages:
```bash
npm run build
```
Check for any YAML frontmatter syntax errors or Vue syntax issues in markdown files (since VitePress parses pages as Vue components).


## 2. Fixing Issues
- Locate the reported broken links or formatting errors.
- Correct the references using relative paths or correct anchors.
- Validate the fix by running `npm run build` again to ensure it compiles successfully.

## 3. Pull Request Automation
If any changes were made to fix issues, create a pull request:
1. Ensure you are on a new branch:
   ```bash
   git checkout -b fix/markdown-links
   ```
2. Stage and commit the fixes:
   ```bash
   git add .
   git commit -m "fix: resolve broken markdown links and syntax errors"
   ```
3. Push the branch to the remote repository:
   ```bash
   git push origin fix/markdown-links
   ```
4. Create a pull request using the GitHub CLI:
   ```bash
   gh pr create --title "fix: resolve broken markdown links" --body "This pull request was automatically created by the check-markdown agent skill to resolve broken markdown links or syntax errors."
   ```
