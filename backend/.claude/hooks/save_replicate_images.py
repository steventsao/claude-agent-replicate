#!/usr/bin/env python3
import json
import sys
import os
import re
from urllib.request import urlopen
from urllib.parse import urlparse
from datetime import datetime
import logging

def extract_image_urls(tool_result):
    """Extract image URLs from tool result content."""
    urls = []

    if not tool_result:
        return urls

    # Handle list of content blocks
    if isinstance(tool_result, list):
        for item in tool_result:
            if isinstance(item, dict):
                # Check for text content with URLs
                if item.get('type') == 'text' and 'text' in item:
                    text = item['text']
                    # Find URLs in markdown image format ![alt](url)
                    markdown_urls = re.findall(r'!\[.*?\]\((https?://[^\)]+)\)', text)
                    urls.extend(markdown_urls)
                    # Find plain URLs
                    plain_urls = re.findall(r'(https://replicate\.delivery/[^\s\)]+)', text)
                    urls.extend(plain_urls)

    # Handle dict with content key
    elif isinstance(tool_result, dict):
        if 'content' in tool_result:
            return extract_image_urls(tool_result['content'])

    # Handle string
    elif isinstance(tool_result, str):
        markdown_urls = re.findall(r'!\[.*?\]\((https?://[^\)]+)\)', tool_result)
        urls.extend(markdown_urls)
        plain_urls = re.findall(r'(https://replicate\.delivery/[^\s\)]+)', tool_result)
        urls.extend(plain_urls)

    return urls

def download_image(url, save_path):
    """Download image from URL to save_path."""
    try:
        with urlopen(url) as response:
            with open(save_path, 'wb') as f:
                f.write(response.read())
        return True
    except Exception as e:
        print(f"Error downloading {url}: {e}", file=sys.stderr)
        return False

def setup_logging(project_dir):
    """Setup logging to file in project directory."""
    log_dir = os.path.join(project_dir, ".claude", "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "replicate_hook.log")

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler(sys.stderr)
        ]
    )
    return logging.getLogger(__name__)

def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")
    tool_result = input_data.get("tool_result")

    # Get project directory early for logging
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", ".")
    logger = setup_logging(project_dir)

    logger.info(f"Hook triggered for tool: {tool_name}")

    # Only process Replicate skill results
    if "replicate" not in tool_name.lower():
        logger.debug(f"Skipping non-replicate tool: {tool_name}")
        sys.exit(0)

    # Extract image URLs from result
    image_urls = extract_image_urls(tool_result)

    if not image_urls:
        logger.info("No image URLs found in result")
        sys.exit(0)

    logger.info(f"Found {len(image_urls)} image URL(s)")

    # Get save directory
    save_directory = os.path.join(project_dir, "generated_images")
    os.makedirs(save_directory, exist_ok=True)

    # Download and save images
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    for i, url in enumerate(image_urls):
        try:
            # Generate filename
            parsed = urlparse(url)
            ext = os.path.splitext(parsed.path)[1] or '.png'
            filename = f"replicate_{timestamp}_{i}{ext}"
            file_path = os.path.join(save_directory, filename)

            logger.info(f"Downloading image {i+1}/{len(image_urls)} from {url}")

            # Download image
            if download_image(url, file_path):
                logger.info(f"✓ Saved image to {file_path}")
            else:
                logger.error(f"✗ Failed to download {url}")

        except Exception as e:
            logger.error(f"Error processing {url}: {e}", exc_info=True)

    logger.info("Hook execution completed")
    sys.exit(0)

if __name__ == "__main__":
    main()
