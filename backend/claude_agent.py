"""
Claude Agent with Replicate using code execution pattern.
Implements the MCP + code execution approach from Anthropic's insight article.

This allows Claude to:
1. Discover tools progressively via filesystem
2. Execute complex control flow in code
3. Filter/transform data before returning to context
4. Build reusable skills
"""

import asyncio
import os
import json
import re
from pathlib import Path
from datetime import datetime
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, tool, create_sdk_mcp_server
from langfuse import observe, get_client


# AI Models tools directory (formerly replicate)
TOOLS_SCRIPTS_DIR = Path(__file__).parent / ".claude" / "skills" / "ai_models" / "scripts"

# Project root for file system access control
PROJECT_ROOT = Path(__file__).parent.parent.resolve()


# Track which models have had get_model_info called in the session
# Format: set of "owner/name" model identifiers
_model_info_history = set()

# Track last executed model for auto-save hook
_last_model_execution = {
    "model": None,
    "prompt": None
}


# File system exploration tools
@tool(
    "exec_python",
    "Execute Python code in a sandboxed environment with access to AI/ML model tools. File system access is restricted to the project directory only.",
    {
        "code": str,
    }
)
@observe(name="exec_python_tool")
async def exec_python(args):
    """Execute Python code with AI/ML model tools available."""
    try:
        code = args["code"]

        # Create restricted Path class that only allows project directory access
        class RestrictedPath:
            """Path wrapper that restricts access to project directory."""
            def __init__(self, *args):
                self._path = Path(*args).resolve()
                # Check if path is within project root
                try:
                    self._path.relative_to(PROJECT_ROOT)
                except ValueError:
                    raise PermissionError(f"Access denied: Path '{self._path}' is outside project directory")

            def __truediv__(self, other):
                return RestrictedPath(self._path / other)

            def __str__(self):
                return str(self._path)

            def __repr__(self):
                return f"RestrictedPath('{self._path}')"

            def __getattr__(self, name):
                return getattr(self._path, name)

        # Restricted os.listdir that only allows project directory
        original_listdir = os.listdir
        def restricted_listdir(path='.'):
            abs_path = Path(path).resolve()
            try:
                abs_path.relative_to(PROJECT_ROOT)
                return original_listdir(path)
            except ValueError:
                raise PermissionError(f"Access denied: Cannot list '{abs_path}' - outside project directory")

        # Create a namespace with basic tools - Claude discovers and imports scripts via Skills
        import sys
        sys.path.insert(0, str(TOOLS_SCRIPTS_DIR))

        namespace = {
            "__builtins__": __builtins__,
            "replicate": __import__("replicate"),
            "os": type('os', (), {
                'listdir': restricted_listdir,
                'path': os.path,
                'environ': os.environ,
                'getcwd': os.getcwd,
            })(),
            "json": json,
            "asyncio": asyncio,
            "Path": RestrictedPath,
            "sys": sys,
        }

        # Track replicate.run calls for auto-save hook
        # Extract model and prompt from code if present
        replicate_run_pattern = r'replicate\.run\([\'"]([^\'\"]+)[\'"],\s*input\s*=\s*\{[^}]*[\'"]prompt[\'"]:\s*[\'"]([^\'\"]+)[\'"]'
        match = re.search(replicate_run_pattern, code)
        if match:
            _last_model_execution["model"] = match.group(1)
            _last_model_execution["prompt"] = match.group(2)

        # Execute code with proper async support
        # Compile and execute the code
        try:
            # Check if code contains await - if so, wrap in async function
            if "await " in code:
                # Wrap in async function
                wrapped_code = f"""
async def __async_exec():
{chr(10).join('    ' + line for line in code.split(chr(10)))}
    return locals().get('__result__', 'Code executed successfully')

__result__ = await __async_exec()
"""
                exec(compile(wrapped_code, "<string>", "exec"), namespace)
                # Get the coroutine and await it
                if asyncio.iscoroutine(namespace.get("__result__")):
                    result = await namespace["__result__"]
                else:
                    result = namespace.get("__result__", "Code executed successfully")
            else:
                # Regular sync code
                exec(code, namespace)
                result = namespace.get("__result__", "Code executed successfully")

            return {
                "content": [{
                    "type": "text",
                    "text": str(result)
                }]
            }
        except SyntaxError as e:
            return {
                "content": [{
                    "type": "text",
                    "text": f"Syntax error in code: {str(e)}"
                }],
                "is_error": True
            }

    except Exception as e:
        return {
            "content": [{
                "type": "text",
                "text": f"Error executing code: {str(e)}"
            }],
            "is_error": True
        }


