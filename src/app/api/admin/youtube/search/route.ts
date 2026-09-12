import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/access";
import { searchEmbeddableVideos } from "@/lib/youtube";

export async function GET(request: Request) {
  try { await requireAdmin(); const query = new URL(request.url).searchParams.get("q")?.trim(); if (!query) return apiError("A trailer search query is required.", 400, "INVALID_QUERY"); return apiSuccess(await searchEmbeddableVideos(query)); }
  catch (error) { return apiError(error instanceof Error ? error.message : "YouTube trailer search failed.", 500, "YOUTUBE_SEARCH_FAILED"); }
}
