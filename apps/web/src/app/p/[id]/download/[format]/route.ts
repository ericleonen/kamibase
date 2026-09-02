import { isDownloadFormat, renderDownload } from "@/lib/downloads";
import { getVisiblePattern } from "@/lib/patterns/owner";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; format: string }> },
): Promise<Response> {
  const { id, format } = await params;

  if (!isDownloadFormat(format)) {
    return new Response(`Unsupported format: ${format}`, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const pattern = await getVisiblePattern(id);
  if (!pattern) {
    return new Response("No such pattern", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const download = renderDownload(format, pattern.id, pattern.document, pattern.graph);
  return new Response(download.body, {
    headers: {
      "content-type": download.contentType,
      "content-disposition": `attachment; filename="${download.filename}"`,
      // Seeded patterns are static; the content hash changes if the geometry does.
      "cache-control": "public, max-age=3600",
      ...(pattern.contentHash ? { etag: `"${pattern.contentHash}-${format}"` } : {}),
    },
  });
}
