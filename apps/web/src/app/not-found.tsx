import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Not found</h1>
      <p style={{ color: "var(--text-muted)" }}>
        There is no pattern at this address.
      </p>
      <Link href="/explore" className="underline">
        Browse the library
      </Link>
    </div>
  );
}
