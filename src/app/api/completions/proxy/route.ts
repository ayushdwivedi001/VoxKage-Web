import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      return NextResponse.json({ error: "Missing Authorization header" }, { status: 400 });
    }

    const body = await request.json();

    const isKilo = body.model?.includes("/") || body.model?.toLowerCase().includes("kilo") || authorization.startsWith("Bearer eyJ");
    const targetUrl = isKilo ? "https://api.kilo.ai/api/gateway/chat/completions" : "https://opencode.ai/zen/v1/chat/completions";

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
      return new Response(`data: Error (HTTP ${apiRes.status}): ${errText}\n\n`, {
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
    return new Response(`data: Error (Local Proxy Exception): ${error.message}\n\n`, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" }
    });
  }
}
