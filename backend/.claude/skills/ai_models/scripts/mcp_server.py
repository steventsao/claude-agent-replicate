#!/usr/bin/env python3
"""MCP server that exposes AI/ML model scripts as tools."""
import sys
import json
import asyncio
from pathlib import Path

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent))

from search_models import search_models
from get_model_info import get_model_info
from save_result import save_result, list_results, load_result


class MCPServer:
    """Simple MCP server for AI/ML model tools (powered by Replicate)."""

    def __init__(self):
        self.tools = {
            "search_models": {
                "description": "Search for Replicate models by keyword",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"},
                        "limit": {"type": "integer", "description": "Max results", "default": 20},
                        "only_runnable": {"type": "boolean", "description": "Only models with versions", "default": False}
                    },
                    "required": ["query"]
                }
            },
            "get_model_info": {
                "description": "Get detailed information about a Replicate model",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "model": {"type": "string", "description": "Model identifier (e.g., 'google/nano-banana')"}
                    },
                    "required": ["model"]
                }
            },
            "save_result": {
                "description": "Save model execution result to JSON file",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "result": {"type": "object", "description": "Result to save"},
                        "model_name": {"type": "string", "description": "Model identifier"},
                        "tag": {"type": "string", "description": "Optional tag", "default": ""}
                    },
                    "required": ["result", "model_name"]
                }
            },
            "list_results": {
                "description": "List saved result files",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "model_name": {"type": "string", "description": "Optional model filter"}
                    }
                }
            },
            "load_result": {
                "description": "Load a saved result file",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "filepath": {"type": "string", "description": "Path to result file"}
                    },
                    "required": ["filepath"]
                }
            }
        }

    async def handle_message(self, message):
        """Handle incoming MCP message."""
        msg_id = message.get("id")
        method = message.get("method")
        params = message.get("params", {})

        if method == "initialize":
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": "replicate-scripts",
                        "version": "1.0.0"
                    }
                }
            }

        elif method == "tools/list":
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "tools": [
                        {
                            "name": name,
                            "description": info["description"],
                            "inputSchema": info["inputSchema"]
                        }
                        for name, info in self.tools.items()
                    ]
                }
            }

        elif method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})

            try:
                result = await self.call_tool(tool_name, arguments)
                return {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "content": [
                            {
                                "type": "text",
                                "text": json.dumps(result, indent=2)
                            }
                        ]
                    }
                }
            except Exception as e:
                return {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "error": {
                        "code": -32000,
                        "message": str(e)
                    }
                }

        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "error": {
                "code": -32601,
                "message": f"Method not found: {method}"
            }
        }

    async def call_tool(self, tool_name, arguments):
        """Execute a tool with given arguments."""
        if tool_name == "search_models":
            return search_models(
                arguments["query"],
                arguments.get("limit", 20),
                arguments.get("only_runnable", False)
            )
        elif tool_name == "get_model_info":
            return get_model_info(arguments["model"])
        elif tool_name == "save_result":
            filepath = save_result(
                arguments["result"],
                arguments["model_name"],
                arguments.get("tag", "")
            )
            return {"filepath": filepath}
        elif tool_name == "list_results":
            return {"files": list_results(arguments.get("model_name"))}
        elif tool_name == "load_result":
            return load_result(arguments["filepath"])
        else:
            raise ValueError(f"Unknown tool: {tool_name}")

    async def run(self):
        """Run the MCP server."""
        while True:
            try:
                line = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
                if not line:
                    break

                message = json.loads(line.strip())
                response = await self.handle_message(message)
                print(json.dumps(response), flush=True)

            except json.JSONDecodeError:
                continue
            except Exception as e:
                print(json.dumps({
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32700,
                        "message": f"Parse error: {str(e)}"
                    }
                }), flush=True)


if __name__ == "__main__":
    server = MCPServer()
    asyncio.run(server.run())
