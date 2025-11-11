"""List available Replicate models."""
import replicate
import os


def list_models(owner: str = None, limit: int = 20) -> list:
    """
    List Replicate models, optionally filtered by owner.

    Args:
        owner: Optional owner name to filter by
        limit: Maximum number of models to return

    Returns:
        List of model dictionaries with name, owner, description
    """
    try:
        client = replicate.Client(api_token=os.environ.get("REPLICATE_API_TOKEN"))

        if owner:
            models = list(client.models.list(owner=owner))
        else:
            models = list(client.models.list())

        # Transform before returning
        return [
            {
                "name": f"{m.owner}/{m.name}",
                "description": m.description or "",
                "url": m.url
            }
            for m in models[:limit]
        ]
    except Exception as e:
        return [{"error": str(e)}]
