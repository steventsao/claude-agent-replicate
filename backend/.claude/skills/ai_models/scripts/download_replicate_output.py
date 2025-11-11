"""Download Replicate outputs and save them locally.

Replicate URLs expire after 24 hours, so we need to download and serve them locally.
This tool handles downloading images/videos/audio from Replicate URLs.
"""
import requests
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse
import os
import json


def download_replicate_output(url: str, model_name: str = "unknown", tag: str = "") -> dict:
    """
    Download a Replicate output file and save it locally.

    Args:
        url: The Replicate URL to download
        model_name: The model identifier (e.g., 'google/nano-banana')
        tag: Optional tag for organizing downloads (e.g., 'blue_edit')

    Returns:
        dict with:
            - local_path: Path to the downloaded file
            - url: Original Replicate URL
            - size_bytes: File size in bytes
            - content_type: MIME type of the file

    Example:
        result = download_replicate_output(
            "https://replicate.delivery/pbxt/xyz.jpg",
            "google/nano-banana",
            tag="blue_gown"
        )
        print(f"Downloaded to {result['local_path']}")
    """
    try:
        # Use storage directory (matches server config)
        storage_dir_name = os.environ.get("STORAGE_DIR", "data")
        storage_dir = Path.cwd() / storage_dir_name
        storage_dir.mkdir(exist_ok=True)
        results_dir = storage_dir  # Keep variable name for compatibility

        # Get file extension from URL
        parsed = urlparse(url)
        path_parts = Path(parsed.path)
        ext = path_parts.suffix if path_parts.suffix else ".bin"

        # Create filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        clean_model = (model_name or "unknown").replace("/", "_").replace(":", "-")

        if tag:
            filename = f"{clean_model}_{tag}_{timestamp}{ext}"
        else:
            filename = f"{clean_model}_{timestamp}{ext}"

        filepath = results_dir / filename

        # Download the file
        response = requests.get(url, stream=True, timeout=60)
        response.raise_for_status()

        # Save to local file
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        # Get file info
        file_size = filepath.stat().st_size
        content_type = response.headers.get('content-type', 'application/octet-stream')

        # Save metadata JSON alongside the image
        metadata = {
            "model": model_name,
            "tag": tag,
            "timestamp": timestamp,
            "original_url": url,
            "local_file": filename,
            "size_bytes": file_size,
            "content_type": content_type
        }

        # Save metadata with _metadata.json suffix
        metadata_filename = filepath.stem + "_metadata.json"
        metadata_filepath = results_dir / metadata_filename

        with open(metadata_filepath, 'w') as f:
            json.dump(metadata, f, indent=2)

        return {
            "local_path": str(filepath),
            "metadata_path": str(metadata_filepath),
            "url": url,
            "size_bytes": file_size,
            "content_type": content_type,
            "filename": filename
        }

    except requests.exceptions.RequestException as e:
        return {
            "error": f"Failed to download: {str(e)}",
            "url": url
        }
    except Exception as e:
        return {
            "error": f"Error downloading file: {str(e)}",
            "url": url
        }


def download_replicate_outputs(urls: list, model_name: str = "unknown", tag: str = "") -> list:
    """
    Download multiple Replicate output files.

    Args:
        urls: List of Replicate URLs to download
        model_name: The model identifier
        tag: Optional tag for organizing downloads

    Returns:
        List of download results (same format as download_replicate_output)

    Example:
        results = download_replicate_outputs(
            ["https://replicate.delivery/pbxt/1.jpg", "https://replicate.delivery/pbxt/2.jpg"],
            "google/nano-banana",
            tag="batch"
        )
        for r in results:
            if "error" not in r:
                print(f"Downloaded {r['filename']}")
    """
    results = []
    for url in urls:
        result = download_replicate_output(url, model_name, tag)
        results.append(result)
    return results
