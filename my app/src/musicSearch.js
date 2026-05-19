async function searchItunes(query, limit = 5) {
  const q = String(query || "").trim();
  if (!q) return [];

  const capped = Math.max(1, Math.min(Number(limit) || 5, 10));
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", q);
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", String(capped));

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) return [];

  const data = await res.json().catch(() => null);
  const results = data?.results;
  if (!Array.isArray(results)) return [];
  return results.filter((r) => r && typeof r === "object");
}

module.exports = { searchItunes };

