---
title: ComfyUI
description: A comprehensive cheatsheet for installing, configuring, and using ComfyUI on Ubuntu.
---

# ComfyUI

ComfyUI is a powerful, node-based graphical user interface for Stable Diffusion and other generative AI models. This cheatsheet covers installation, running, keyboard shortcuts, and troubleshooting specifically for Ubuntu environments.

---

## 🚀 Installation & Setup

To get ComfyUI running with GPU acceleration on Ubuntu using `uv`, follow these steps.

### 1. Prerequisites
Ensure you have the Nvidia drivers installed. You can check this by running:
```bash
nvidia-smi
```

Install Python, Git, and `uv` (a fast Python package installer and resolver written in Rust):
```bash
sudo apt update
sudo apt install python3-pip git -y

# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 2. Clone Repository
Clone the official ComfyUI repository:
```bash
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
```

### 3. Virtual Environment (Recommended)
Create a Python virtual environment using `uv` (this will create a `.venv` directory):
```bash
uv venv
```

### 4. Install PyTorch with CUDA
Install PyTorch with CUDA support. Make sure to check compatibility with your installed CUDA version:
```bash
uv pip install torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cu121
```

### 5. Install Dependencies
Install the remaining ComfyUI dependencies:
```bash
uv pip install -r requirements.txt
```

---

## 🏃 Running ComfyUI

### Basic Start Command
Run ComfyUI using `uv run` (which automatically locates and uses the virtual environment):
```bash
uv run python main.py
```
*(Alternatively, you can activate the environment via `source .venv/bin/activate` and run `python main.py`)*

### Command Line Arguments
Here are useful startup arguments:

| Argument | Action |
| --- | --- |
| `--listen` | Listen on all network interfaces (allows access from other devices on local network) |
| `--port 8188` | Set the port (default is `8188`) |
| `--enable-manager` | Enable the ComfyUI-Manager extension |
| `--highvram` / `--lowvram` | Force high/low VRAM mode (auto-detected by default) |
| `--novelty-sdxl-bypass` | Save VRAM on SDXL load |
| `--use-pytorch-cross-attention` | Use PyTorch cross-attention (often faster on newer GPUs) |
| `--preview-method auto` | Enable previewing latent images while generating |
| `--disable-smart-memory` | Disable smart VRAM management (useful if encountering OOM crashes) |

### 🔄 Auto-Start Script
Create a helper script `run.sh` in the ComfyUI root directory to quickly launch it:
```bash
#!/bin/bash
cd "$(dirname "$0")"
uv run python main.py --listen --preview-method auto --enable-manager
```
Make it executable:
```bash
chmod +x run.sh
```
----

## ⌨️ Keyboard Shortcuts (Web UI)

These shortcuts are essential for efficient node editing and workflow design.

### Canvas Navigation & View
| Shortcut | Action |
| --- | --- |
| **Space + Drag** / **Right-Click + Drag** | Pan/scroll the workspace |
| **Scroll Wheel** / **Pinch Zoom** | Zoom in / out |
| **Ctrl + 0** | Reset zoom to 100% |
| **Shift + Double Click** | Collapse / Expand selected node |

### Node Editing & Creation
| Shortcut | Action |
| --- | --- |
| **Double Click** (on canvas) | Open node search menu |
| **Ctrl + Enter** | Queue prompt (generate image) |
| **Ctrl + S** | Save current workflow to JSON |
| **Ctrl + O** | Load workflow from JSON |
| **Ctrl + C** / **Ctrl + V** | Copy and paste selected nodes (preserves connections inside copy) |
| **Ctrl + Shift + V** | Paste nodes with input connections intact |
| **Alt + Drag** (on a node) | Clone/duplicate the node |
| **Delete** / **Backspace** | Delete selected node(s) |
| **Ctrl + G** | Group selected nodes |
| **Ctrl + M** | Mute / unmute selected node (stops execution) |

### Connections & Wires
| Shortcut | Action |
| --- | --- |
| **Drag + Release** (on empty space) | Open search menu filtered to compatible inputs/outputs |
| **Ctrl + Drag** (on a slot) | Move all connected wires to a different slot |
| **Shift + Click** (on a wire) | Add a reroute node (dot) to the wire |
| **Right-Click** (on input/output) | Convert between Widget (value) and Input (node connector) |

---

## 📦 Model & Path Management

### Shared Model Paths (with Stable Diffusion WebUI)
If you already run AUTOMATIC1111/Stable Diffusion WebUI, you don't need to duplicate models. You can share them.

1. Copy the template configuration file:
   ```bash
   cp extra_model_paths.yaml.example extra_model_paths.yaml
   ```
2. Open `extra_model_paths.yaml` and edit the `base_path` under `a1111` to point to your WebUI installation:
   ```yaml
   a1111:
       base_path: /path/to/stable-diffusion-webui
   ```

### Default Model Directory Layout
Put your downloaded models in these directories under the ComfyUI root:

| Model Type | Destination Folder |
| --- | --- |
| **Checkpoints (Base Models)** | `models/checkpoints/` |
| **LoRA** | `models/loras/` |
| **VAE** | `models/vae/` |
| **ControlNet** | `models/controlnet/` |
| **Upscalers** | `models/upscale_models/` |
| **Embeddings (TI)** | `models/embeddings/` |

---

## 🛠️ ComfyUI Manager & Custom Nodes

[ComfyUI-Manager](https://github.com/ltdrdata/ComfyUI-Manager) is an essential custom node to install, update, and manage other custom nodes/models.

### 1. Install ComfyUI-Manager
Install the manager dependencies using `uv`:
```bash
uv pip install -r manager_requirements.txt
```

Enable the manager by adding the `--enable-manager` flag when running ComfyUI:
```bash
uv run python main.py --enable-manager
```

### 2. Manual Custom Node Installation
If you prefer manual Git installation:
```bash
cd custom_nodes
git clone <custom-node-repo-url>
cd <custom-node-folder>
# If they have requirements, install them using uv.
# uv automatically finds the .venv in the parent directory!
uv pip install -r requirements.txt
```

---

## ❓ Troubleshooting (Ubuntu Specific)

### 1. Out of VRAM (OOM) Errors
If you run out of GPU memory:
- Add `--lowvram` or `--medvram` to your startup command.
- Set `--preview-method none` to disable real-time VRAM-intensive generation previews.

### 2. CUDA/PyTorch Version Mismatch
If ComfyUI cannot find your GPU (running on CPU instead):
Ensure your PyTorch installation matches CUDA. Verify with:
```bash
python3 -c "import torch; print(torch.cuda.is_available())"
```
If it returns `False`, re-install PyTorch using the exact CUDA-enabled wheels command shown in the Installation section.

### 3. Monitoring GPU Usage
Open a terminal split next to ComfyUI to monitor VRAM and temperature:
```bash
watch -n 0.5 nvidia-smi
```
