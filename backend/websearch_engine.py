import time
import random
import asyncio
from typing import List, Dict, Any
import warnings

# Silence DuckDuckGo Search renamed warnings
warnings.filterwarnings("ignore", category=RuntimeWarning)

try:
    from ddgs import DDGS
    HAS_DDG = True
except ImportError:
    try:
        from duckduckgo_search import DDGS
        HAS_DDG = True
    except ImportError:
        HAS_DDG = False

try:
    import trafilatura
    HAS_TRAFILATURA = True
except ImportError:
    HAS_TRAFILATURA = False

try:
    import aiohttp
    HAS_AIOHTTP = True
except ImportError:
    HAS_AIOHTTP = False


USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
]

class TTLCache:
    def __init__(self, ttl_seconds: float = 900):
        self.ttl = ttl_seconds
        self.cache = {}

    def get(self, key):
        if key in self.cache:
            val, expire = self.cache[key]
            if time.time() < expire:
                return val
            else:
                del self.cache[key]
        return None

    def set(self, key, value):
        self.cache[key] = (value, time.time() + self.ttl)

search_cache = TTLCache(ttl_seconds=900)
fetch_cache = TTLCache(ttl_seconds=900)

async def web_search(query: str, max_results: int = 10) -> List[Dict[str, Any]]:
    if not HAS_DDG:
        return [{"error": "duckduckgo-search is not installed. Please add it to requirements."}]

    cached = search_cache.get((query, max_results))
    if cached is not None:
        return cached

    def _run_ddg_once(attempt: int = 0):
        """Single DDG attempt — runs in a thread."""
        try:
            # Small jitter delay between retries to avoid rate-limit bursts
            if attempt > 0:
                time.sleep(attempt * 1.0 + random.uniform(0.1, 0.5))
            with DDGS() as ddgs:
                res = list(ddgs.text(query, max_results=max_results))
                if not res:
                    raise ValueError("DuckDuckGo returned no results (rate limit or block).")
                return res
        except Exception as e:
            print(f"⚠️ DDG execution failed (attempt {attempt + 1}): {e}")
            raise

    # Race two concurrent DDG attempts — whichever succeeds first wins.
    # Each attempt is limited to 12 seconds via concurrent.futures timeout.
    import concurrent.futures

    loop = asyncio.get_event_loop()

    async def _attempt(attempt_n: int):
        try:
            return await asyncio.wait_for(
                loop.run_in_executor(None, _run_ddg_once, attempt_n),
                timeout=12.0
            )
        except Exception:
            return None

    results = None
    for retry_round in range(3):
        # Launch 2 parallel attempts per retry round
        tasks = [_attempt(retry_round), _attempt(retry_round)]
        done_results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in done_results:
            if r and not isinstance(r, Exception):
                results = r
                break
        if results:
            break
        # Cool down between full retry rounds
        if retry_round < 2:
            await asyncio.sleep(retry_round * 1.5 + 0.5)

    if not results:
        return [{"error": f"DuckDuckGo search failed after 3 retry rounds for query: {query[:80]}"}]

    try:
        parsed = []
        for r in results:
            parsed.append({
                "title": r.get("title", ""),
                "url": r.get("href", ""),
                "snippet": r.get("body", "")
            })
        search_cache.set((query, max_results), parsed)
        return parsed
    except Exception as e:
        return [{"error": f"Failed to parse DuckDuckGo results: {e}"}]


_fetch_semaphore: asyncio.Semaphore | None = None

def _get_fetch_semaphore() -> asyncio.Semaphore:
    global _fetch_semaphore
    if _fetch_semaphore is None:
        _fetch_semaphore = asyncio.Semaphore(4)  # max 4 concurrent fetches
    return _fetch_semaphore


