import { permanentRedirect } from "next/navigation";

/**
 * Scanning merged into the one import flow. The URL was published, so it keeps
 * working rather than 404ing.
 */
export default function ScanPage() {
  permanentRedirect("/upload");
}
