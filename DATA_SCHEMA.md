# Nate's sheet data

The live source of truth is one Supabase row:

`public.sheet`, `id = 'nate'`, column `data` (jsonb)

That `data` value is the same JSON object described below. The app reads it on open and subscribes to changes, so a write shows up on the phone without a refresh. A green dot under Nate's name means the live connection is up. A gray dot means the phone is offline or is showing the backup file.

`public/data/nate.json` is only that backup. The app uses it when Supabase cannot be reached. Keep it in sync when you can, but the phone will not see an edit there until the backup path is used.

Published backup URL:

`https://natemaray.github.io/Character-Sheet/data/nate.json`

Equip, loadouts, and pinned tabs stay on the phone.

Bump `rev` to a new string after every scene, even a small one. The sheet shows the rev under Nate's name, so you can ask him what he sees. Use a date plus a short scene tag, like `2026-11-14-j-first-kill`. Never reuse an old rev.

## What `rev` changes

`rev` is the reconcile key for gear only.

- Same `rev`: the phone keeps his equipped items, pocket, and loadouts exactly, including things he moved himself.
- New `rev`: his arrangement is kept, then the new row is merged in.
  - A new owned item (in `gear.pocket`, or worn in `gear.equipped` and not borrowed) appears in his pocket if he does not already have it.
  - Item notes and quantities refresh from the row.
  - An owned item removed from both lists disappears, even if he had it equipped.
  - A borrowed item listed on a slot in `gear.equipped` is forced back onto that slot. Anything of his that was in the way goes to his pocket. Borrowed names are `gear.borrowed` (the tanner's lantern, the foreman's lamp). They are never his, so Unequip does not put them in the pocket.
  - His loadout names and which of his items they contain are kept. Notes refresh. A loadout entry whose item no longer exists is cleared. Default Combat and Travel are only used on a phone that has never saved loadouts.

Pins are not part of `rev`. They live only on the phone (at most 5).

## Checklist after a scene

1. Edit the fields that changed (vitals, location, `next`, battle, map, missions, gear).
2. Set `rev` to a new string.
3. Write the whole object into `public.sheet.data` for `id = 'nate'`. The app is listening; Nate does not have to tap anything. The phone still has Refresh, and it reloads the row when he opens the app again.
4. Copy the same object into `public/data/nate.json` when you can, so the backup matches.

## Top of the file

| Field | What it does |
| --- | --- |
| `rev` | Reconcile key. Change it every scene. |
| `about` | Note to the editor. The sheet does not show it. |
| `identity` | Name, rank line, "as of" line, and the four essence orbs. `slots[].filled` draws the lit orb. `mark` is the glyph inside (ϟ for Lightning). |
| `vitals[]` | One bar each. `pct` is 0–100. `note` sits beside the number. `tone` is `health`, `mana`, or `stamina` and picks the color. |
| `coins` | The coin line in the header. Also update the coin pouch note if the count changed. |
| `location` | Where he is, in the header. |
| `next` | The "next" line in the header. |
| `abilities[]` | Powers. `progress` is the percent toward the next rank. |
| `abilityMeta` | The two small headings under the ability cards. |
| `racial[]` | Outworlder gifts. |
| `missions[]` | Every contract, rumour, and finished job. `status` is the pill (`ACTIVE` is highlighted). `kind` is optional (`JOB`, `SYSTEM`). `filler` shows a FILLER pill when true. |
| `status.missionNames` | Which missions are featured on the Status tab, in order. Names must match `missions[].name`. |
| `status.log` | The recent-log cards on the Status tab. Newest first. |
| `essences[]` | The four essence cards. `state` `Absorbed` shows as LOCKED. Anything else shows as OPEN, with `state` as the text. |
| `essenceNotes[]` | Extra cards under the essences. `tag` is an optional pill. |
| `achievements[]` | Feat cards. |
| `profile[]` | Label/value rows. |

## Gear

`gear.pocket` is what he is carrying and not wearing in the story snapshot.

`gear.equipped` is what is worn in the story snapshot, including borrowed pieces. Empty slots stay in the list with `"name": ""` so the paper doll still has that slot. `empty` is the word shown on a bare slot (`none` for armour, `empty` for the rest).

Owned items that are worn (travel clothes, the hammer) do not also need a `pocket` row. The app treats a non-borrowed equipped item as his.

`gear.equipTargets` maps an item name to the slots it can fill, first choice first. The pocket's Equip button uses the first slot, or the first empty legal slot. The paper doll only offers items whose list includes that slot.

`gear.doll` is the paper-doll grid. Each row has 3 cells. `""` is a blank cell. Every real label must match an `equipped` slot name exactly.

`gear.defaultLoadouts` is Combat and Travel for a phone that has no saved loadouts yet. Combat is the story kit without borrowed gear. Travel clears Main hand and Off hand.

`gear.pocketSlots` is the pocket grid size (40).

`gear.borrowed` is the list of items that are not his.

### Add an item

