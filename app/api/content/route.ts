import { apiSuccess } from "@/lib/api-response";
import { getCataloguePage, parseCatalogueQuery } from "@/lib/catalogue";
import { routeError } from "@/lib/route-error";

export async function GET(request: Request) {
  try {
    const page = await getCataloguePage(parseCatalogueQuery(new URL(request.url).searchParams));
    return apiSuccess({ items: page.items, pagination: page.pagination });
  } catch (error) { return routeError(error, "The catalogue could not be loaded."); }
}
