#!/usr/bin/env python3
"""
Simple web server with WebSocket support for Claude Agent with Replicate.
"""
import asyncio
import json
import os
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
import threading
import websockets
from dotenv import load_dotenv
from langfuse import observe, get_client


def _resolve_storage_root() -> Path:
    """Determine writable directory for generated artifacts."""
    storage_root = os.environ.get("STORAGE_ROOT")
    if storage_root:
        return Path(storage_root).expanduser()
    # Use project root (parent of backend/) to match where download_replicate_output.py saves files
    return Path(__file__).parent.parent


STORAGE_DIR_NAME = os.environ.get("STORAGE_DIR", "data")
STORAGE_ROOT = _resolve_storage_root()

try:
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
except Exception as exc:
    print(f"Warning: unable to ensure storage root {STORAGE_ROOT}: {exc}")

STORAGE_DIR_PATH = STORAGE_ROOT / STORAGE_DIR_NAME
try:
    STORAGE_DIR_PATH.mkdir(parents=True, exist_ok=True)
except Exception as exc:
    print(f"Warning: unable to ensure storage directory {STORAGE_DIR_PATH}: {exc}")

# Load environment variables
load_dotenv()

# Initialize Langfuse client
try:
    langfuse_client = get_client()
    print("Langfuse tracing initialized")
except Exception as e:
    print(f"Warning: Langfuse initialization failed: {e}")
    langfuse_client = None

# Store active WebSocket connections and their associated Claude clients
active_connections = {}  # websocket -> client_info dict

