import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, the vendored simulator, and image
     * files. The simulator especially: it is 12MB of third-party static files
     * and has nothing to do with our session.
     */
    "/((?!_next/static|_next/image|sim/|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
