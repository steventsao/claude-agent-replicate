# Claude Agent + Replicate API

Interactive canvas UI for generating AI images using Claude Agent SDK and Replicate models.

**Now available as a Desktop Application with Tauri!** Open folders, browse files, and work with your file system like VS Code.

## Motivation

Exploring loading context progressively via Skills on API platforms like Replicate where tools and model descriptions can be heavy on token usage. I use code act pattern to allow agent to express model composition more flexibly with Claude Agent SDK.

## Overview

- **Frontend**: React Flow canvas with chat panel + File Explorer (desktop only)
- **Backend**: Python WebSocket server + Claude Agent SDK
- **AI**: Replicate image generation models
- **Desktop**: Tauri framework for native desktop app with file system access

## Screenshot

![Batch Generate](screenshots/batch-generate.png)

## Quick Start

### Installation

```bash
# Install dependencies
pip install -r requirements.txt
npm install

# Setup environment
cp .env.example .env
# Edit .env with your API keys:
# - ANTHROPIC_API_KEY
# - REPLICATE_API_TOKEN
# - STORAGE_DIR (optional, defaults to 'data/')
```

### Running

#### Web Version

```bash
# With PM2
npm run dev:pm2

# Or manually in separate terminals
python3 backend/server.py
npm run dev
```

Access at http://localhost:5173

#### Desktop Application (Recommended)

**Prerequisites:**
- Rust (install from https://rustup.rs/)
- System dependencies:
  - **Linux**: `sudo apt-get install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf`
  - **macOS**: Xcode Command Line Tools
  - **Windows**: WebView2 (usually pre-installed on Windows 10+)

**Run in development mode:**
```bash
npm run tauri:dev
```
This will start both the Python backend and the Tauri desktop app with hot-reload.

**Build for production:**
```bash
npm run tauri:build
```
The built application will be in `src-tauri/target/release/bundle/`

## Features

### Core Features
- Agent-driven image generation using Replicate models
- Draggable canvas with React Flow
- WebSocket communication for real-time updates
- Multi-workspace support

### Desktop-Only Features
- **File Explorer**: Browse and open folders from your local file system
- **File System Integration**: Read and write files directly
- **Native Performance**: Runs as a native desktop application using Tauri
- **VS Code-like Experience**: Open folders, navigate files, and manage your workspace

The file explorer appears automatically when running in desktop mode and provides:
- Folder opening via native dialog
- Tree view of files and directories
- File selection and content reading
- Integration with the chat panel for file operations

## Reference

- https://github.com/anthropics/claude-agent-sdk-demos/