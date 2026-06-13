# Git

## 1. Setup & Configuration

Configure your identity across all local repositories.

```bash
# Set your global username
git config --global user.name "Your Name"

# Set your global email address
git config --global user.email "your.email@example.com"

# Check your configurations
git config --list

```

---

## 2. Starting a Repository

Initialize a new project or grab one from a remote server.

```bash
# Initialize a local Git repository in the current folder
git init

# Clone (download) a remote repository
git clone <repository-url>

```

---

## 3. The Staging Area & Committing

The daily workflow of saving your changes.

```bash
# Show modified, untracked, and staged files
git status

# Stage a specific file for the next commit
git add <file-name>

# Stage ALL changed and new files
git add .

# Unstage a file (keep the changes, but don't commit them yet)
git reset <file-name>

# Commit staged changes with a descriptive message
git commit -m "feat: add user login functionality"

# Amend the last commit (fix a typo or add a forgotten file)
git commit --amend --no-edit

```

---

## 4. Branching & Merging

Isolating your work and combining features.

```bash
# List all local branches (* shows current branch)
git branch

# Create a new branch and switch to it immediately
git checkout -b <branch-name>

# Switch to an existing branch
git checkout <branch-name>

# Merge a specific branch into your current active branch
git merge <branch-name>

# Delete a local branch (must switch off it first)
git branch -d <branch-name>

```

---

## 5. Sharing & Syncing (Remotes)

Pushing to and pulling from GitHub, GitLab, or Bitbucket.

```bash
# Download updates and merge them into your current branch
git pull origin <branch-name>

# Upload your local commits to the remote repository
git push origin <branch-name>

# View all configured remote repositories
git remote -v

```

---

## 6. Inspection & History

Looking back at what happened.

```bash
# View commit history (Press 'q' to exit)
git log

# View a compact, one-line-per-commit history
git log --oneline

# Show what changes were made in unstaged files
git diff

# Show what changes were made in a specific commit
git show <commit-hash>

```

---

## 7. Saving Progress Without Committing

Use the "stash" to quickly clean up your working directory without losing your code.

```bash
# Temporarily save all modified tracked files
git stash

# List all your saved stashes
git stash list

# Re-apply the most recently stashed changes and delete it from the stash list
git stash pop

# Discard the most recent stash
git stash drop

```

---

## 8. Undo & Emergency Options

When things go sideways and you need to backtrack.

> ⚠️ **Warning:** Commands labeled with `---hard` will permanently overwrite your uncommitted local changes. Use with caution!

```bash
# Discard local changes in a specific file (revert to last commit)
git checkout -- <file-name>

# Safely undo a commit by creating a NEW commit that reverses the changes
git revert <commit-hash>

# Undo the last commit but KEEP your changes in the staging area
git reset --soft HEAD~1

# Undo the last commit and COMPLETELY ERASE all changes since then
git reset --hard HEAD~1

```
