import { PublicationStatus } from "@/generated/prisma/enums";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getPrisma } from "@/lib/prisma";
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) { const content = await getPrisma().content.findFirst({ where: { slug: (await params).slug, publicationStatus: PublicationStatus.PUBLISHED }, include: { genres: { include: { genre: true } }, languages: { include: { language: true } }, trailer: true, seasons: { include: { episodes: true } }, credits: { include: { person: true } }, productionCompany: true } }); return content ? apiSuccess(content) : apiError("Content was not found.", 404, "NOT_FOUND"); }
