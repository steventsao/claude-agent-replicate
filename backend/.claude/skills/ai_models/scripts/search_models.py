"""Search for Replicate models by query."""
import replicate
import os


def search_models(query: str, limit: int = 20, only_runnable: bool = False) -> list:
    """
    Search Replicate models by query string.

    Args:
        query: Search query (e.g., "3d", "text-to-image", "flux")
        limit: Maximum number of models to return
        only_runnable: If True, only return models with a valid latest_version (default: True)

    Returns:
        List of model dictionaries with name, owner, description, and runnable status
    """
    try:
        client = replicate.Client(api_token=os.environ.get("REPLICATE_API_TOKEN"))

        models = list(client.models.search(query))

        # Filter and transform before returning
        result = []
        for m in models:
            # IMPORTANT: Skip models without latest_version to avoid 404 errors
            if only_runnable and not m.latest_version:
                continue

            result.append({
                "name": f"{m.owner}/{m.name}",
                "description": m.description[:100] if m.description else "",
                "url": m.url,
                "has_version": m.latest_version is not None,
                "version_id": m.latest_version.id[:12] + "..." if m.latest_version else None
            })

            if len(result) >= limit:
                break

        return result
    except Exception as e:
        return [{"error": str(e)}]