async def web_fetch(url: str) -> Dict[str, Any]:
    if not HAS_AIOHTTP or not HAS_TRAFILATURA:
        return {
            "url": url,
            "error": "aiohttp or trafilatura is not installed. Please add to requirements."
        }

    cached = fetch_cache.get(url)
    if cached is not None:
        return cached

    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://www.google.com/"
    }

    try:
        timeout = aiohttp.ClientTimeout(total=20, connect=8)
        async with _get_fetch_semaphore():
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url, headers=headers, allow_redirects=True) as response:
                    if response.status != 200:
                        return {
                            "url": url,
                            "error": f"HTTP status error: {response.status} {response.reason}"
                        }

                    html_content = await response.text(errors='replace')

                    def _extract():
                        return trafilatura.extract(
                            html_content,
                            include_links=True,
                            include_images=False,
                            include_tables=True,
                            output_format="markdown"
                        )

                    content = await asyncio.to_thread(_extract)

                    # Fallback to BeautifulSoup if trafilatura fails
                    if not content:
                        try:
                            from bs4 import BeautifulSoup
                            soup = BeautifulSoup(html_content, 'html.parser')
                            for element in soup(["script", "style", "nav", "footer", "header"]):
                                element.decompose()
                            raw_text = soup.get_text(separator="\n")
                            lines = [line.strip() for line in raw_text.splitlines()]
                            content = "\n".join([line for line in lines if line])
                        except Exception:
                            content = ""

                    if not content:
                        return {
                            "url": url,
                            "error": "Could not extract clean text content from page."
                        }

                    # Cap length to ~30KB to avoid token bloat
                    if len(content) > 30000:
                        content = content[:30000] + "\n\n...[Content truncated due to size limits]..."

                    result = {
                        "url": url,
                        "status": response.status,
                        "content": content
                    }

                    fetch_cache.set(url, result)
                    return result

    except asyncio.TimeoutError:
        return {"url": url, "error": "Request timed out (20s limit)"}
    except Exception as e:
        return {"url": url, "error": f"Fetch failed: {str(e)}"}

async def web_fetch_parallel(urls: List[str], global_timeout: float = 60.0) -> List[Dict[str, Any]]:
    """Fetch multiple URLs concurrently, each rate-limited by a semaphore.
    A global_timeout (default 60s) ensures the whole batch doesn't block forever."""
    tasks = [web_fetch(url) for url in urls]
    try:
        return list(await asyncio.wait_for(asyncio.gather(*tasks), timeout=global_timeout))
    except asyncio.TimeoutError:
        return [{"url": u, "error": f"Batch fetch timed out after {global_timeout}s"} for u in urls]

async def web_search_parallel(queries: List[str], global_timeout: float = 90.0) -> List[List[Dict[str, Any]]]:
    """Search multiple queries concurrently. Each search already has its own retry logic.
    A global_timeout (default 90s) caps the total wait across all queries."""
    async def _bounded_search(q: str):
        try:
            return await asyncio.wait_for(web_search(q), timeout=45.0)
        except asyncio.TimeoutError:
            return [{"error": f"Search timed out for query: {q[:80]}"}]

    tasks = [_bounded_search(q) for q in queries]
    try:
        return list(await asyncio.wait_for(asyncio.gather(*tasks), timeout=global_timeout))
    except asyncio.TimeoutError:
        return [[{"error": f"Parallel search batch timed out after {global_timeout}s"}]] * len(queries)

async def web_search_deep(query: str, max_results: int = 3) -> List[Dict[str, Any]]:
    max_results = min(max_results, 5)

    results = await web_search(query, max_results=max_results)
    if not results or "error" in results[0]:
        return results

    urls = [r["url"] for r in results if r.get("url")]
    if not urls:
        return results

    fetch_results = await web_fetch_parallel(urls)

    combined = []
    for r in results:
        url = r.get("url")
        matched = next((f for f in fetch_results if f.get("url") == url), None)

        entry = {
            "title": r.get("title", ""),
            "url": url,
            "snippet": r.get("snippet", ""),
        }

        if matched:
            if "error" in matched:
                entry["fetch_error"] = matched["error"]
            else:
                entry["content"] = matched.get("content", "")
        else:
            entry["fetch_error"] = "No content retrieved"

        combined.append(entry)

    return combined
