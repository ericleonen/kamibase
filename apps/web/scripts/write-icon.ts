/**
 * Write `src/app/icon.svg` from `src/lib/logo.ts`.
 *
 * The favicon is a checked-in file because Next serves it as one, and a
 * checked-in file drawn by hand is a file that drifts from the module that
 * defines the letter. So it is generated, and `test/logo.test.ts` fails if the
 * committed copy and this output disagree.
 *
 *   pnpm --filter @kamibase/web icon
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logoFaviconSvg } from "../src/lib/logo";

const target = join(process.cwd(), "src", "app", "icon.svg");
await writeFile(target, logoFaviconSvg(), "utf8");
console.log(`wrote ${target}`);
