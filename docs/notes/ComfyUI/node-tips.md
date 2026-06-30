---
title: ComfyUI Node Tips
description: A collection of tips, tricks, and formatting conventions for various ComfyUI nodes.
---

# ComfyUI Node Tips

This note covers specific configurations, tricks, and advanced formatting conventions for various built-in ComfyUI nodes.

---

## 💾 Save Image Filename Conventions

The native **Save Image** node in ComfyUI allows you to customize the output paths and filenames using placeholders in the `filename_prefix` widget. You can dynamically insert date, time, and values from other nodes.

### 1. Date & Time Placeholders
You can format the date and time using `%date:FORMAT%` placeholders. The formatting matches standard time specifiers:

| Specifier | Description | Example Output |
| :--- | :--- | :--- |
| `yyyy` | 4-digit Year | `2026` |
| `MM` | 2-digit Month (01-12) | `06` |
| `dd` | 2-digit Day (01-31) | `30` |
| `hh` | 2-digit Hour (00-23) | `14` |
| `mm` | 2-digit Minute (00-59) | `35` |
| `ss` | 2-digit Second (00-59) | `09` |

#### Examples:
*   `%date:yyyyMMdd_hhmmss%` $\rightarrow$ `20260630_143509_00001.png`
*   `myproject_%date:yyyy-MM-dd%` $\rightarrow$ `myproject_2026-06-30_00001.png`

---

### 2. Subfolders Creation
You can organize your outputs into subfolders dynamically by inserting a forward slash (`/`) in the prefix path:

*   **Daily Folders**: 
    `%date:yyyy-MM-dd%/image`
    *   *Result*: Images will be saved inside an output directory structured as `/output/2026-06-30/image_00001.png`.
*   **Project Subfolders**:
    `projects/my_model/%date:MM-dd%_render`
    *   *Result*: `/output/projects/my_model/06-30_render_00001.png`.

---

### 3. Dynamic Node Values
You can dynamically embed parameters (widget values) from other nodes in your workspace using the `%Node Name.widget_name%` syntax. 

::: warning
The **Node Name** must match the title of the node in your workflow *exactly*. If you renamed a node (e.g. renamed "KSampler" to "MySampler"), you must use the renamed title.
:::

#### Examples:
*   **Dimensions**:
    `%Empty Latent Image.width%x%Empty Latent Image.height%_render`
    *   *Result*: `512x512_render_00001.png`
*   **Inference Parameters**:
    `img_%KSampler.seed%_steps%KSampler.steps%`
    *   *Result*: `img_8923482348_steps20_00001.png`

---

### 💡 General Tips
*   **Avoid Input Conversion**: Keep `filename_prefix` as a widget string when utilizing these formatting placeholders. Converting `filename_prefix` to a node input (via right-click) can occasionally bypass the placeholder parser and output literal strings.
*   **Save Image Extended**: If you need more advanced control over counter resets, prompt embedding, or automatic metadata saving, install the custom node `Save Image Extended` via the **ComfyUI Manager**.
