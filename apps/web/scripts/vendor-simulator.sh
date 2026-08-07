#!/usr/bin/env bash
# Vendor Origami Simulator (MIT) into public/sim so the 3D fold view is served
# from our own origin — DESIGN.md §5.2: "Served from our own origin so we
# control versioning and don't depend on someone else's uptime."
#
# Upstream's JavaScript is untouched. The embed works against stock code
# because js/importer.js already listens for {op:"importFold", fold} and
# announces itself to its parent. The only edits are to index.html: an
# analytics tag swapped for a no-op shim, and a stylesheet that hides the
# simulator's own site chrome. Both are additive and re-applied on every run,
# so rebasing on upstream stays cheap.
#
# public/sim is gitignored: it is ~28MB of someone else's repository, and
# vendoring it into our history would be worse than fetching it at build time.
set -euo pipefail

REPO="https://github.com/amandaghassaei/OrigamiSimulator"
REF="${SIMULATOR_REF:-main}"
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

# Strip the simulator's own site chrome — DESIGN.md §5.2, "strip its UI
# chrome". Its navbar offers File, Examples and About, which navigate out of
# Kamibase and load other people's models into a page that is supposed to be
# showing one specific pattern.
#
# This is a stylesheet, not a fork: the elements stay in the DOM, so the
# simulator's own code still finds everything it queries. The fold slider,
# view mode, control mode and reset all stay visible — hiding those would
# leave a 3D model nobody can fold.
cat > "$TARGET/kamibase-embed.css" <<'CSS'
/* Kamibase embed overrides for the vendored Origami Simulator.
   Hides the host site's chrome and keeps every fold control. */
#globalNav,      /* File / Examples / View / Pattern / Simulation / About */
#helper,         /* "Load more origami patterns here!" tooltip */
#basicUI {       /* "Show Advanced Options" */
  display: none !important;
}
CSS

if ! grep -q "kamibase-embed.css" "$TARGET/index.html"; then
  perl -0pi -e 's{(</head>)}{    <link rel="stylesheet" href="kamibase-embed.css">\n$1}i' \
    "$TARGET/index.html"
fi

if ! grep -q "kamibase-embed.css" "$TARGET/index.html"; then
  echo "error: the embed stylesheet was not linked into index.html" >&2
  exit 1
fi
echo "Stripped the simulator's navbar and helper chrome."

# Drop the bundled demo library: 23MB of other people's models, plus the
# documentation images. We suppress the demo loader (?model=) and hide the
# Examples menu, so none of it is reachable — and shipping 23MB of unreachable
# assets on every deploy is pure cost. Set SIMULATOR_KEEP_ASSETS=1 to keep them.
if [ "${SIMULATOR_KEEP_ASSETS:-0}" != "1" ] && [ -d "$TARGET/assets" ]; then
  before="$(du -sh "$TARGET" | cut -f1)"
  rm -rf "$TARGET/assets" "$TARGET/CreasePatternScripts"
  echo "Pruned the bundled demo library ($before -> $(du -sh "$TARGET" | cut -f1))."
fi

echo
echo "Vendored $(git -C "$TARGET" rev-parse --short HEAD) from $REPO"
echo "The simulator is now served at /sim/index.html."
