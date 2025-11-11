"""Get detailed information about a Replicate model."""
import replicate
import os


def get_model_info(model: str) -> dict:
    """
    Get detailed information about a specific model.

    Args:
        model: Model name in format "owner/name"

    Returns:
        Dictionary with model details and schema
    """
    try:
        client = replicate.Client(api_token=os.environ.get("REPLICATE_API_TOKEN"))

        owner, name = model.split("/")
        model_obj = client.models.get(owner, name)

        info = {
            "name": f"{model_obj.owner}/{model_obj.name}",
            "description": model_obj.description,
            "url": model_obj.url,
        }

        if model_obj.latest_version:
            info["latest_version"] = model_obj.latest_version.id

            if model_obj.latest_version.openapi_schema:
                info["openapi_schema"] = model_obj.latest_version.openapi_schema

        return info
    except Exception as e:
        return {"error": str(e)}
