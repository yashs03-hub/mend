import { NextRequest, NextResponse } from "next/server";
import { fetchMessages, persistMessage } from "@/lib/db/supabase";

export const runtime = "nodejs";

export async function GET() {
  const messages = await fetchMessages();
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  let body: { content?: string; sender?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  const sender = typeof body.sender === "string" ? body.sender.trim() : "Care Team";

  if (!content) {
    return NextResponse.json({ error: "Message content is required" }, { status: 400 });
  }

  const status = await persistMessage(content, sender);
  return NextResponse.json({ success: true, status });
}
