import { PublicationStatus } from "@/generated/prisma/enums";
import { apiSuccess } from "@/lib/api-response";
import { getPrisma } from "@/lib/prisma";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim();
  const type = params.get("type") ?? undefined;
  const content = await getPrisma().content.findMany({
    where: {
      publicationStatus: PublicationStatus.PUBLISHED,
      ...(type ? { contentType: type as never } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { shortDescription: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { genres: { include: { genre: true } }, trailer: true },
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
  });
  return apiSuccess(content);
}
