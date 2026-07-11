import asyncio
import time
from collections import OrderedDict
from mcp import ClientSession
from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamable_http_client

class PoolEntry:
    def __init__(self, context_manager, read_stream, write_stream, session, last_used: float):
        self.context_manager = context_manager
        self.read_stream = read_stream
        self.write_stream = write_stream
        self.session = session
        self.last_used = last_used

    def is_expired(self, ttl: float) -> bool:
        return (time.time() - self.last_used) > ttl

class MCPConnectionPool:
    def __init__(self, max_connections=50, idle_ttl=300):
        self._pool = OrderedDict()
        self._max = max_connections
        self._ttl = idle_ttl
        self._lock = asyncio.Lock()

    async def get_or_create(self, user_id: str, provider: str, 
                             server_url: str, access_token: str, transport: str) -> ClientSession:
        key = f"{user_id}:{provider}"
        async with self._lock:
            # Check if exists and is not expired
            if key in self._pool:
                entry = self._pool[key]
                if not entry.is_expired(self._ttl):
                    entry.last_used = time.time()
                    self._pool.move_to_end(key)
                    return entry.session
                else:
                    await self._close_entry(entry)
                    del self._pool[key]

            # Evict oldest if pool is full
            while len(self._pool) >= self._max:
                oldest_key, oldest = self._pool.popitem(last=False)
                await self._close_entry(oldest)

            # Create new connection
            headers = {"Authorization": f"Bearer {access_token}"}
            
            try:
                if transport == "sse":
                    cm = sse_client(server_url, headers=headers)
                    read_stream, write_stream = await cm.__aenter__()
                    session = ClientSession(read_stream, write_stream)
                    await session.__aenter__()
                    await session.initialize()
                else:
                    cm = streamable_http_client(server_url, headers=headers)
                    read_stream, write_stream, _ = await cm.__aenter__()
                    session = ClientSession(read_stream, write_stream)
                    await session.__aenter__()
                    await session.initialize()
                    
                self._pool[key] = PoolEntry(
                    context_manager=cm,
                    read_stream=read_stream,
                    write_stream=write_stream,
                    session=session,
                    last_used=time.time()
                )
                return session
            except Exception as e:
                print(f"[-] Failed to establish connection to {server_url}: {e}")
                raise e

    async def disconnect(self, user_id: str, provider: str):
        key = f"{user_id}:{provider}"
        async with self._lock:
            if key in self._pool:
                entry = self._pool[key]
                await self._close_entry(entry)
                del self._pool[key]

    async def close_all(self):
        async with self._lock:
            for entry in self._pool.values():
                await self._close_entry(entry)
            self._pool.clear()

    async def _close_entry(self, entry: PoolEntry):
        try:
            await entry.session.__aexit__(None, None, None)
        except Exception:
            pass
        try:
            await entry.context_manager.__aexit__(None, None, None)
        except Exception:
            pass

# Singleton instance
mcp_pool = MCPConnectionPool()
