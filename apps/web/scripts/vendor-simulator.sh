#!/usr/bin/env bash
# Vendor Origami Simulator (MIT) into public/sim so the 3D fold view is served
# from our own origin — DESIGN.md §5.2: "Served from our own origin so we
# control versioning and don't depend on someone else's uptime."
#
# The copy is unmodified. The embed works against stock upstream because
# js/importer.js already listens for {op:"importFold", fold} and announces
# itself to its parent; stripping the UI chrome is a later step, and keeping
# this a plain copy for now keeps the rebase cost at zero.
#
# public/sim is gitignored: it is ~34MB of someone else's repository, and
# vendoring it into our history would be worse than fetching it at deploy time.
set -euo pipefail

REPO="https://github.com/amandaghassaei/OrigamiSimulator"
REF="${SIMULATOR_REF:-master}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$HERE/public/sim"

if [ -d "$TARGET/.git" ]; then
  echo "Updating $TARGET"
  git -C "$TARGET" fetch --depth 1 origin "$REF"
  git -C "$TARGET" checkout -q FETCH_HEAD
else
  echo "Cloning Origami Simulator into $TARGET"
  rm -rf "$TARGET"
  mkdir -p "$(dirname "$TARGET")"
  git clone --depth 1 --branch "$REF" "$REPO" "$TARGET"
fi

if [ ! -f "$TARGET/index.html" ]; then
  echo "error: $TARGET/index.html is missing; the clone did not work" >&2
  exit 1
fi

# Keep the licence next to the code we serve, as MIT requires.
cp "$TARGET/LICENSE" "$TARGET/LICENSE.txt" 2>/dev/null || true

# Replace upstream's Google Analytics tag with a no-op shim.
#
# Serving someone else's analytics from our origin would report our visitors to
# a third party without asking them, and the measurement ID is not ours to send
# traffic to either. But the shim is not optional: the simulator calls gtag()
# from inside setFoldData(), so simply deleting the tag makes every pattern
# import throw ReferenceError before it builds any geometry. Removing the
# network call while keeping the symbol defined is the whole trick.
NOOP="$TARGET/kamibase-gtag-noop.js"
cat > "$NOOP" <<'JS'
// Replaces Google Analytics in the vendored Origami Simulator.
// The simulator calls gtag() on its import path, so the symbol has to exist —
// this makes those calls do nothing instead of phoning home.
window.dataLayer = window.dataLayer || [];
window.gtag = function gtag() {};
JS

if grep -q "googletagmanager" "$TARGET/index.html"; then
  perl -0pi -e 's{<script[^>]*googletagmanager[^>]*>\s*</script>}
                 {<script src="kamibase-gtag-noop.js"></script>}gsx;
                 s{<script>\s*window\.dataLayer\s*=.*?</script>}{}gs' \
    "$TARGET/index.html"
  echo "Replaced the bundled Google Analytics tag with a no-op shim."
fi

if grep -q "googletagmanager" "$TARGET/index.html"; then
  echo "error: the Google Analytics tag is still present in index.html" >&2
  exit 1
fi
if ! grep -q "kamibase-gtag-noop.js" "$TARGET/index.html"; then
  echo "error: the gtag no-op shim was not linked into index.html" >&2
  exit 1
fi

echo
echo "Vendored $(git -C "$TARGET" rev-parse --short HEAD) from $REPO"
echo "The simulator is now served at /sim/index.html."
