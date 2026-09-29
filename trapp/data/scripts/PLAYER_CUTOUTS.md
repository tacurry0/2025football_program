# Player portrait cutouts

Run `python -m pip install -r trapp/data/scripts/requirements-player-image-sync.txt`, then
`python trapp/data/scripts/sync_missing_player_images.py` from the repository root to
look up portraits for missing players in the official J.League club rosters. The
script uses the app's existing annual analysis records, matches the full player name
to the roster's player link, then uses that official player ID to load the large
profile image (the image itself has a generic `Player` alt label). It saves valid
portraits under the expected Niigata/Kumamoto image directories and records unresolved
names in `trapp/data/assets/images/player_image_sync_report.json`. It never overwrites
an existing photo or accepts fuzzy matches.

Then run `python -m pip install -r trapp/data/scripts/requirements-player-cutouts.txt`,
followed by `python trapp/data/scripts/build_player_cutouts.py` from the repository root.
The cutout script scans both supported image directories, keeps originals untouched,
and writes alpha WebP files plus `trapp/player-cutouts-index.js`. The profile hero uses
indexed cutouts and falls back to the original on errors.
Manual photos remain local and are not sent to this job.

The `Prepare trapp player cutouts` workflow runs on source-image changes, nightly,
and on manual dispatch. It first fetches missing official portraits, then removes
backgrounds, commits source and generated images, and deploys the updated site. This
also covers images committed by another Actions job (which cannot trigger a new push
workflow). Identical image bytes share one output; unchanged images are skipped.
Change RECIPE to regenerate after model/settings changes.
Model inference runs on CPU in the preparation job, never on the user's phone.
ONNX telemetry is disabled before initialization. The model is downloaded once and
cached; no portrait is uploaded to a third-party background-removal API.

`--name 笠井` creates a sample without replacing the public index.
`data/assets/player_cutouts/report.json` records failures; those retain originals.
The mask checks catch empty/full masks, but are not a guarantee of perfect hair edges.
Inspect representative portraits before changing the recipe.
