import { globalSearch } from "@/lib/search/global-search";
import { jsonOk, withAuthenticatedApi } from "@/lib/errors/handle-api";

export const GET = withAuthenticatedApi(async (request, { correlationId, session }) => {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const results = await globalSearch(session, q);
  return jsonOk({ results }, correlationId);
});
