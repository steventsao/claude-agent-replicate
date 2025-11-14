"""
Replicate API proxy - calls local backend instead of using SDK directly.
This allows the backend to manage the API token securely.
"""
import requests
import time
from typing import Any, Dict

BASE_URL = "http://localhost:8080/api/replicate"


def run(model: str, input: Dict[str, Any], wait: bool = True) -> Any:
    """
    Run a Replicate model via local proxy.

    Args:
        model: Model identifier (e.g., "google/nano-banana")
        input: Model input parameters
        wait: Whether to wait for completion (default True)

    Returns:
        Model output (URL or data depending on model)

    Example:
        output = run("google/nano-banana", {"prompt": "an apple"})
        print(output)  # URL to generated image
    """
    # Create prediction
    response = requests.post(
        f"{BASE_URL}/predictions",
        json={
            "version": model,
            "input": input
        }
    )
    response.raise_for_status()
    prediction = response.json()

    if not wait:
        return prediction

    # Poll until complete
    prediction_id = prediction["id"]
    while prediction["status"] not in ["succeeded", "failed", "canceled"]:
        time.sleep(1)
        response = requests.get(f"{BASE_URL}/predictions/{prediction_id}")
        response.raise_for_status()
        prediction = response.json()

    if prediction["status"] == "failed":
        raise Exception(f"Prediction failed: {prediction.get('error')}")

    # Return output (URL for images/videos, text for text models)
    output = prediction.get("output")

    # If output is a list with single URL, return the URL string
    if isinstance(output, list) and len(output) == 1:
        return output[0]

    return output