class CORSHTTPRequestHandler(SimpleHTTPRequestHandler):
    """HTTP handler with CORS support."""

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        """Handle POST requests."""
        if self.path == '/api/upload':
            self._handle_upload()
        elif self.path == '/api/spaces/save':
            self._handle_save_canvas()
        elif self.path == '/api/spaces/delete-image':
            self._handle_delete_image()
        elif self.path == '/api/spaces/delete':
            self._handle_delete_space()
        elif self.path == '/api/spaces/move-image':
            self._handle_move_image()
        else:
            self.send_error(404)

    def _handle_upload(self):
        """Handle file uploads."""
        import cgi
        import shutil
        from datetime import datetime

        # Parse multipart form data
        content_type = self.headers['content-type']
        if not content_type or not content_type.startswith('multipart/form-data'):
            self.send_error(400, 'Content-Type must be multipart/form-data')
            return

        # Use results directory for agent access
        try:
            # Parse the form data
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST'}
            )

            if 'file' not in form:
                self.send_error(400, 'No file uploaded')
                return

            file_item = form['file']
            if not file_item.file:
                self.send_error(400, 'Invalid file')
                return

            # Generate filename with timestamp
            original_name = file_item.filename
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            name_without_ext = Path(original_name).stem
            ext = Path(original_name).suffix
            unique_name = f"uploaded_{name_without_ext}_{timestamp}{ext}"
            file_path = STORAGE_DIR_PATH / unique_name

            # Save the file
            with open(file_path, 'wb') as f:
                shutil.copyfileobj(file_item.file, f)

            # Return both URL (for display) and path (for agent)
            file_url = f"http://localhost:{self.server.server_port}/{STORAGE_DIR_NAME}/{unique_name}"
            relative_path = f"{STORAGE_DIR_NAME}/{unique_name}"

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'url': file_url,
                'path': relative_path,
                'filename': original_name
            }).encode())

        except Exception as e:
            self.send_error(500, f'Upload failed: {str(e)}')

    def _handle_save_canvas(self):
        """Handle canvas state save."""
        from storage_utils import save_canvas_state

        try:
            content_length = int(self.headers.get('content-length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            space_id = data.get('space_id', 'default')
            canvas_state = data.get('state', {})

            save_canvas_state(space_id, canvas_state)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'space_id': space_id
            }).encode())

        except Exception as e:
            self.send_error(500, f'Save failed: {str(e)}')

    def _handle_delete_image(self):
        """Handle image deletion from a space."""
        from storage_utils import delete_image_from_space

        try:
            content_length = int(self.headers.get('content-length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            space_id = data.get('space_id', 'default')
            image_id = data.get('image_id')

            if not image_id:
                self.send_error(400, 'Missing image_id')
                return

            delete_image_from_space(space_id, image_id)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'space_id': space_id,
                'image_id': image_id
            }).encode())

        except Exception as e:
            self.send_error(500, f'Delete failed: {str(e)}')

    def _handle_delete_space(self):
        """Handle space deletion."""
        from storage_utils import delete_space

        try:
            content_length = int(self.headers.get('content-length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            space_id = data.get('space_id')

            if not space_id:
                self.send_error(400, 'Missing space_id')
                return

            success = delete_space(space_id)

            if not success:
                self.send_error(404, f'Space not found: {space_id}')
                return

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'space_id': space_id
            }).encode())

        except Exception as e:
            self.send_error(500, f'Delete failed: {str(e)}')

    def _handle_move_image(self):
        """Handle moving an image to a space."""
        from storage_utils import move_image_to_space

        try:
            content_length = int(self.headers.get('content-length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            source_path = data.get('source_path')
            space_id = data.get('space_id')

            if not source_path or not space_id:
                self.send_error(400, 'Missing source_path or space_id')
                return

            new_path = move_image_to_space(source_path, space_id)

            if not new_path:
                self.send_error(404, f'Source file not found: {source_path}')
                return

            # Build new URL
            new_url = f"http://localhost:{self.server.server_port}/{new_path}"

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': True,
                'new_url': new_url,
                'new_path': new_path
            }).encode())

        except Exception as e:
            self.send_error(500, f'Move failed: {str(e)}')

    def do_GET(self):
        """Handle GET requests."""
        # API routes
        if self.path == '/api/spaces':
            self._handle_list_spaces()
            return
        elif self.path.startswith('/api/spaces/load/'):
            space_id = self.path.split('/api/spaces/load/')[-1]
            self._handle_load_canvas(space_id)
            return

        # Static file routes
        if self.path == '/' or self.path == '/index.html':
            self.path = '/frontend/index.html'
        elif self.path.startswith('/frontend/'):
            pass  # Allow access to frontend files
        elif self.path.startswith(f'/{STORAGE_DIR_NAME}/'):
            pass  # Allow access to results files (generated + uploaded + downloaded)
        else:
            self.send_error(404)
            return

        # Serve the file
        return super().do_GET()

    def _handle_list_spaces(self):
        """Handle list spaces request."""
        from storage_utils import list_spaces

        try:
            spaces = list_spaces()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(spaces).encode())

        except Exception as e:
            self.send_error(500, f'Failed to list spaces: {str(e)}')

    def _handle_load_canvas(self, space_id):
        """Handle load canvas request."""
        from storage_utils import load_canvas_state

        try:
            state = load_canvas_state(space_id)

            if state is None:
                self.send_error(404, f'Space not found: {space_id}')
                return

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(state).encode())

        except Exception as e:
            self.send_error(500, f'Failed to load canvas: {str(e)}')

    def translate_path(self, path):
        """Translate URL path to local file path."""
        from urllib.parse import unquote

        # Get the directory where this script is located
        root = Path(__file__).parent

        # Decode URL encoding (e.g., %20 -> space)
        path = unquote(path)

        # Route generated assets to the configured results directory
        prefix = f'/{STORAGE_DIR_NAME}/'
        if path.startswith(prefix):
            relative_part = path[len(prefix):]
            candidate = Path(relative_part)
            target = (STORAGE_DIR_PATH / candidate).resolve()
            try:
                target.relative_to(STORAGE_DIR_PATH.resolve())
            except ValueError:
                return str(STORAGE_DIR_PATH)
            return str(target)

        # Remove leading slash and join with root
        path = path.lstrip('/')
        return str(root / path)


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handle requests in separate threads."""
    daemon_threads = True


async def handle_websocket(websocket):
    """Handle WebSocket connections for agent chat."""
    # Import Claude SDK client
    from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
    from claude_agent import code_exec_server, build_system_prompt

    # Hook removed - files are now downloaded directly in code via download_replicate_output()

    # Configure agent options with Skills support
    options = ClaudeAgentOptions(
        mcp_servers={"code_exec": code_exec_server},
        cwd=str(Path(__file__).parent),  # Backend directory with .claude/skills/
        setting_sources=["project"],  # Load Skills from .claude/skills/
        allowed_tools=[
            "Skill",  # Enable Skills for progressive discovery
            "mcp__code_exec__exec_python",
            "mcp__code_exec__read_file",
            "mcp__code_exec__list_tools",
        ],
        model=os.environ.get("CLAUDE_MODEL", "claude-haiku-4-5-20251001"),
        system_prompt=build_system_prompt()
    )

    # Create persistent client for this connection
    client = ClaudeSDKClient(options=options)
    await client.__aenter__()

    # Store client info
    active_connections[websocket] = {
        'client': client,
        'connected_at': asyncio.get_event_loop().time()
    }

    print(f"Client connected. Total connections: {len(active_connections)}")

    try:
        async for message in websocket:
            try:
                data = json.loads(message)

                if data.get('type') == 'ping':
                    await websocket.send(json.dumps({'type': 'pong'}))
                    continue

                if data.get('type') == 'clear':
                    # Clear conversation by creating new client
                    await client.__aexit__(None, None, None)
                    client = ClaudeSDKClient(options=options)
                    await client.__aenter__()
                    active_connections[websocket]['client'] = client

                    await websocket.send(json.dumps({
                        'type': 'system',
                        'content': 'Conversation cleared'
                    }))
                    continue

                if data.get('type') == 'chat':
                    user_message = data.get('message', '')

                    # Check for keywords that suggest ai_models skill usage
                    trigger_keywords = ['image', 'generate', 'edit', 'model', 'flux', 'replicate',
                                       'video', 'photo', 'picture', 'create', 'make', 'draw', 'ai',
                                       'banana', 'ml', 'audio', 'speech']

                    # Inject reminder if keywords detected
                    message_lower = user_message.lower()
                    if any(keyword in message_lower for keyword in trigger_keywords):
                        # Prepend formatted reminder to user message (following claude-code-infrastructure-showcase pattern)
                        reminder = """━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 SKILL ACTIVATION CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ CRITICAL: User message contains AI/ML keywords
  → Check your ai_models Skill tool BEFORE responding
  → This tool can generate/edit images, create videos, and run ML models

