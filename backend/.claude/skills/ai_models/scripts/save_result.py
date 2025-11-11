"""Save model outputs to files for persistent artifacts."""
import json
import os
from pathlib import Path
from datetime import datetime
import re


def save_result(result, model_name: str, tag: str = "", auto_download: bool = True) -> str:
    """
    Save model output to a JSON file for later reference.

    IMPORTANT: Replicate URLs expire after 24 hours. This function automatically
    downloads files from Replicate URLs to ensure persistent access.

    Args:
        result: The model execution result (can be dict, list, str, or Replicate FileOutput)
        model_name: The model identifier (e.g., 'google/nano-banana')
        tag: Optional tag for organizing results (e.g., 'test', 'final', 'v2')
        auto_download: If True, automatically download files from Replicate URLs (default: True)

    Returns:
        Path to the saved result file

    Example:
        result = replicate.run('google/nano-banana', {'prompt': 'a dog'})
        filepath = save_result(result, 'google/nano-banana', tag='dog_image')
        print(f"Saved to {filepath}")
    """
    try:
        # Create results directory if it doesn't exist
        results_dir_name = os.environ.get("RESULTS_DIR", "results")
        results_dir = Path.cwd() / results_dir_name
        results_dir.mkdir(exist_ok=True)

        # Create timestamp and filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        clean_model = model_name.replace("/", "_").replace(":", "-")

        if tag:
            filename = f"{clean_model}_{tag}_{timestamp}.json"
        else:
            filename = f"{clean_model}_{timestamp}.json"

        filepath = results_dir / filename

        # Convert result to JSON-serializable format
        serializable_result = _make_serializable(result)

        # Auto-download Replicate URLs if enabled
        downloaded_files = []
        if auto_download:
            urls = _extract_replicate_urls(serializable_result)
            if urls:
                try:
                    from download_replicate_output import download_replicate_outputs
                    downloaded_files = download_replicate_outputs(urls, model_name, tag)
                except ImportError:
                    # download_replicate_output not available, skip
                    pass

        # Save as JSON
        with open(filepath, 'w') as f:
            json.dump({
                "model": model_name,
                "tag": tag,
                "timestamp": timestamp,
                "result": serializable_result,
                "downloaded_files": downloaded_files  # Include local file paths
            }, f, indent=2)

        return str(filepath)
    except Exception as e:
        return f"Error saving result: {str(e)}"


def _extract_replicate_urls(obj) -> list:
    """Extract all Replicate URLs from a result object."""
    urls = []

    def extract_from_value(value):
        if isinstance(value, str):
            # Match Replicate URLs
            if "replicate" in value and value.startswith("http"):
                urls.append(value)
        elif isinstance(value, list):
            for item in value:
                extract_from_value(item)
        elif isinstance(value, dict):
            for v in value.values():
                extract_from_value(v)

    extract_from_value(obj)
    return urls


def _make_serializable(obj):
    """Convert Replicate FileOutput and other objects to JSON-serializable format."""
    # Handle FileOutput from Replicate
    if hasattr(obj, '__class__') and 'FileOutput' in obj.__class__.__name__:
        return str(obj)

    # Handle lists
    if isinstance(obj, list):
        return [_make_serializable(item) for item in obj]

    # Handle dicts
    if isinstance(obj, dict):
        return {key: _make_serializable(value) for key, value in obj.items()}

    # Handle strings, numbers, booleans, None
    if isinstance(obj, (str, int, float, bool, type(None))):
        return obj

    # For other objects, convert to string
    return str(obj)


def list_results(model_name: str = None) -> list:
    """
    List saved results, optionally filtered by model.

    Args:
        model_name: Optional model identifier to filter by

    Returns:
        List of result file paths

    Example:
        files = list_results('google/nano-banana')
        for f in files:
            print(f)
    """
    try:
        results_dir_name = os.environ.get("RESULTS_DIR", "results")
        results_dir = Path.cwd() / results_dir_name

        if not results_dir.exists():
            return []

        files = list(results_dir.glob("*.json"))

        if model_name:
            clean_model = model_name.replace("/", "_").replace(":", "-")
            files = [f for f in files if clean_model in f.name]

        return [str(f) for f in sorted(files, reverse=True)]
    except Exception as e:
        return [f"Error listing results: {str(e)}"]


def load_result(filepath: str) -> dict:
    """
    Load a previously saved result.

    Args:
        filepath: Path to the result file

    Returns:
        The result dictionary

    Example:
        result = load_result("results/stability-ai_sdxl_20240101_120000.json")
        print(result['result']['output'])
    """
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
        return data['result']
    except Exception as e:
        return {"error": f"Could not load result: {str(e)}"}