@tool(
    "read_file",
    "Read a file from the skills directory to understand tool APIs.",
    {
        "path": str,
    }
)
@observe(name="read_file_tool")
async def read_file(args):
    """Read a tool file to understand its API."""
    try:
        path = args["path"]
        file_path = TOOLS_SCRIPTS_DIR / path

        if not file_path.exists():
            return {
                "content": [{
                    "type": "text",
                    "text": f"File not found: {path}"
                }],
                "is_error": True
            }

        content = file_path.read_text()

        return {
            "content": [{
                "type": "text",
                "text": f"File: {path}\n\n{content}"
            }]
        }
    except Exception as e:
        return {
            "content": [{
                "type": "text",
                "text": f"Error reading file: {str(e)}"
            }],
            "is_error": True
        }


@tool(
    "list_tools",
    "List available tools in the skills directory.",
    {}
)
@observe(name="list_tools_tool")
async def list_tools(args):
    """List available AI/ML model tools."""
    try:
        files = [f.name for f in TOOLS_SCRIPTS_DIR.iterdir() if f.suffix == ".py" and f.name != "__init__.py"]

        return {
            "content": [{
                "type": "text",
                "text": f"Available tools:\n" + "\n".join(f"- {f}" for f in files)
            }]
        }
    except Exception as e:
        return {
            "content": [{
                "type": "text",
                "text": f"Error listing tools: {str(e)}"
            }],
            "is_error": True
        }


# PostToolUse hook removed - files are now downloaded directly in code via download_replicate_output()


# Create the SDK MCP server
code_exec_server = create_sdk_mcp_server(
    name="code_exec",
    version="1.0.0",
    tools=[
        exec_python,
        read_file,
        list_tools,
    ]
)


def build_system_prompt() -> str:
    """Build system prompt including skill documentation."""
    skill_md = TOOLS_SCRIPTS_DIR.parent / "SKILL.md"

    base_prompt = """You are an AI assistant with code execution capabilities and access to AI/ML models via the ai_models Skill.

**CRITICAL - Tool Usage Rules**:
- BEFORE responding to requests about images, videos, ML models, or AI generation, you MUST check if the ai_models Skill can help
- When users mention keywords like: "generate", "create image", "edit photo", "run model", "AI model", "video", "FLUX", "Nano Banana" → Use the ai_models Skill tool
- ALWAYS prefer using the ai_models Skill over saying "I cannot do that"
- DO NOT assume you lack image/video generation capabilities - check the ai_models Skill first

**Available Specialized Capabilities (via ai_models Skill)**:
- Generate/edit images using FLUX, Nano Banana, and other models
- Create videos and audio
- Run any ML model on Replicate's infrastructure
- Text-to-speech and audio generation

## Code Execution Pattern
Use the exec_python tool to run Python code with access to:
- Replicate SDK: `replicate.run()` for running models (synchronous)
- Standard Python libraries (os, json, Path, sys)

## Progressive Discovery with Skills
Helper scripts are available in the Skills directory. To use them:
1. Use the Skill tool to invoke ai_models Skill when users request image/video/ML tasks
2. OR import them dynamically in your Python code:
   ```python
   from list_models import list_models
   from search_models import search_models
   from get_model_info import get_model_info
   ```

The scripts directory is already in sys.path, so you can import directly.

## Model Execution
When running Replicate models:
1. Use `replicate.run()` (synchronous) - NEVER `replicate.async_run()` or await
2. Files are AUTOMATICALLY downloaded via PostToolUse hook
3. Set __result__ to display the output URL to the user

**Pattern for model runs:**
```python
import replicate

# Run model synchronously - this BLOCKS until the job completes
output = replicate.run('black-forest-labs/flux-schnell', input={'prompt': 'your prompt'})

# CRITICAL: Convert FileOutput objects to URL strings
if isinstance(output, list):
    urls = []
    for item in output:
        if hasattr(item, 'url'):
            urls.append(item.url)  # Extract .url attribute
        else:
            urls.append(str(item))
else:
    urls = [output.url if hasattr(output, 'url') else str(output)]

# Download the files to local storage
from download_replicate_output import download_replicate_outputs
downloaded = download_replicate_outputs(urls, 'black-forest-labs/flux-schnell', 'your-tag')

# Extract local file paths from download results
local_files = []
for result in downloaded:
    if 'error' not in result:
        local_files.append(result['local_path'])
    else:
        print(f"Download error: {result['error']}")

# Set result to show downloaded file paths (UI will auto-detect these paths)
__result__ = f"Downloaded to: {', '.join(local_files)}"
```

**CRITICAL - Auto-downloads:**
- All Replicate outputs are AUTOMATICALLY downloaded to `data/` directory
- A PostToolUse hook detects Replicate URLs and downloads them deterministically
- You do NOT need to call save_result() - downloads happen automatically

"""

    # Load skill documentation if it exists
    if skill_md.exists():
        skill_content = skill_md.read_text()
        # Remove YAML frontmatter
        if skill_content.startswith('---'):
            parts = skill_content.split('---', 2)
            if len(parts) >= 3:
                skill_content = parts[2].strip()

        base_prompt += "\n---\n# Replicate Skill Documentation\n\n"
        base_prompt += skill_content

    return base_prompt


