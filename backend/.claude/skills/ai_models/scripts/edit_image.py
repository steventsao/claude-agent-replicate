#!/usr/bin/env python3
"""
Edit images using Replicate's nano-banana model.
Supports style transfer and image modifications with natural language prompts.
"""
import os
import sys
import json
import replicate
from datetime import datetime
from urllib.parse import urlparse


def validate_image_urls(image_urls):
    """
    Validate image URLs and provide helpful error messages.

    Args:
        image_urls: List of image URLs to validate

    Raises:
        ValueError: If any URL is localhost or invalid
    """
    for url in image_urls:
        # Skip base64 strings
        if url.startswith('data:'):
            continue

        parsed = urlparse(url)

        # Check for localhost
        if parsed.hostname in ['localhost', '127.0.0.1', '0.0.0.0'] or (parsed.hostname and parsed.hostname.startswith('192.168.')):
            raise ValueError(
                f"Error: Cannot use localhost URL: {url}\n\n"
                "Replicate models require publicly accessible URLs.\n"
                "Options:\n"
                "  1. Use a public URL (upload to cloud storage, S3, etc.)\n"
                "  2. Pass a base64-encoded image instead:\n"
                "     - Format: data:image/png;base64,<base64_string>\n"
                "     - Example: data:image/png;base64,iVBORw0KGgoAAAANS..."
            )


def edit_image(prompt, image_urls, aspect_ratio="match_input_image", output_format="jpg"):
    """
    Edit images using nano-banana model.

    Args:
        prompt: Natural language description of desired edits
        image_urls: List of image URLs or base64-encoded images. URLs must be publicly accessible.
        aspect_ratio: Output aspect ratio (default: "match_input_image")
        output_format: Output format - jpg or png (default: "jpg")

    Returns:
        dict with output URL and metadata

    Raises:
        ValueError: If image URLs are localhost or invalid
    """
    # Ensure image_urls is a list
    if isinstance(image_urls, str):
        image_urls = [image_urls]

    # Validate URLs
    validate_image_urls(image_urls)

    # Run the model
    output = replicate.run(
        "google/nano-banana",
        input={
            "prompt": prompt,
            "image_input": image_urls,
            "aspect_ratio": aspect_ratio,
            "output_format": output_format
        }
    )

    # Get the output URL
    output_url = output.url() if hasattr(output, 'url') else str(output)

    return {
        "url": output_url,
        "prompt": prompt,
        "image_inputs": image_urls,
        "aspect_ratio": aspect_ratio,
        "output_format": output_format,
        "timestamp": datetime.now().isoformat()
    }


def save_result(result, output_dir="results"):
    """Save result to JSON file and optionally download image."""
    os.makedirs(output_dir, exist_ok=True)

    # Create filename from prompt
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_prompt = "".join(c for c in result["prompt"][:50] if c.isalnum() or c in (' ', '_')).rstrip()
    safe_prompt = safe_prompt.replace(' ', '_')

    filename = f"{output_dir}/nano-banana_{safe_prompt}_{timestamp}.json"

    with open(filename, 'w') as f:
        json.dump(result, f, indent=2)

    print(f"Result saved to: {filename}")
    return filename


def main():
    if len(sys.argv) < 3:
        print("Usage: python edit_image.py <prompt> <image_url1> [image_url2] [--aspect-ratio RATIO] [--format FORMAT]")
        print("\nExample:")
        print('  python edit_image.py "Make the sheets in the style of the logo" https://example.com/img1.png https://example.com/img2.png')
        print("\nNote: Image URLs must be publicly accessible. Localhost URLs are not supported.")
        print("      Use base64-encoded images for local files: data:image/png;base64,<base64_string>")
        print('\nOptions:')
        print('  --aspect-ratio: match_input_image, 1:1, 16:9, 9:16, 4:3, 3:4, 21:9, 9:21 (default: match_input_image)')
        print('  --format: jpg, png (default: jpg)')
        sys.exit(1)

    prompt = sys.argv[1]

    # Parse arguments
    image_urls = []
    aspect_ratio = "match_input_image"
    output_format = "jpg"

    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == "--aspect-ratio" and i + 1 < len(sys.argv):
            aspect_ratio = sys.argv[i + 1]
            i += 2
        elif arg == "--format" and i + 1 < len(sys.argv):
            output_format = sys.argv[i + 1]
            i += 2
        else:
            image_urls.append(arg)
            i += 1

    if not image_urls:
        print("Error: At least one image URL is required")
        sys.exit(1)

    print(f"Editing image(s) with prompt: {prompt}")
    print(f"Image URLs: {', '.join(image_urls)}")
    print(f"Aspect ratio: {aspect_ratio}")
    print(f"Output format: {output_format}")

    try:
        result = edit_image(prompt, image_urls, aspect_ratio, output_format)

        print(f"\nSuccess! Output URL: {result['url']}")

        # Save result
        save_result(result)
    except ValueError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
