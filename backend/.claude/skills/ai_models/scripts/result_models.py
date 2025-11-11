"""Pydantic models for Replicate result files."""
from pydantic import BaseModel, Field, field_validator
from pathlib import Path
from typing import Optional, Union, Any


class ReplicateResultMetadata(BaseModel):
    """Model for result JSON files containing metadata and URLs."""
    model: str
    tag: str = ""
    timestamp: str
    result: Union[str, list, dict]  # Can be URL string, list of URLs, or nested dict

    def get_image_url(self) -> Optional[str]:
        """Extract the primary image URL from result field."""
        if isinstance(self.result, str):
            return self.result
        elif isinstance(self.result, list) and len(self.result) > 0:
            return self.result[0]
        elif isinstance(self.result, dict):
            # Handle nested structures like {"output": "url"}
            if "output" in self.result:
                output = self.result["output"]
                if isinstance(output, str):
                    return output
                elif isinstance(output, list) and len(output) > 0:
                    return output[0]
        return None


class DownloadedImageMetadata(BaseModel):
    """Model for downloaded image metadata JSON files."""
    model: str
    tag: str = ""
    timestamp: str
    original_url: str
    local_file: str  # Filename of the actual image
    size_bytes: int
    content_type: str

    def get_local_image_path(self, results_dir: Path) -> Path:
        """Get the full path to the downloaded image file."""
        return results_dir / self.local_file


class ResultFile(BaseModel):
    """Unified model that can represent either type of result file."""
    file_path: Path

    @property
    def is_metadata_json(self) -> bool:
        """Check if this is a metadata JSON file (ends with _metadata.json)."""
        return self.file_path.name.endswith('_metadata.json')

    @property
    def is_result_json(self) -> bool:
        """Check if this is a result JSON file (ends with .json but not _metadata.json)."""
        return self.file_path.suffix == '.json' and not self.is_metadata_json

    @property
    def is_image_file(self) -> bool:
        """Check if this is a direct image file."""
        return self.file_path.suffix.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']

    def get_image_url(self, base_url: str = "http://localhost:8080") -> Optional[str]:
        """
        Get the URL to display this result as an image.

        Handles three cases:
        1. Direct image file -> return its URL
        2. Result JSON with Replicate URL -> return the URL from JSON
        3. Downloaded image metadata -> return URL to the local downloaded file
        """
        if self.is_image_file:
            # Direct image file
            return f"{base_url}/results/{self.file_path.name}"

        elif self.is_result_json:
            # Parse as ReplicateResultMetadata
            import json
            with open(self.file_path, 'r') as f:
                data = json.load(f)
            metadata = ReplicateResultMetadata(**data)
            return metadata.get_image_url()

        elif self.is_metadata_json:
            # Parse as DownloadedImageMetadata
            import json
            with open(self.file_path, 'r') as f:
                data = json.load(f)
            metadata = DownloadedImageMetadata(**data)
            return f"{base_url}/results/{metadata.local_file}"

        return None

    def get_metadata(self) -> Optional[dict]:
        """Get metadata about this result (model, tag, timestamp, etc.)."""
        if self.is_image_file:
            # Extract from filename pattern: model_tag_timestamp.ext
            name = self.file_path.stem
            parts = name.split('_')
            if len(parts) >= 3:
                # Try to parse timestamp (last part should be YYYYMMDD_HHMMSS)
                timestamp_parts = []
                tag_parts = []

                # Work backwards to find timestamp
                for i in range(len(parts) - 1, -1, -1):
                    if len(parts[i]) == 8 and parts[i].isdigit():  # Date part
                        timestamp_parts.insert(0, parts[i])
                        tag_parts = parts[1:i]  # Everything between model and timestamp is tag
                        break

                return {
                    "model": parts[0].replace('-', '/'),  # Convert back to model format
                    "tag": '_'.join(tag_parts) if tag_parts else "",
                    "timestamp": '_'.join(timestamp_parts) if timestamp_parts else ""
                }
            return None

        elif self.is_result_json or self.is_metadata_json:
            import json
            with open(self.file_path, 'r') as f:
                return json.load(f)

        return None


def parse_result_file(file_path: Union[str, Path]) -> ResultFile:
    """Parse any result file and return a unified ResultFile object."""
    return ResultFile(file_path=Path(file_path))