ACTION: Use Skill tool to discover available AI/ML capabilities
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"""
                        user_message = reminder + user_message

                    # Run agent with persistent client
                    asyncio.create_task(
                        run_agent_with_client(user_message, websocket, client)
                    )

            except json.JSONDecodeError:
                await websocket.send(json.dumps({
                    'type': 'error',
                    'content': 'Invalid JSON message'
                }))
            except Exception as e:
                await websocket.send(json.dumps({
                    'type': 'error',
                    'content': f'Error: {str(e)}'
                }))

    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")
    finally:
        # Cleanup client
        if websocket in active_connections:
            client = active_connections[websocket]['client']
            await client.__aexit__(None, None, None)
            del active_connections[websocket]
        print(f"Client removed. Total connections: {len(active_connections)}")


@observe(name="run_agent_with_client")
async def run_agent_with_client(query: str, websocket, client):
    """Run the agent using persistent client and stream responses to websocket."""
    try:
        from claude_agent_sdk.types import (
            AssistantMessage, TextBlock, ToolUseBlock, ToolResultBlock,
            ThinkingBlock, ResultMessage, SystemMessage
        )

        # Send query to agent
        await client.query(query)

        # Stream responses
        response_parts = []

        async for msg in client.receive_response():
            if isinstance(msg, SystemMessage):
                await websocket.send(json.dumps({
                    'type': 'system',
                    'content': f'[System: {msg.subtype}]'
                }))

            elif isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        response_parts.append(block.text)
                        # Stream text as it comes
                        await websocket.send(json.dumps({
                            'type': 'agent',
                            'content': block.text
                        }))

                        # Check text blocks for image paths and emit image_downloaded events
                        import re
                        storage_dir_name = os.environ.get("STORAGE_DIR", "data")
                        path_pattern = rf'(/[^\s]+/{storage_dir_name}/[^\s]+\.(?:jpg|jpeg|png|gif|webp|mp4|wav|mp3))'
                        paths = re.findall(path_pattern, block.text, re.IGNORECASE)

                        if paths:
                            urls = [f"http://localhost:8080/{storage_dir_name}/{Path(p).name}" for p in paths]
                            await websocket.send(json.dumps({
                                'type': 'image_downloaded',
                                'urls': urls
                            }))

                    elif isinstance(block, ToolUseBlock):
                        # Send structured tool use block
                        await websocket.send(json.dumps({
                            'type': 'tool_use',
                            'block': {
                                'type': 'tool_use',
                                'id': block.id,
                                'name': block.name,
                                'input': block.input
                            }
                        }))

                    elif isinstance(block, ToolResultBlock):
                        # Send structured tool result block
                        result_content = ""
                        if isinstance(block.content, list):
                            # Extract text from content list
                            for item in block.content:
                                if isinstance(item, dict) and item.get("type") == "text":
                                    result_content += item.get("text", "")
                        elif isinstance(block.content, str):
                            result_content = block.content

                        await websocket.send(json.dumps({
                            'type': 'tool_result',
                            'block': {
                                'type': 'tool_result',
                                'tool_use_id': block.tool_use_id,
                                'content': result_content,
                                'is_error': block.is_error
                            }
                        }))

            elif isinstance(msg, ResultMessage):
                # Flush Langfuse traces at end of conversation turn
                if langfuse_client:
                    langfuse_client.flush()
                await websocket.send(json.dumps({
                    'type': 'cost',
                    'content': f'Cost: ${msg.total_cost_usd:.4f}, Duration: {msg.duration_ms}ms'
                }))

        # After response completes, scan data/ directory for new files
        # This catches any files created during exec_python execution
        import time
        storage_dir_name = os.environ.get("STORAGE_DIR", "data")
        storage_dir = STORAGE_DIR_PATH

        if storage_dir.exists():
            # Find files created in the last 30 seconds (covers the entire request)
            now = time.time()
            new_files = []

            for file_path in storage_dir.iterdir():
                if file_path.is_file() and not file_path.name.endswith('_metadata.json'):
                    # Check if it's an image/video/audio file
                    ext = file_path.suffix.lower()
                    if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.wav', '.mp3']:
                        # Check if created recently
                        mtime = file_path.stat().st_mtime
                        if (now - mtime) < 30:  # Created in last 30 seconds
                            new_files.append(file_path.name)

            if new_files:
                urls = [f"http://localhost:8080/{storage_dir_name}/{filename}" for filename in new_files]
                await websocket.send(json.dumps({
                    'type': 'image_downloaded',
                    'urls': urls
                }))

        # Send done signal
        await websocket.send(json.dumps({
            'type': 'done'
        }))

    except Exception as e:
        import traceback
        error_msg = f'Agent error: {str(e)}\n{traceback.format_exc()}'
        print(error_msg)
        await websocket.send(json.dumps({
            'type': 'error',
            'content': f'Agent error: {str(e)}'
        }))


async def start_websocket_server(ws_port=8866):
    """Start WebSocket server."""
    print(f"Starting WebSocket server on ws://localhost:{ws_port}")
    async with websockets.serve(handle_websocket, "localhost", ws_port):
        await asyncio.Future()  # Run forever


def start_http_server(http_port=8080):
    """Start HTTP server."""
    server = ThreadedHTTPServer(('localhost', http_port), CORSHTTPRequestHandler)
    print(f"Starting HTTP server on http://localhost:{http_port}")
    server.serve_forever()


def main():
    """Start both HTTP and WebSocket servers."""
    print("Claude Agent with Replicate - Web UI")
    print("=" * 50)
    print(f"Results directory: {STORAGE_DIR_PATH}")

    # Check API keys
    if not os.environ.get("REPLICATE_API_TOKEN"):
        print("Error: REPLICATE_API_TOKEN not set")
        return

    # Get ports from environment or use defaults
    http_port = int(os.environ.get("HTTP_PORT", "8080"))
    ws_port = int(os.environ.get("WS_PORT", "8866"))

    # Start HTTP server in a thread
    http_thread = threading.Thread(target=start_http_server, args=(http_port,), daemon=True)
    http_thread.start()

    print(f"\n\nOpen http://localhost:{http_port} in your browser")
    print(f"WebSocket: ws://localhost:{ws_port}\n")

    # Start WebSocket server
    try:
        asyncio.run(start_websocket_server(ws_port))
    except KeyboardInterrupt:
        print("\nShutting down servers...")


if __name__ == "__main__":
    main()
