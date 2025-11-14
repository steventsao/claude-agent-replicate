---
name: ai_models
description: "**USE THIS TOOL** when user wants to: generate images, edit photos, run ML models, create videos, text-to-speech, or any AI/ML inference tasks. REQUIRED for requests like: 'generate image', 'edit this photo', 'make it blue', 'create video', 'run [model name]'. Supports google/nano-banana, flux, and all Replicate models. **Check this tool BEFORE saying you cannot do image/video generation.**"
---

# Query Understanding

- When a user requests a multi-step task where such model does not exist in a single API call, break it down into multiple calls starting with the recommended models below.
- **For image editing**: Always use `google/nano-banana` with `image_input` parameter (list of image URLs). Do NOT use bash scripts - use direct replicate.run() calls.
- **CRITICAL - Localhost URLs**: NEVER use localhost URLs (http://localhost:*) in image_input. ALWAYS convert local files to base64 data URIs using the `image_to_data_uri()` helper function shown in the "Edit images" section.
- **First invocation must succeed**: Use exact patterns from examples below, especially for image_input (must be list)

# Replicate AI Models

Run AI models on Replicate's cloud infrastructure without managing GPUs or infrastructure.

## Quick Start (Copy & Paste Ready)

**⚠️ CRITICAL - READ THIS FIRST ⚠️**:
- **Replicate URLs expire in 24 hours** - Files MUST be downloaded immediately
- **MANDATORY**: ALWAYS call `download_replicate_output()` after EVERY `replicate.run()` that generates images/videos/audio
- **NEVER skip the download step** - URLs will be invalid after 24 hours
- **LOCALHOST URLS DON'T WORK**: Always convert local files to base64 data URIs (see helper below)

## PM2 Log Retrieval (For Agent SDK)

When checking PM2 logs programmatically, use `--nostream` to avoid hanging:

```bash
# ✅ CORRECT - Exits immediately after printing logs
pm2 logs backend --lines 100 --nostream

# ✅ Also good - Use with grep but ensure --nostream
pm2 logs backend --lines 100 --nostream | grep -A 20 "Hook"

# ❌ WRONG - This will hang and stream forever
pm2 logs backend --lines 100
pm2 logs backend --lines 100 | grep -A 20 "Hook"
```

The `--nostream` flag ensures pm2 prints historical logs and exits, preventing tool calls from hanging on active tail streams.

```python
import replicate
import base64
from pathlib import Path
import sys

# Setup path for skill scripts
sys.path.insert(0, str(Path.cwd() / ".claude/skills/ai_models/scripts"))
from download_replicate_output import download_replicate_output

# Helper: Convert local/localhost files to base64 data URI
def image_to_data_uri(image_path):
    """Convert local image to base64 data URI for Replicate API"""
    with open(image_path, 'rb') as f:
        image_data = f.read()
    b64_data = base64.b64encode(image_data).decode('utf-8')
    ext = Path(image_path).suffix.lower()
    mime_type = {'.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png', '.webp': 'webp'}.get(ext, 'jpeg')
    return f"data:image/{mime_type};base64,{b64_data}"

# Image generation - ALWAYS save outputs
output = replicate.run(
    "google/nano-banana",
    input={"prompt": "professional photo of red apple on wooden table"}
)

# ⚠️ MANDATORY: Save output immediately (URLs expire in 24h)
url = str(output.url) if hasattr(output, 'url') else str(output)
result = download_replicate_output(url, "google/nano-banana", tag="apple")
__result__ = f"✅ Generated and saved to: {result['local_path']}"

# Image editing with PUBLIC URL
output = replicate.run(
    "google/nano-banana",
    input={
        "prompt": "make it blue",
        "image_input": ["https://your-image-url.jpg"],  # Public URLs work directly
        "aspect_ratio": "1:1"
    }
)
url = str(output.url) if hasattr(output, 'url') else str(output)
result = download_replicate_output(url, "google/nano-banana", tag="blue")
__result__ = f"✅ Edited and saved to: {result['local_path']}"

# Image editing with LOCAL FILE (REQUIRED for localhost URLs)
local_file = "/path/to/image.jpg"  # or downloads/someimage.png
data_uri = image_to_data_uri(local_file)  # Convert to base64
output = replicate.run(
    "google/nano-banana",
    input={
        "prompt": "make it blue",
        "image_input": [data_uri],  # Use data URI, NOT localhost URL
        "aspect_ratio": "1:1"
    }
)
url = str(output.url) if hasattr(output, 'url') else str(output)
result = download_replicate_output(url, "google/nano-banana", tag="blue")
__result__ = f"✅ Edited and saved to: {result['local_path']}"
```

## Requirements

- `replicate` Python package (install with `pip install replicate`)
- Backend server automatically proxies all Replicate API calls and handles authentication

**Note**: All Replicate API calls are automatically proxied through the backend server. The backend manages the API token securely - you don't need to configure anything.

## Code Execution Method

**ALWAYS use `mcp__code_exec__exec_python` tool** for running Replicate models:

```python
# ✅ CORRECT - Use mcp__code_exec__exec_python tool
# This gives you access to:
# - replicate SDK (import replicate)
# - save_result function (via sys.path setup)
# - All Python stdlib

# ❌ WRONG - Do NOT use bash scripts
# Don't: python3 scripts/edit_image.py ...
# Do: Use exec_python with replicate.run() directly
```

**Setup pattern for ALL exec_python calls**:
```python
import replicate
from pathlib import Path
import sys

sys.path.insert(0, str(Path.cwd() / ".claude/skills/ai_models/scripts"))
from download_replicate_output import download_replicate_output

# Your replicate.run() calls here...
# ⚠️ MANDATORY: ALWAYS call download_replicate_output() after EVERY image/video generation
```

## Important: All Functions are Synchronous

**CRITICAL**: All replicate_tools functions are SYNCHRONOUS and should be called directly (no `await`):

```python
# ✅ CORRECT
models = search_models('image generation')

# ❌ WRONG - Will not work
models = await search_models('image generation')
```

## Common Tasks

### Search for models

Use `search_models` to find models by keyword:

```python
from scripts.search_models import search_models

# Search for image generation models
models = search_models('image generation', limit=10, only_runnable=False)

# Search by specific keywords
models = search_models('video', limit=5, only_runnable=False)
```

### Get model information

Get detailed information about a specific model including input schema:

```python
from scripts.get_model_info import get_model_info

# Get model details and input parameters
info = get_model_info('google/nano-banana')
print(info['openapi_schema'])  # See the full OpenAPI schema
```

### Edit images

**CRITICAL**: Use direct replicate.run() calls for image editing, NOT bash scripts:

```python

import replicate
from pathlib import Path
import sys
import base64
from datetime import datetime


# Add scripts to path for save_result
sys.path.insert(0, str(Path.cwd() / ".claude/skills/ai_models/scripts"))
from download_replicate_output import download_replicate_output

# For PUBLIC URLs - use image_input directly
output = replicate.run(
    "google/nano-banana",
    input={
        "prompt": "woman in elegant blue evening gown, professional photography",
        "image_input": ["https://example.com/img1.png"],  # MUST be publicly accessible URL
        "aspect_ratio": "3:4",
        "output_format": "jpg"
    }
)

# For LOCAL FILES - convert to base64 data URI
def image_to_data_uri(image_path):
    """Convert local image to base64 data URI"""
    with open(image_path, 'rb') as f:
        image_data = f.read()
    b64_data = base64.b64encode(image_data).decode('utf-8')
    # Detect image type from extension
    ext = Path(image_path).suffix.lower()
    mime_type = {'.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png', '.webp': 'webp'}.get(ext, 'jpeg')
    return f"data:image/{mime_type};base64,{b64_data}"

# Example with local file
local_image = "/path/to/local/image.jpg"
data_uri = image_to_data_uri(local_image)
output = replicate.run(
    "google/nano-banana",
    input={
        "prompt": "make the background blue",
        "image_input": [data_uri],  # Use base64 data URI for local files
        "aspect_ratio": "1:1"
    }
)

# Save and display
url = str(output.url) if hasattr(output, 'url') else str(output)
result = download_replicate_output(url, 'google/nano-banana', tag='blue_bg')
__result__ = f"✅ Image edited and saved to: {result['local_path']}"
```

**Key points for image editing**:
- Use `image_input` parameter (list of image sources)
- **For PUBLIC URLs**: Pass URL strings directly (e.g., `["https://example.com/img.jpg"]`)
- **For LOCAL FILES**: Convert to base64 data URI using the `image_to_data_uri()` helper above
- **NEVER use localhost URLs** (e.g., `http://localhost:*`) - they won't work as Replicate API can't access them
- Common params: `prompt`, `image_input`, `aspect_ratio`, `output_format`
- Results auto-saved via save_result()
- For multiple images (style transfer), add more sources to image_input list

### Run a model

Execute a model with specific inputs using the Replicate SDK. Results are automatically saved:

```python

import replicate
from pathlib import Path
import sys


sys.path.insert(0, str(Path.cwd() / ".claude/skills/ai_models/scripts"))
from download_replicate_output import download_replicate_output

# Run image generation model - ALWAYS save outputs
output = replicate.run(
    'google/nano-banana',
    input={
        'prompt': 'a red apple on a wooden table, professional photography',
        'negative_prompt': 'blurry, low quality',
        'num_outputs': 1
    }
)

# ⚠️ MANDATORY: Save immediately (URLs expire in 24h)
url = str(output.url) if hasattr(output, 'url') else str(output)
result = download_replicate_output(url, 'google/nano-banana', tag='apple')
__result__ = f"✅ Generated and saved to: {result['local_path']}"
```

**⚠️ REQUIREMENTS - DO NOT SKIP ⚠️**:
- ALWAYS use `replicate.run()` (synchronous), NEVER `replicate.async_run()`
- **MANDATORY**: MUST call `download_replicate_output()` after EVERY image/video generation
- **URLs expire in 24 hours** - download immediately or lose the file
- Set `__result__` to display local path to user

## Popular Models by Category

### Image Generation
- `black-forest-labs/flux-schnell` - **RECOMMENDED for FAST generation** - Use when speed is priority
- `google/nano-banana` - Fast image generation with Nano Banana
- `black-forest-labs/flux-dev` - Development version of FLUX

### Image Edit
- `google/nano-banana` - **ALWAYS use for QUALITY edits** - Best results for image editing tasks
  - **Use replicate.run() with `image_input` parameter (list of URLs)**
  - See "Edit images" section above for correct usage

### Image to 3D
- `ndreca/hunyuan3d-2.1` - Text to 3D model

### Audio
- `suno-ai/bark` - Text-to-speech with multiple voices
- Various music generation models

## Best Practices

### Always check model info first
Before running a model, get its info to understand required inputs:

```python

import replicate
import json
from pathlib import Path
import sys


sys.path.insert(0, str(Path.cwd() / ".claude/skills/ai_models/scripts"))
from download_replicate_output import download_replicate_output
from get_model_info import get_model_info

# 1. Get model info
info = get_model_info('google/nano-banana')
print("Model input schema:")
print(json.dumps(info['openapi_schema'], indent=2))

# 2. Run with correct inputs
output = replicate.run('google/nano-banana', input={
    'prompt': 'your prompt here'
})

# 3. Save the output (REQUIRED)
url = str(output.url) if hasattr(output, 'url') else str(output)
result = download_replicate_output(url, 'google/nano-banana')

# 4. Display the result
__result__ = f"Generated and saved to: {result['local_path']}"
```

The Replicate SDK will automatically validate inputs and raise errors for unrecognized fields

### Default: Return All Models
By default, `search_models` returns all models including those without versions (default `only_runnable=False`):

```python
# Default - returns all models
models = search_models('3d')

# Filter to only runnable models
models = search_models('3d', only_runnable=True)
```

### View saved results
Results are automatically saved to `results/` directory. Use these functions to access them:

```python
# List all saved results
files = list_results()

# List results for specific model
files = list_results('google/nano-banana')
print(f"Found {len(files)} previous runs")

# Load a saved result
if files:
    result = load_result(files[0])
    print(f"Previous result: {result}")
```

### Handle long-running tasks
replicate.run() blocks until completion. Results are auto-saved:

```python

import replicate
from pathlib import Path
import sys


sys.path.insert(0, str(Path.cwd() / ".claude/skills/ai_models/scripts"))
from download_replicate_output import download_replicate_output

# Run the model (blocks until complete)
output = replicate.run('video-generation-model', input={'input': '...'})

# Save the output (REQUIRED)
url = str(output.url) if hasattr(output, 'url') else str(output)
result = download_replicate_output(url, 'video-generation-model')
__result__ = f"Generated and saved to: {result['local_path']}"
```

## Error Handling

Common errors and solutions:

- **404 Model not found**: Model may not have a published version. Use `only_runnable=True` when searching.
- **Invalid inputs**: Check model's `input_properties` with `get_model_info()`
- **Authentication errors**: Ensure REPLICATE_API_TOKEN is set correctly

## Working with Results

Model outputs vary by model type. Results are auto-saved to data/:

```python

import replicate
from pathlib import Path
import sys


sys.path.insert(0, str(Path.cwd() / ".claude/skills/ai_models/scripts"))
from download_replicate_output import download_replicate_output

# Image generation - ALWAYS save outputs
output = replicate.run('google/nano-banana', input={'prompt': '...'})
url = str(output.url) if hasattr(output, 'url') else str(output)
result = download_replicate_output(url, 'google/nano-banana')
__result__ = f"Saved to: {result['local_path']}"

# Text generation - no need to save, returns text directly
output = replicate.run('meta/llama-2-70b-chat', input={'prompt': '...'})
__result__ = f"Text: {output}"

# Errors are raised as exceptions
try:
    output = replicate.run('model-name', input={...})
    __result__ = output
except Exception as e:
    __result__ = f"Error: {e}"
```

## Available Functions

Helper functions (import from scripts directory):
- `search_models(query, limit=20, only_runnable=False)` - Search for models (default: all models)
- `get_model_info(model)` - Get model details and full OpenAPI schema
- `download_replicate_output(url, model_name, tag="")` - Download and save Replicate outputs (REQUIRED after model runs)
- `list_results(model_name=None)` - List saved results from data/ directory
- `load_result(filepath)` - Load a saved result
- `replicate.run()` - Run models (must manually save outputs with download_replicate_output)

**IMPORTANT**: For running models, always use `replicate.run()` directly. The SDK will validate inputs and raise errors for unrecognized fields.
