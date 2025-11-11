"""Space-based storage utilities for Canvas persistence."""
import json
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime


def normalize_space_id(space_name: str) -> str:
    """
    Normalize space name to safe filesystem directory name.
    - Convert to lowercase
    - Replace spaces and special chars with hyphens
    - Remove multiple consecutive hyphens
    """
    # Replace special chars with hyphens
    normalized = re.sub(r'[^a-z0-9]+', '-', space_name.lower())
    # Remove leading/trailing hyphens
    normalized = normalized.strip('-')
    # Replace multiple hyphens with single
    normalized = re.sub(r'-+', '-', normalized)
    return normalized or 'default'


def get_storage_root() -> Path:
    """
    Determine the root directory used for storing runtime artifacts.

    If the `STORAGE_ROOT` environment variable is set (e.g. by the
    Tauri shell), it is treated as an absolute base directory. Otherwise we
    default to the directory alongside this module, matching the previous
    behaviour for CLI usage.
    """
    storage_root = os.environ.get("STORAGE_ROOT")
    if storage_root:
        root_path = Path(storage_root).expanduser()
    else:
        root_path = Path(__file__).parent

    root_path.mkdir(parents=True, exist_ok=True)
    return root_path


def get_storage_dir() -> Path:
    """Resolve the directory where generated assets are written."""
    storage_dir_name = os.environ.get("STORAGE_DIR", "data")
    storage_dir = get_storage_root() / storage_dir_name
    storage_dir.mkdir(parents=True, exist_ok=True)
    return storage_dir


def get_results_root() -> Path:
    """Deprecated: Use get_storage_dir() instead."""
    return get_storage_dir()


def get_spaces_root() -> Path:
    """Get root directory for all spaces."""
    spaces_root = get_storage_dir() / "spaces"
    spaces_root.mkdir(parents=True, exist_ok=True)
    return spaces_root


def get_space_dir(space_id: str) -> Path:
    """Get directory for specific space."""
    spaces_root = get_spaces_root()
    space_dir = spaces_root / normalize_space_id(space_id)
    space_dir.mkdir(parents=True, exist_ok=True)
    return space_dir


def get_canvas_file(space_id: str) -> Path:
    """Get canvas.json file path for space."""
    return get_space_dir(space_id) / "canvas.json"


def save_canvas_state(space_id: str, state: Dict[str, Any]) -> None:
    """
    Save canvas state to space directory.

    Args:
        space_id: Space identifier
        state: Canvas state containing nodes, viewport, etc.
    """
    canvas_file = get_canvas_file(space_id)

    # Add metadata
    state_with_meta = {
        **state,
        "metadata": {
            "space_id": space_id,
            "saved_at": datetime.now().isoformat(),
            "version": "1.0"
        }
    }

    with open(canvas_file, 'w') as f:
        json.dump(state_with_meta, f, indent=2)


def load_canvas_state(space_id: str) -> Optional[Dict[str, Any]]:
    """
    Load canvas state from space directory.

    Args:
        space_id: Space identifier

    Returns:
        Canvas state dict or None if doesn't exist
    """
    canvas_file = get_canvas_file(space_id)

    if not canvas_file.exists():
        return None

    try:
        with open(canvas_file, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error loading canvas state: {e}")
        return None


def list_spaces() -> List[Dict[str, Any]]:
    """
    List all available spaces.

    Returns:
        List of space metadata dicts
    """
    spaces_root = get_spaces_root()
    spaces = []

    for space_dir in spaces_root.iterdir():
        if space_dir.is_dir():
            canvas_file = space_dir / "canvas.json"

            space_info = {
                "id": space_dir.name,
                "name": space_dir.name.replace('-', ' ').title(),
                "has_canvas": canvas_file.exists()
            }

            # Add metadata if canvas exists
            if canvas_file.exists():
                try:
                    with open(canvas_file, 'r') as f:
                        state = json.load(f)
                        metadata = state.get("metadata", {})
                        space_info["saved_at"] = metadata.get("saved_at")
                        space_info["node_count"] = len(state.get("nodes", []))
                except (json.JSONDecodeError, IOError):
                    pass

            spaces.append(space_info)

    # Sort by saved_at descending (most recent first)
    spaces.sort(key=lambda s: s.get("saved_at", ""), reverse=True)
    return spaces


def delete_image_from_space(space_id: str, image_id: str) -> bool:
    """
    Delete an image from a space's canvas state.

    Args:
        space_id: Space identifier
        image_id: Image node ID to remove

    Returns:
        True if deleted, False if space or image doesn't exist
    """
    canvas_file = get_canvas_file(space_id)

    if not canvas_file.exists():
        return False

    try:
        with open(canvas_file, 'r') as f:
            state = json.load(f)

        nodes = state.get('nodes', [])
        original_count = len(nodes)

        # Filter out the image to delete
        state['nodes'] = [node for node in nodes if node.get('id') != image_id]

        if len(state['nodes']) == original_count:
            # Image not found
            return False

        # Update metadata
        if 'metadata' not in state:
            state['metadata'] = {}
        state['metadata']['saved_at'] = datetime.now().isoformat()

        # Save updated state
        with open(canvas_file, 'w') as f:
            json.dump(state, f, indent=2)

        return True

    except (json.JSONDecodeError, IOError) as e:
        print(f"Error deleting image: {e}")
        return False


def delete_space(space_id: str) -> bool:
    """
    Delete a space and all its contents.

    Args:
        space_id: Space identifier

    Returns:
        True if deleted, False if doesn't exist
    """
    space_dir = get_space_dir(space_id)

    if not space_dir.exists():
        return False

    import shutil
    shutil.rmtree(space_dir)
    return True