@observe(name="run_agent_query")
async def run_agent_query(query: str) -> str:
    """
    Run a single query through the agent and return the response as a string.
    Used for programmatic access like web UI.
    """
    # Check for API keys
    if not os.environ.get("REPLICATE_API_TOKEN"):
        return "Error: REPLICATE_API_TOKEN not set"

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

    # Run query and collect response
    response_parts = []

    async with ClaudeSDKClient(options=options) as client:
        await client.query(query)

        async for msg in client.receive_response():
            from claude_agent_sdk.types import (
                AssistantMessage, TextBlock, ToolUseBlock, ToolResultBlock,
                ThinkingBlock, ResultMessage, SystemMessage
            )

            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        response_parts.append(block.text)
                    elif isinstance(block, ToolUseBlock):
                        response_parts.append(f"\n[Using tool: {block.name}]\n")
                    elif isinstance(block, ToolResultBlock):
                        if not block.is_error:
                            # Extract text from content
                            if isinstance(block.content, list):
                                for item in block.content:
                                    if isinstance(item, dict) and item.get("type") == "text":
                                        text = item.get("text", "")
                                        if text:
                                            response_parts.append(f"\n{text}\n")

    return "".join(response_parts) if response_parts else "No response generated"


async def main():
    """Run the Claude agent with code execution for Replicate."""

    # Check for API keys
    # ANTHROPIC_API_KEY is optional if using authenticated Claude desktop instance
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ℹ️  ANTHROPIC_API_KEY not set (assuming authenticated Claude desktop instance)")

    if not os.environ.get("REPLICATE_API_TOKEN"):
        print("Error: REPLICATE_API_TOKEN not set")
        return

    # Configure agent options with Skills and code execution
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

    # Start interactive session
    async with ClaudeSDKClient(options=options) as client:
        print("\nClaude Agent with Replicate (code execution mode) started!")
        print("Type 'quit' to exit, Ctrl+C to interrupt\n")

        while True:
            try:
                user_input = input("You: ").strip()

                if user_input.lower() in ["quit", "exit"]:
                    break

                if not user_input:
                    continue

                # Send query
                await client.query(user_input)
            except KeyboardInterrupt:
                print("\n\n[Interrupted by user]")
                # TODO: Send interrupt to SDK if task is running
                # For now, just continue to next prompt
                print()
                continue
            except EOFError:
                print("\n[EOF received, exiting]")
                break

            # Receive and print response
            print("Claude: ", end="", flush=True)
            first_text = True

            async for msg in client.receive_response():
                from claude_agent_sdk.types import (
                    AssistantMessage, TextBlock, ToolUseBlock, ToolResultBlock,
                    ThinkingBlock, ResultMessage, SystemMessage
                )

                if isinstance(msg, SystemMessage):
                    print(f"\n[System: {msg.subtype}]", flush=True)

                elif isinstance(msg, AssistantMessage):
                    for block in msg.content:
                        if isinstance(block, TextBlock):
                            if first_text:
                                first_text = False
                            print(block.text, end="", flush=True)

                        elif isinstance(block, ThinkingBlock):
                            print(f"\n[Thinking: {block.thinking[:100]}...]", flush=True)

                        elif isinstance(block, ToolUseBlock):
                            print(f"\n[Tool Call: {block.name}]", flush=True)
                            print(f"  Input: {block.input}", flush=True)

                        elif isinstance(block, ToolResultBlock):
                            content_str = str(block.content) if block.content else ""
                            content_preview = content_str[:200]

                            # Log full result to file
                            log_dir = Path.cwd() / "logs"
                            log_dir.mkdir(exist_ok=True)
                            log_file = log_dir / f"tool_results_{datetime.now().strftime('%Y%m%d')}.log"

                            with open(log_file, 'a') as f:
                                f.write(f"\n{'='*80}\n")
                                f.write(f"[{datetime.now().isoformat()}] Tool Result\n")
                                f.write(f"Status: {'ERROR' if block.is_error else 'SUCCESS'}\n")
                                f.write(f"Content:\n{content_str}\n")
                                f.write(f"{'='*80}\n")

                            # Print to console
                            print(f"\n[Tool Result: {'Error' if block.is_error else 'Success'}]", flush=True)
                            if content_preview:
                                print(f"  {content_preview}...", flush=True)

                            # Print full result if it's an error or short
                            if block.is_error or len(content_str) < 500:
                                print(f"  Full output:\n{content_str}", flush=True)
                            else:
                                print(f"  (Full output logged to {log_file})", flush=True)

                elif isinstance(msg, ResultMessage):
                    print(f"\n[Cost: ${msg.total_cost_usd:.4f}, Duration: {msg.duration_ms}ms]", end="", flush=True)

            print("\n")


if __name__ == "__main__":
    asyncio.run(main())
