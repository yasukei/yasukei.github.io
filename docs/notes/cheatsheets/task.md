# Task

::: v-pre

[Task](https://taskfile.dev/) (also known as `go-task`) is a task runner and build tool written in Go. It is a modern, YAML-based alternative to GNU Make, featuring cross-platform compatibility, parallel execution, smart caching, and simple syntax.

---

## 1. Quick Comparison with `make`

| Feature | `make` | `Task` (`task`) |
| --- | --- | --- |
| **Syntax Format** | Custom Makefile syntax | ✅ Standard YAML (`Taskfile.yml`) |
| **Cross-Platform**| Hard (uses host shell, e.g., bash/cmd) | ✅ Easy (native Go interpreter fallback) |
| **File Checking** | Timestamp-based (`file: dependencies`) | ✅ Advanced hash-based caching & status commands |
| **Dependencies** | Target-based prerequisites | ✅ Task-based dependency graphs with variables |
| **Variables** | String manipulation | ✅ Go template engine (`{{.VAR}}`) |

---

## 2. Basic Setup & CLI Commands

Create a default `Taskfile.yml` and execute tasks using the `task` CLI.

```bash
# Initialize a default template Taskfile.yml in the current directory
task --init

# Run a task (default: runs the task named "default")
task

# Run a specific task
task build

# List all available tasks with their descriptions
task --list # Or: task -l

# View what a task does without running it
task --summary test
```

---

## 3. Basic Taskfile Structure (`Taskfile.yml`)

A standard `Taskfile.yml` defines variables and tasks with executable shell commands.

```yaml
version: '3'

vars:
  PROJECT_NAME: my-app

tasks:
  default:
    desc: Default task to run on raw command
    cmds:
      - task: build

  build:
    desc: Build the application binary
    cmds:
      - echo "Building {{.PROJECT_NAME}}..."
      - go build -o {{.PROJECT_NAME}} main.go
    silent: true # Hide the commands being executed in terminal output
```

---

## 4. Variables & Templating

Variables are accessed using Go templating `{{.VAR_NAME}}`.

### Predefined Variables
Task provides built-in environment and directory variables:
* `{{.ROOT_DIR}}`: Absolute path of the directory containing the root Taskfile.
* `{{.TASKFILE_DIR}}`: Absolute path of the directory containing the current Taskfile.
* `{{.USER_WORKING_DIR}}`: The directory where the user ran the `task` command.

```yaml
tasks:
  info:
    cmds:
      - echo "Root directory is {{.ROOT_DIR}}"
      - echo "Current directory is {{.TASKFILE_DIR}}"
```

### Dynamic Variables (Shell Output)
Set variables dynamically based on the output of a terminal command.

```yaml
version: '3'

tasks:
  deploy:
    vars:
      GIT_COMMIT:
        sh: git rev-parse --short HEAD
    cmds:
      - echo "Deploying commit {{.GIT_COMMIT}}..."
```

### Accessing CLI Arguments (`CLI_ARGS`)
Pass arbitrary arguments from the command line into your tasks using `--`.

```yaml
tasks:
  test:
    cmds:
      - go test {{.CLI_ARGS}}
```
```bash
# Running this executes: go test -v -run TestMain
task test -- -v -run TestMain
```

---

## 5. Execution & Dependencies

Control task execution flow and parameters.

### Parallel Executions
Task runs commands in a task sequentially, but runs dependency tasks in parallel by default.

```yaml
tasks:
  # Run clean, build, and lint in parallel before executing deploy
  deploy:
    deps: [clean, build, lint]
    cmds:
      - ./deploy.sh
```

### Passing Variables to Dependencies
Configure specific values for prerequisites.

```yaml
tasks:
  build:all:
    deps:
      - task: build
        vars: { GOOS: linux }
      - task: build
        vars: { GOOS: darwin }

  build:
    cmds:
      - GOOS={{.GOOS}} go build -o app-{{.GOOS}}
```

---

## 6. Smart Caching (Up-to-Date Checking)

Task can skip execution if output files are already up-to-date.

### 1. File Hash Caching (`sources` & `generates`)
Specifies input files and output targets. Task hashes the files and skips runs if they haven't changed.

```yaml
tasks:
  build:
    cmds:
      - go build -o myapp main.go
    sources:
      - main.go
      - go.mod
    generates:
      - myapp
```

### 2. Status Commands (`status`)
Use shell exit codes (`0` means up-to-date, non-zero means needs execution) to control runs.

```yaml
tasks:
  docker:build:
    cmds:
      - docker build -t myimage .
    # Skip build if docker image already exists locally
    status:
      - docker image inspect myimage
```

---

## 7. Advanced Configuration

### Including other Taskfiles (`includes`)
Break down large projects into smaller modular Taskfiles.

```yaml
# Root Taskfile.yml
version: '3'

includes:
  docker: ./tasks/DockerTasks.yml
  test:
    taskfile: ./tasks/TestTasks.yml
    dir: ./tests # Run commands inside tests/ directory
```
```bash
# Call sub-taskfiles using namespace namespaces
task docker:build
task test:run
```

### Task Watching (`--watch` / `-w`)
Automatically watch files and re-execute a task on changes.

```bash
# Keep task running and hot-reload when main.go changes
task --watch build
```

:::
