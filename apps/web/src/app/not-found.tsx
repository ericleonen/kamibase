import Link from "next/link";
import { KamiMark } from "@/components/KamiMark";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-20 text-center">
      {/* The mark on its own sheet: the one place the tile version of it is at
          home, since there is nothing else on this page. */}
      <KamiMark className="mx-auto size-16" />
      <h1 className="text-3xl font-black tracking-tight">Not found</h1>
      <p style={{ color: "var(--text-muted)" }}>There is no pattern at this address.</p>
      <Link href="/explore" className="inline-block font-semibold underline">
        Browse the library
      </Link>
    </div>
  );
}
