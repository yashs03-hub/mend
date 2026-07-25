import { NextResponse } from "next/server";
import { fetchCheckins } from "@/lib/db/supabase";

export const runtime = "nodejs";

export async function GET() {
  const checkins = await fetchCheckins();
  return NextResponse.json({ checkins });
}
