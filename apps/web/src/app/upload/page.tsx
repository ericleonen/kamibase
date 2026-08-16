import type { Metadata } from "next";
import { UploadLanding } from "@/components/UploadLanding";

export const metadata: Metadata = {
  title: "Add a crease pattern",
  description:
    "Convert a .fold, .cp, .opx or SVG, or photograph the creased paper itself. " +
    "Everything runs in your browser.",
};

/** The upload modal, reached by URL instead of from the header menu. */
export default function AddPatternPage() {
  return <UploadLanding />;
}
