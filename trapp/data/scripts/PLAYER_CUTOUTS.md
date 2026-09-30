# Club official player photos and profiles

Install `requirements-player-image-sync.txt`, then run:

```sh
python trapp/data/scripts/sync_missing_player_images.py
```

The script discovers the latest published Albirex Niigata roster and the Roasso
Kumamoto roster, and reads each player's detail page. It refreshes current players
including those who already have photos. Niigata uses the native transparent PNG
from `/files/player/<season>/detail/`; Kumamoto uses the detail `_big` portrait.
J.League roster images and roster thumbnails are never used by this sync.

Photos keep their original resolution and alpha and are stored as lossless WebP
in `data/assets/official_players/<club>/`. Their content-based URLs are listed in
`player-official-index.js`, which the app prefers over older images in both player
lists and detail/card screens. Existing historical images remain available.

Basic profiles, official English names when available, current position,
birthdate, height, weight, birthplace, and club history update
`data/players/niigata.json` and `kumamoto.json`. Existing league milestones and
annual records remain intact. Source links point to the club's individual page.
`--name 桑山` can retry one player while preserving the rest of the index/report.

Install `requirements-player-cutouts.txt`, then run:

```sh
python trapp/data/scripts/build_player_cutouts.py
```

Native transparent official images are used directly without another mask.
Opaque official portraits are cut out at their original resolution and saved
losslessly. Older photos retain the existing cached cutouts and recipe. Model
inference runs locally/on Actions, never on the phone or a third-party image API.

The `Prepare trapp player cutouts` workflow runs nightly, on relevant source
changes and manual dispatch. It syncs club photos and profiles, prepares missing
cutouts, commits the assets/profile data and deploys the updated site. Failures
are recorded in `data/assets/images/player_image_sync_report.json` and
`data/assets/player_cutouts/report.json`; previous working entries are kept.
