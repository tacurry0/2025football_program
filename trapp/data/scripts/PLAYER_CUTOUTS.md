# Player portrait cutouts

Run `python -m pip install -r trapp/data/scripts/requirements-player-cutouts.txt`, then
`python trapp/data/scripts/build_player_cutouts.py` from the repository root.
The script scans both supported image directories for Niigata and Kumamoto, keeps
originals untouched, and writes alpha WebP files plus `trapp/player-cutouts-index.js`.
The profile hero uses only indexed cutouts and falls back to the original on errors.
Manual photos remain local and are not sent to this job.

The `Prepare trapp player cutouts` workflow runs on source-image changes, nightly,
and on manual dispatch. This also covers images committed by another Actions job
(which cannot trigger a new push workflow). Identical image bytes share one output;
unchanged images are skipped. Change RECIPE to regenerate after model/settings changes.
Model inference runs on CPU in the preparation job, never on the user's phone.
ONNX telemetry is disabled before initialization. The model is downloaded once and
cached; no portrait is uploaded to a third-party background-removal API.

`--name 笠井` creates a sample without replacing the public index.
`data/assets/player_cutouts/report.json` records failures; those retain originals.
The mask checks catch empty/full masks, but are not a guarantee of perfect hair edges.
Inspect representative portraits before changing the recipe.
