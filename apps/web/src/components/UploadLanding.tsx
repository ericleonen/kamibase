"use client";

import { useRouter } from "next/navigation";
import { UploadModal } from "./UploadModal";

/**
 * `/upload` as a URL rather than a place.
 *
 * The studio that used to live here is gone: uploading is a modal now, raised
 * from the header, and the editor is what you get on the far side of it. But
 * the address was published, so it still works, and it does the same thing the
 * menu item does. Dismissing it lands on a blank square instead of a dead end.
 */
export function UploadLanding() {
  const router = useRouter();

  return (
    <UploadModal
      onClose={() => router.push("/edit")}
      onReady={() => router.push("/edit/import")}
    />
  );
}
