import { patterns } from "@/lib/patterns";
import { renderThumbnail } from "@/lib/render";

/** Card and preview thumbnail, straight from the core SVG renderer. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const pattern = await patterns.get(id);
  if (!pattern) {
    return new Response("No such pattern", { status: 404 });
  }

  return new Response(renderThumbnail(pattern.graph, pattern.title), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
      ...(pattern.contentHash ? { etag: `"${pattern.contentHash}-thumb"` } : {}),
    },
  });
}
