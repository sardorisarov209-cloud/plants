from __future__ import annotations

from typing import Any

import aiohttp


async def search_itunes(query: str, limit: int = 5) -> list[dict[str, Any]]:
    """
    iTunes Search API orqali trek qidiradi.
    Bu API natijada previewUrl (30s) va trackViewUrl linklarni berishi mumkin.
    """
    q = (query or "").strip()
    if not q:
        return []

    params = {
        "term": q,
        "entity": "song",
        "limit": str(max(1, min(limit, 10))),
    }

    async with aiohttp.ClientSession() as session:
        async with session.get("https://itunes.apple.com/search", params=params, timeout=20) as resp:
            if resp.status != 200:
                return []
            data = await resp.json()
            results = data.get("results") or []
            return [r for r in results if isinstance(r, dict)]

