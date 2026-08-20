import { it } from "vitest";

/**
 * Not an assertion, a readout.
 *
 * `test/debug.ts` prints coverage, spurious length, dangling ends and timings
 * for the whole corpus. That is the thing to look at when tuning a threshold
 * or when a real file reads badly, and it needs a runner, so it gets one, as
 * a test that only fails if the pipeline throws.
 *
 *   pnpm --filter @kamibase/vision exec vitest run test/report.test.ts
 */
it("reads the whole corpus without throwing", async () => {
  await import("./debug.js");
}, 600_000);