1. If it is in his pocket, add an object to `gear.pocket`: `name`, `qty` ("" or "x2"), `note`.
2. If it can be worn, add `equipTargets["Exact Name"]` with slot names.
3. If the story has it worn already, put it on that slot in `gear.equipped` (and do not also list it in `pocket` unless you want a spare). On the next rev it still appears in his pocket if he was not already wearing it. His own worn items are not forced on; only borrowed ones are.
4. If it is borrowed, add the name to `gear.borrowed`, put it on the slot, and do not put it in `pocket`.
5. Bump `rev`.

### Take an item away

Remove it from `pocket` and from every `equipped` slot. On the next rev it leaves his phone, including loadouts.

## Map

Three views. Fog covers anything not in the reveal lists. The dashed line is the travelled route.

### World (`map.world`)

`places` are the labeled dots. Set `"current": true` on exactly one of them for the YOU ARE HERE marker. `hereLabel` is the caption under that dot.

`route` is the dashed line, in travel order. It can revisit a coordinate. It does not have to end on the current place (the line still ends at the Island, and the dot is Old City).

`fog.placeRadius` is how far around each place is revealed. The river and the route also cut a corridor (`riverWidth`, `routeWidth`).

`land`, `region`, `river`, and `mountains` are SVG paths in a 1000×1044 view. Leave them alone unless the continent changes.

`labels` are captions (Ocean, the upstream compass note, the footer).

### Add a world place

1. Append a place: `name`, `x`, `y`, `anchor` (`start`, `middle`, or `end`), `dx`, `dy` for the label nudge.
2. Append the same point to `route` if he travelled there.
3. Move `current` to it if he is there now, and set `hereLabel`.
4. Add a `map.charted` row (region, place, what he actually saw). Set `current: true` on that row and clear it from the old one. Charted text is the list under the world map.
5. Bump `rev`.

### Town (`map.town`)

Greenstone, Old City and the Island, 1000×720. `reveal` circles are the fog holes (`x`, `y`, `r`). The route also clears a corridor.

`labels` with `"current": true` is the town YOU ARE HERE dot (the tannery). `buildings` are the rectangles. A label with no reveal circle stays under the fog.

`bridges` are the four spans. `used: true` draws the one he crossed in the accent color. `bridge` is the shared curve (`x1`, `x2`, `cx`, `lift`).

### Add a town place

1. Add a `buildings` rect if there is a structure: `name`, `x`, `y`, `w`, `h`.
2. Add a `labels` entry near it.
3. Add a `reveal` circle big enough to show it.
4. Extend `route` if he walked there.
5. If he is there, set `current` on that label only, and set `hereLabel`.
6. Bump `rev`.

### Battle (`map.battle`)

Top-down, `width` 600 by `height` 420. Y grows downward. In the current culvert, north (daylight, the mouth) is the top.

| Field | What it does |
| --- | --- |
| `title`, `note` | Heading and the sentence under the map. |
| `tunnel` | Centerline path plus wall and floor thickness. Omit it in an open room. |
| `chamber` | Ellipse of the room he is in. |
| `nest` | Hides-and-bone nest. Omit it when there is no nest. |
| `daylight` | Glow at the mouth. Omit it underground with no exit in view. |
| `reeds` | Small reed tufts. |
| `extras` | Extra shapes: `rect` (`x,y,w,h`), `ellipse` (`cx,cy,rx,ry`), or `path` (`d`). `fill` is a token: `water`, `ground`, `stone`, `floor`, `hide`, `bone`, `daylight`, `muted`. |
| `labels` | Short captions (daylight, the bend). |
| `lamp` | Lantern glow around him. |
| `reveal` | Fog holes. `ellipse` or `stroke` (a thick path). If a creature is not inside a hole, the marker still draws, but the room around it stays dark. |
| `player` | Nate's dot. |
| `lantern` | The lantern dot, if he is holding it. |
| `compass` | Usually `N ↑`. |
| `enemies` | Every creature on the map, hostile or not. The table is this list. |

Enemy fields: `id` (unique), `name`, `size`, `rank`, `type`, `status`, `x`, `y`. `tone` is `hostile` (red), `warning` (amber), `neutral` (green), `unknown`, or `dead` (a body, drawn with ×). `marker` is the glyph inside the dot (`!`, `·`, `?`, `×`). `facing` is `"player"` or a number (0 is north, clockwise) and draws a notch. `mapLabel` is the short name on the map; `""` hides it. `labelX` and `labelY` place that name. `r` is the dot radius (default 11, pups use 7).

### Add or move an enemy

1. Copy an enemy object. New `id`. Set `x` and `y` between him and whatever he is facing.
2. Set `tone`, `status`, and `marker` from what he can tell. Do not mark a pup hostile unless it is.
3. Put the dot inside `reveal` or widen the reveal so the ground around it is visible.
4. Update `note`, and `player` if he moved.
5. Delete a creature that is gone (the old unseen contact is gone). Do not leave a placeholder dot.
6. Bump `rev`.

To move Nate, change `player`, `lantern`, and `lamp` together, and shift `reveal` so he is still in the lit area.

## What not to edit for story

Pinned tabs, the Refresh button, colors, and the service worker are the app, not the scene. The worker is written to never cache `nate.json`. Do not add a cache rule for that file.

Story text does not belong in `src/`. If a scene needs a kind of picture the battle fields cannot draw, then the map component has to grow, and the new fields should be added to this file in the same change.
