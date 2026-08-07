/**
 * Emit `schema/kami.schema.json` from the TypeScript source of truth, so the
 * published artefact and the module export can never drift.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { kamiJsonSchema } from "../src/kami/json-schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "..", "schema", "kami.schema.json");

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(kamiJsonSchema, null, 2)}\n`, "utf8");
process.stdout.write(`wrote ${target}\n`);
