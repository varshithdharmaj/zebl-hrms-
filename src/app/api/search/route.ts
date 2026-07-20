import { NextResponse } from "next/server";
import { globalSearch } from "@/lib/search/global-search";
import { jsonOk, withAuthenticatedApi } from "@/lib/errors/handle-api";
import { checkRateLimit } from "@/lib/rate-limit";

export const GET = withAuthenticatedApi(async (request, { correlationId, session }) => {
  const rateCheck = checkRateLimit(`search:${session.id}`, 30, 60 * 1000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Search rate limit exceeded." },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(rateCheck.retryAfterMs / 1000).toString(),
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").slice(0, 100).trim();
  const results = await globalSearch(session, q);
  return jsonOk({ results }, correlationId);
});
