---
title: WAS Node Suite (Revised)
description: A guide to installing, configuring, and using the WAS Node Suite (Revised) custom nodes in ComfyUI.
---

# WAS Node Suite (Revised)

[WAS Node Suite (Revised)](https://github.com/ltdrdata/was-node-suite-comfyui) is a massive collection of over 200 custom nodes for ComfyUI. It expands the functionality of ComfyUI by introducing advanced image processing, dynamic text manipulation, video synthesis, AI analysis, and workflow organization tools.

---

## 🚀 Installation & Setup

### 1. Install via ComfyUI Manager
1. Click the **Manager** button in the ComfyUI control panel.
2. Select **Install Custom Nodes**.
3. Search for `WAS Node Suite (Revised)`.
4. Click **Install** and restart ComfyUI.

### 2. Manual Installation (using Git & `uv`)
If you prefer manual setup, run the following commands:

```bash
# Navigate to custom_nodes directory
cd custom_nodes

# Clone the revised repository
git clone https://github.com/ltdrdata/was-node-suite-comfyui.git
cd ..

# Install dependencies using uv
uv pip install -r custom_nodes/was-node-suite-comfyui/requirements.txt
```

---

## 🛠️ Configuration (`was_suite_config.json`)

On the first startup, WAS Node Suite creates a configuration file at:
`custom_nodes/was-node-suite-comfyui/was_suite_config.json`

Key settings you can customize in this file:
*   `"web_mode"`: Toggle web tools/APIs.
*   `"ffmpeg_bin_path"`: Path to your FFmpeg binary (useful if FFmpeg isn't in your system path).
*   `"ffmpeg_extra_arguments"`: Add custom flags for video rendering.
*   `"disabled_nodes"`: List node names here to prevent them from loading, which helps speed up ComfyUI startup times.

---

## 🧩 Essential Node Categories & Usage

Here are the most commonly used nodes in the suite and how to use them in your workflows:

### 1. Dynamic Text & Prompting
These nodes allow you to create dynamic prompts, use wildcards, and clean up text inputs.

*   **CLIPTextEncode (NSP)**: 
    *   **Usage**: Drop-in replacement for the default CLIP Text Encode node. It supports Node Suite Parsing (NSP) syntax for wildcards and randomization.
    *   **Example Syntax**: `{red|blue|green} car, {sunny|rainy} day` will randomly select one option from each set on every queue prompt.
*   **Text Find and Replace**:
    *   **Usage**: Inputs a string and replaces target words dynamically. Excellent for setting up templates where variables are passed from other nodes (like class names or colors).
*   **Text File Loader**:
    *   **Usage**: Loads text directly from a file. Useful for pulling wildcards, prompts, or CSV data into your workflow.

### 2. Advanced Image & Mask Editing
Enhance image composition, blending, and segmentation.

*   **Image Blend by Mask**:
    *   **Usage**: Blends two images together based on a mask input.
    *   **Parameters**: You can adjust opacity, blending modes (multiply, screen, overlay, etc.), and placement. Great for inpainting overlays.
*   **Image Crop Face**:
    *   **Usage**: Detects faces in an image and crops them out.
    *   **Parameters**: Offers padding settings and crop size adjustments. Used for detailing workflows (like face restoration or headshot generations).
*   **Image Resize**:
    *   **Usage**: Resizes images with multiple filtering options (Lanczos, Nearest, Bilinear). Can scale by percentage or lock to specific target dimensions.

### 3. AI Interrogation & Segmentation
Integrate pre-trained vision-language models into your node graph.

*   **BLIP Analyze Image**:
    *   **Usage**: Analyzes an image and returns a text description.
    *   **Modes**:
        *   `caption`: Generates a standard descriptive caption.
        *   `interrogate`: Asks questions about the image (e.g., "What is the subject wearing?").
*   **SAM Image Mask (Segment Anything)**:
    *   **Usage**: Generates high-quality segment masks from an image based on key coordinates or bounding box selections.

### 4. Video & Multi-Media Synthesis
Compile and export animations.

*   **Create Video from Path**:
    *   **Usage**: Scans a directory of generated frames and compiles them into a video format (MP4, AVI, WebM, or animated GIF).
    *   **Requirements**: Requires `ffmpeg` installed on your Ubuntu system:
        ```bash
        sudo apt install ffmpeg -y
        ```

### 5. Workflow Organization
Keep your node graph clean.

*   **Bus Node**:
    *   **Usage**: Bundles `MODEL`, `CLIP`, `VAE`, and positive/negative `CONDITIONING` into a single connection.
    *   **Why use it**: Dramatically reduces spaghetti wires in complex workflows by routing all core data streams through a single "Bus" wire.

---

## ❓ Troubleshooting

### BLIP/SAM Download Issues
If the models fail to download automatically on startup:
1. Ensure your Ubuntu environment has internet access.
2. Check the logs in your terminal. You can manually download the model files and place them in the path specified by the warning logs (usually inside `models/` or the extension's subfolders).

### FFmpeg Errors during Video Generation
If you get errors compiling videos:
1. Check that FFmpeg is installed globally:
   ```bash
   ffmpeg -version
   ```
2. If it is installed but not found, set `"ffmpeg_bin_path"` in `was_suite_config.json` to `/usr/bin/ffmpeg`.
