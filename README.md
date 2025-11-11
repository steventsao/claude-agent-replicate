# Claude Agent + Replicate API

Interactive canvas UI for generating AI images using Claude Agent SDK and Replicate models.

## Motivation

Exploring loading context progressively via Skills on API platforms like Replicate where tools and model descriptions can be heavy on token usage. I use code act pattern to allow agent to express model composition more flexibly with Claude Agent SDK. 

## Overview

- **Frontend**: React Flow canvas with chat panel
- **Backend**: Python WebSocket server + Claude Agent SDK
- **AI**: Replicate image generation models

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

```bash
# With PM2
npm run dev:pm2

# Or manually in separate terminals
python3 backend/server.py
npm run dev
```

Access at http://localhost:5173

## Features

- Agent-driven image generation using Replicate models
- Draggable canvas with React Flow
- WebSocket communication

## Reference

- https://github.com/anthropics/claude-agent-sdk-demos/