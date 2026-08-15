import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      return NextResponse.json({ error: "Missing Authorization header" }, { status: 400 });
    }

    const providerHeader = (request.headers.get("x-provider") || "").toLowerCase().trim();
    const body = await request.json();

    const authLower = (authorization || "").toLowerCase();
    let isKilo = false;
    if (providerHeader === "kilo") {
      isKilo = true;
    } else if (providerHeader === "opencode") {
      isKilo = false;
    } else {
      isKilo = 
        !!(body.model?.includes("/") || body.model?.toLowerCase().includes("kilo")) || 
        authLower.startsWith("bearer kilo_") || 
        authLower.startsWith("bearer kl-");
    }

    const targetUrl = isKilo 
      ? "https://api.kilo.ai/api/gateway/chat/completions" 
      : "https://opencode.ai/zen/v1/chat/completions";

    const apiRes = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authorization
      },
      body: JSON.stringify(body)
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      // Format as structured SSE error JSON so client can cleanly parse status & details
      return new Response(`data: {"error":{"status":${apiRes.status},"message":${JSON.stringify(errText)}}}\n\n`, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" }
      });
    }

    return new Response(apiRes.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive"
      }
    });

  } catch (error: any) {
    return new Response(`data: {"error":{"status":500,"message":${JSON.stringify(error.message || "Local Proxy Exception")}}}\n\n`, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" }
    });
  }
}
