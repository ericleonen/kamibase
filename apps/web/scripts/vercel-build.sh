#!/usr/bin/env bash
# The deploy build.
#
# Vercel runs this from apps/web, which is why it cannot just be `next build`:
# apps/web depends on the @kamibase/core workspace package, whose entry point is
# ./dist/index.js, and dist/ is gitignored. A fresh clone therefore has no core
# build, and `next build` fails with "Can't resolve '@kamibase/core'". Nothing
# builds a workspace dependency implicitly. pnpm install does not, and the root
# `pnpm build` only gets the order right because `pnpm -r` is topological.
#
# So: build the dependency, vendor the simulator, then build the app.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "==> Building @kamibase/core (its dist/ is not committed)"
pnpm --filter @kamibase/core build

echo "==> Vendoring Origami Simulator"
if bash scripts/vendor-simulator.sh; then
  :
else
  # Non-fatal on purpose: if GitHub is unreachable mid-deploy, the site should
  # still ship. The 3D fold view degrades to the flat crease pattern with a
  # plain explanation, which is what DESIGN.md §5.3 asks for.
  echo "warning: vendoring the simulator failed; the 3D fold view will show" >&2
  echo "         the flat crease pattern and an explanation instead." >&2
fi

echo "==> Building the app"
pnpm exec next build
