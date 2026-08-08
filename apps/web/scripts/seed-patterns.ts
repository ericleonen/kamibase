/**
 * Generate the seeded pattern library into `content/patterns/*.kami`.
 *
 * Every seed goes through the real ingest path: parse `.cp`, planarize,
 * compute faces, canonicalize, validate, grade. So a seeded pattern is
 * indistinguishable from an uploaded one, and the committed files are
 * canonical bytes with a real `kami:contentHash`.
 *
 * The script is strict on purpose: a seed that stops being structurally clean,
 * or whose flat-foldability verdict changes, fails the run rather than
 * shipping. Re-running is idempotent.
 *
 *     pnpm --filter @kamibase/web seed
 */
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ingest, parseCp, type KamiDocument } from "@kamibase/core";
import { SEEDS, seedCpText, type Seed } from "./seeds/catalog";
import { deterministicUlid } from "./seeds/ulid";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PATTERNS_DIR = join(ROOT, "content", "patterns");
const CP_DIR = join(ROOT, "content", "sources");

/** Fixed so re-running the seeds does not churn every `kami:id`. */
const SEED_EPOCH = Date.UTC(2026, 7, 6);

function buildDocument(seed: Seed): Partial<KamiDocument> {
  return {
    file_title: seed.title,
    file_author: seed.designer,
    file_creator: "Kamibase seed script",
    file_description: seed.description,
    file_classes: ["singleModel"],
    frame_classes: ["creasePattern"],
    frame_attributes: ["2D", "manifold", "orientable"],
    frame_unit: "unit",
    "kami:version": "0.1",
    "kami:id": deterministicUlid(seed.id, SEED_EPOCH),
    "kami:paper": { ...seed.paper },
    ...(seed.difficulty ? { "kami:difficulty": { ...seed.difficulty } } : {}),
    "kami:taxonomy": {
      subject: [...(seed.taxonomy.subject ?? [])],
      techniques: [...(seed.taxonomy.techniques ?? [])],
      tags: [...(seed.taxonomy.tags ?? [])],
    },
    "kami:provenance": {
      designer: seed.designer,
      ...(seed.sourceUrl ? { originalSourceUrl: seed.sourceUrl } : {}),
      convertedFrom: {
        format: "cp",
        converter: "@kamibase/core parseCp",
        confidence: 1,
        reviewedByHuman: true,
      },
    },
    "kami:license": { ...seed.license },
    ...(seed.collapseNotes
      ? { "kami:folding": { collapseNotes: seed.collapseNotes } }
      : {}),
  } as Partial<KamiDocument>;
}

async function main(): Promise<void> {
  await mkdir(PATTERNS_DIR, { recursive: true });
  await mkdir(CP_DIR, { recursive: true });

  const written = new Set<string>();
  const rows: string[] = [];

  for (const seed of SEEDS) {
    if (written.has(seed.id)) throw new Error(`duplicate seed id: ${seed.id}`);

    const cp = seedCpText(seed);
    const parsed = parseCp(cp);
    const result = ingest(parsed, {
      document: buildDocument(seed) as KamiDocument,
    });

    const { structural, flatFold, level } = result.grade;
    if (!structural.ok) {
      const defects = structural.errors
        .map((defect) => `    ${defect.rule} ${defect.code}: ${defect.message}`)
        .join("\n");
      throw new Error(`seed "${seed.id}" is not structurally clean:\n${defects}`);
    }
    const flatFoldable = flatFold?.flatFoldable ?? false;
    if (flatFoldable !== seed.flatFoldable) {
      throw new Error(
        `seed "${seed.id}" expected flatFoldable=${seed.flatFoldable} but the ` +
          `checks say ${flatFoldable}` +
          (flatFold?.failures.length
            ? ` (${flatFold.failures
                .slice(0, 3)
                .map(
                  (v) =>
                    `v${v.vertex}: ${v.maekawa === "fail" ? "Maekawa" : "Kawasaki"}`,
                )
                .join(", ")})`
            : ""),
      );
    }

    await writeFile(join(PATTERNS_DIR, `${seed.id}.kami`), `${result.json}\n`, "utf8");
    await writeFile(join(CP_DIR, `${seed.id}.cp`), cp, "utf8");
    written.add(seed.id);

    rows.push(
      [
        seed.id.padEnd(22),
        String(result.graph.vertices.length).padStart(5),
        String(result.graph.edges.length).padStart(5),
        String(result.graph.faces?.length ?? 0).padStart(5),
        level.padStart(5),
        flatFoldable ? "  flat-foldable" : "  not flat-foldable",
      ].join(" "),
    );
  }

  // Drop files for seeds that no longer exist, so the directory always matches
  // the catalog.
  for (const directory of [PATTERNS_DIR, CP_DIR]) {
    const suffix = directory === PATTERNS_DIR ? ".kami" : ".cp";
    for (const file of await readdir(directory)) {
      if (!file.endsWith(suffix)) continue;
      if (!written.has(file.slice(0, -suffix.length))) {
        await rm(join(directory, file));
        process.stdout.write(`removed stale ${file}\n`);
      }
    }
  }

  process.stdout.write(
    `${"pattern".padEnd(22)} ${"verts".padStart(5)} ${"edges".padStart(5)} ` +
      `${"faces".padStart(5)} ${"level".padStart(5)}\n`,
  );
  process.stdout.write(`${rows.join("\n")}\n`);
  process.stdout.write(`\nwrote ${written.size} patterns to ${PATTERNS_DIR}\n`);
}

await main();
