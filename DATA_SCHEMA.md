# Nate's sheet data

The live source of truth is one Supabase row:

`public.sheet`, `id = 'nate'`, column `data` (jsonb)

That `data` value is the same JSON object described below. The app reads it on open and subscribes to changes, so a write shows up on the phone without a refresh. A green dot under Nate's name means the live connection is up. A gray dot means the phone is offline or is showing the backup file.

`public/data/nate.json` is only that backup. The app uses it when Supabase cannot be reached. A GitHub Action rewrites it from the live row every 30 minutes, and again when someone runs "Sync sheet backup" by hand, then starts the Pages deploy if the rev changed. A gray dot with "Backup file" can be tapped for the error that made the phone give up on Supabase, and for this file's rev.

Published backup URL:

`https://natemaray.github.io/Character-Sheet/data/nate.json`

Loadouts and pinned tabs stay on the phone. Equip, unequip, and saved looks are logged with his other pocket changes. Until you list that action's id in `gear.appliedActions`, the phone keeps the change.

Bump `rev` to a new string after every scene, even a small one. The sheet shows the rev under Nate's name, so you can ask him what he sees. Use a date plus a short scene tag, like `2026-11-14-j-first-kill`. Never reuse an old rev.

## What `rev` changes

`rev` is the reconcile key for gear only.

- Same `rev`: the phone keeps his equipped items, worn clothes, pocket, looks, and loadouts exactly, including things he moved himself.
- New `rev`: `gear.equipped` (including each slot's `clothes`) and `gear.outfits` on the row are the doll and the saved looks. His pocket arrangement is kept, then the new row is merged in.
  - A new owned item (in `gear.pocket`, or worn in `gear.equipped` and not borrowed) appears in his pocket if he does not already have it.
  - Item notes and quantities refresh from the row.
  - An item listed only inside a chest's `contents` stays in that chest. It is not also added as its own pocket row.
  - Moves still waiting on the phone are played again after that merge, so a discarded item does not come back, a chest he filled does not come back empty, and an equip or look you have not applied yet is played on top of this row. See "Pocket changes from Nate".
  - An owned item removed from both lists disappears, even if he had it equipped.
  - A borrowed item listed on a slot in `gear.equipped` is on that slot. Anything of his that was in the way goes to his pocket. Borrowed names are `gear.borrowed` (the tanner's lantern, the foreman's lamp). They are never his, so Unequip does not put them in the pocket. If he has an open unequip for that piece, it is played after the merge.
  - His loadout names and which of his items they contain are kept. Notes refresh. A loadout entry whose item no longer exists is cleared. Default Combat and Travel are only used on a phone that has never saved loadouts. Loading a loadout logs an equip or unequip for each slot that changed. The loadout list itself is not in this JSON.

Pins are not part of `rev`. They live only on the phone (at most 5).

## Checklist after a scene

1. Edit the fields that changed (vitals, location, `worldTime`, `next`, battle, map, missions, gear).
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
| `worldTime` | Optional in-world clock in the vitals card, directly above the coins, location, and next lines. Leave the field off and the sheet looks the same. |
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

### World time (`worldTime`)

Optional. Omit the field entirely when you are not tracking the clock. A sheet without it loads and renders the same as before.

```json
"worldTime": { "day": 4, "dayLabel": "4 days after the assessment", "time": "Night", "detail": "About an hour before midnight" }
```

| Field | What it does |
| --- | --- |
| `day` | Number. Shown as "Day 4". |
| `dayLabel` | String under the time, such as "4 days after the assessment". |
| `time` | Time of day. `Dawn`, `Morning`, `Midday`, `Afternoon`, `Dusk`, `Evening`, `Night`, and `Late night` pick a sun or moon icon. Any other string still shows, with a plain clock. |
| `detail` | Optional free text, such as "About an hour before midnight". Leave it off when you have nothing to add. |

`day`, `dayLabel`, and `time` are expected when `worldTime` is present. A missing `worldTime` is fine. A present `worldTime` that is not that shape is rejected, and the sheet will not load.

## Gear

`gear.pocket` is what he is carrying and not wearing in the story snapshot.

`gear.equipped` is what is worn in the story snapshot, including borrowed pieces. Empty slots stay in the list with `"name": ""` so the paper doll still has that slot. `empty` is the word shown on a bare slot (`none` for armour, `empty` for the rest).

`clothes`, when present on a slot, is wardrobe pieces worn there: `{ "name": "Linen shirt", "slot": "Torso" }`. `name` is a `gear.wardrobe` name. `slot` is that piece's wardrobe slot (`Head`, `Face`, `Neck`, `Torso`, `Wrist`, `Waist`, `Legs`, or `Shoes`), not the doll slot. The doll slot is the parent (`Head` or `Body`). Head-slot clothes sit on doll `Head`. Every other wardrobe slot sits on doll `Body`, as a list under Worn clothes. These pieces are not removed from `gear.wardrobe` and they do not use a pocket slot. Leave `clothes` off a slot that has none. A `clothes` entry that is not `{ name, slot }` with a wardrobe slot rejects the sheet.

Owned items that are worn (travel clothes, the hammer) do not also need a `pocket` row. The app treats a non-borrowed equipped item as his.

`gear.equipTargets` maps an item name to the slots it can fill, first choice first. The pocket's Equip button uses the first slot, or the first empty legal slot. The paper doll only offers items whose list includes that slot.

`gear.doll` is the paper-doll grid. Each row has 3 cells. `""` is a blank cell. Every real label must match an `equipped` slot name exactly.

`gear.defaultLoadouts` is Combat and Travel for a phone that has no saved loadouts yet. Combat is the story kit without borrowed gear. Travel clears Main hand and Off hand.

`gear.pocketSlots` is the pocket grid size (40). Only top-level pocket rows use a slot. A chest is one row, so it uses one slot. Clothes in `gear.wardrobe` do not use a slot, and they are not part of the pocket counter.

`gear.borrowed` is the list of items that are not his.

`gear.wardrobe` is optional. It is his clothes, the Outfits tab in inventory. Each entry is `{ "name": "Linen shirt", "slot": "Torso", "qty": "", "note": "Everyday." }`. `name` and `slot` are required. `qty` and `note` are optional strings. `slot` is one of `Head`, `Face`, `Neck`, `Torso`, `Wrist`, `Waist`, `Legs`, `Shoes`. The phone lists them in that order, head to toe, with a button for each slot plus All. Omit the field, or use `[]`, and the Wardrobe button opens an empty list. These pieces are not pocket rows. Do not also put them in `gear.pocket` unless he is carrying that piece as cargo. A bad `slot`, a missing `name`, or a `qty` that is not a string rejects the sheet.

`gear.outfits` is his saved looks, at most 10. Each entry is `{ "name": "Town", "items": ["Linen shirt", "War Hammer"], "pieces": [{ "name": "Linen shirt", "slot": "Body", "source": "wardrobe" }, { "name": "War Hammer", "slot": "Main hand", "source": "gear" }] }`. `name` and `items` are required. `items` is the flat list of names. `pieces` is optional and is what Wear look uses. Each piece has `name`, `slot` (the doll slot), and `source` (`wardrobe` or `gear`). A wardrobe piece stays in the wardrobe. A gear piece is an owned doll item such as a weapon. Borrowed gear is not saved in a look. An older row with only `name` and `items` still loads: a wardrobe name is worn on Head or Body from its wardrobe slot, and any other name is equipped to the first `equipTargets` slot. Omit `outfits`, or use `[]`, and he has no saved looks. The phone shows 10 slots. A present `outfits` that is not that shape rejects the sheet. Extra looks past 10 are ignored.

`gear.pocket[].contents`, when present, makes that row a container (a chest). Use an array of `{name, qty, note}`, or `[]` for an empty chest. Leave `contents` off a normal item. Do not put a chest inside `contents`. On his phone the chest shows its name, its note, and how many things are in it. He can open the list. Things inside a chest are not offered when he equips.

`gear.appliedActions` is an optional list of action ids you have already folded into this row. Leave it off until he has thrown something away, moved something into a chest, equipped or unequipped, or saved, renamed, deleted, or worn a look.

### Add an item

1. If it is in his pocket, add an object to `gear.pocket`: `name`, `qty` ("" or "x2"), `note`.
2. If it can be worn, add `equipTargets["Exact Name"]` with slot names.
3. If the story has it worn already, put it on that slot in `gear.equipped` (and do not also list it in `pocket` unless you want a spare). On the next rev the doll matches `gear.equipped`, then any equip or unequip he logged that is not yet in `appliedActions` is played on top. A logged equip keeps the piece on the doll even if this row still shows the old slot.
4. If it is borrowed, add the name to `gear.borrowed`, put it on the slot, and do not put it in `pocket`.
5. Bump `rev`.

To give him a chest, add a pocket object with `contents`. Put anything that starts inside it in that array, not as its own pocket row.

### Add clothes

1. Append an object to `gear.wardrobe`: `name`, `slot`, and optional `qty` and `note`.
2. `slot` is `Head`, `Face`, `Neck`, `Torso`, `Wrist`, `Waist`, `Legs`, or `Shoes`.
3. Leave it out of `gear.pocket`. It does not spend one of the 40 slots.
4. To save a look yourself, append `{ "name": "Town", "items": ["Linen shirt"], "pieces": [{ "name": "Linen shirt", "slot": "Body", "source": "wardrobe" }] }` to `gear.outfits`. Keep the list at 10 or fewer. He can also save looks on the phone. Those arrive as `save_look` rows.
5. Bump `rev`.

A chest in the pocket is still one slot. Garments inside the "Outfits tab" chest stay there until each one is also an entry in `gear.wardrobe`. Remove them from that chest in the same rev if they should no longer use the slot.

### Take an item away

Remove it from `pocket` and from every `equipped` slot. On the next rev it leaves his phone, including loadouts. If it was only inside a chest, remove it from that chest's `contents`. A wardrobe piece leaves when you delete it from `gear.wardrobe`. It was never a pocket row. Also remove that name from every `equipped` slot's `clothes`, and from any look that names it.

## Pocket changes from Nate

He can discard pocket items, put them in a chest, take them back out, equip, unequip, and save looks. Equipped pocket gear stays on the paper doll until he unequips it, so it is not in the pocket to discard or chest. Wardrobe clothes never enter the pocket. Each move stays on the phone (`hwfwm-nate-maray-gear-v1:actions`) until that move's id is in `gear.appliedActions`.

A move is one object:

| Field | What it does |
| --- | --- |
| `id` | Stable id. Copy this into `appliedActions` once the row matches the move. |
| `kind` | `discard`, `to_chest`, `from_chest`, `equip`, `unequip`, `save_look`, `delete_look`, `rename_look`, or `wear_look`. |
| `item` | The item name. For a look, this is the look name. For `rename_look`, this is the new name. |
| `qty` | The quantity text at the time, such as `x2` or `""`. Empty for clothes and looks. |
| `chest` | The chest name. `""` when he discards something that is not inside a chest, and `""` for equip and looks. |
| `slot` | Doll slot for `equip` and `unequip` (`Head`, `Body`, `Main hand`, `Off hand`, `Belt / sheath`, `Back`, `Armour`). Omitted on other kinds. |
| `detail` | Look rows only. For `save_look`, `delete_look`, and `wear_look`, an array of `{ "name", "slot", "source" }` (`source` is `wardrobe` or `gear`, `slot` is the doll slot). For `rename_look`, `{ "from": "Old name" }`. |
| `at` | When he did it, ISO time. |
| `baseRev` | The `rev` he was looking at. |

`equip` / `unequip` of a `gear.wardrobe` name does not take the piece out of the wardrobe and does not use a pocket slot. Head-slot clothes use doll `Head`. Torso, Legs, Shoes, Waist, Neck, Face, and Wrist use doll `Body`. `equip` / `unequip` of anything else is pocket gear: it leaves or enters the pocket, and it fills that one doll slot's `name`.

`save_look` stores the current doll (worn clothes plus owned gear, not borrowed gear) under `item`. The phone keeps at most 10 looks. Saving an existing name overwrites that look. `delete_look` removes the look named `item`. `rename_look` renames `detail.from` to `item`. `wear_look` puts that look on: Head and Body `clothes` become the look's wardrobe pieces (other worn clothes on those two slots come off), and each gear piece is equipped to its doll slot. Slots the look does not mention stay as they are.

Discarding a chest discards what is inside it too. That is one `discard`, on the chest. Putting an item in a chest does not spend another slot. Taking an item out does, and the phone refuses when every top-level slot is full. A chest cannot go inside itself or another chest.

The pocket tab shows how many moves are still waiting and can copy them as a JSON array. The phone also sends each move to the database function `log_pocket_action` (`p_action_id`, `p_kind`, `p_item`, `p_qty`, `p_chest`, `p_base_rev`) when that function exists. There is no write key in the app. If the function is missing, the move stays on the phone only. Until you run `sql/setup5_equip_actions.sql`, the database rejects `equip`, `unequip`, `save_look`, `delete_look`, `rename_look`, and `wear_look`. The phone keeps the change and shows "Not synced". It tries again later. That rejection does not block a discard or a chest move.

The function is still those 6 text arguments. For `equip` and `unequip`, `p_chest` is the doll slot. For a look, `p_chest` is the JSON text of `detail`. After `sql/setup5_equip_actions.sql`, a trigger copies that into the `slot` or `detail` column and stores `chest` as `""`.

When you accept a move:

1. Change the row so it matches.
   - `discard`, `to_chest`, `from_chest`: change `gear.pocket` (delete a discard, or move the object into or out of `contents`).
   - `equip` of pocket gear: set that doll slot's `name`, `note`, and `qty`, and remove the item from `gear.pocket`. The owned item that was on the slot goes back to the pocket. Do not pocket a borrowed item.
   - `unequip` of pocket gear: clear that slot's `name`. If it is not borrowed, add it to `gear.pocket`.
   - `equip` of a wardrobe piece: append `{ "name", "slot" }` to that doll slot's `clothes` (`slot` here is the wardrobe slot from `gear.wardrobe`). Leave the wardrobe row in place. Do not add a pocket row.
   - `unequip` of a wardrobe piece: remove that name from the doll slot's `clothes`. Leave the wardrobe row in place.
   - `save_look`: upsert `gear.outfits` by `item`. Set `items` to the piece names and `pieces` to `detail`. If this name is new and he already has 10 looks, ignore it.
   - `delete_look`: remove the outfit named `item`.
   - `rename_look`: rename `detail.from` to `item`. If `item` is already a look, ignore it.
   - `wear_look`: set doll `Head` `clothes` to the wardrobe pieces in `detail` whose doll slot is `Head`, and doll `Body` `clothes` to the ones whose doll slot is `Body`. Equip each `source: "gear"` piece onto its doll slot the same way as `equip`.
2. Append that move's `id` to `gear.appliedActions`.
3. Bump `rev`.

If you bump `rev` before the row matches, the phone keeps his move. After the merge it plays every waiting move whose id is not in `appliedActions`, in order, and skips a move whose item or chest is no longer in the row. A `sell` or `unsell` row is not one of those moves. The phone does not replay it as a discard, a chest move, an equip, or a look. Once the id is in `appliedActions`, the phone does not play that action again: `gear.equipped` and `gear.outfits` on the new rev are the doll and the looks.

## Sell list

Nate can list pocket items he wants to sell. The list stays on his phone, under `hwfwm-nate-maray-gear-v1:sell-list`. It is not part of this JSON file, and listing something does not take it out of the pocket. The sheet does not show a price. You set the price when the sale happens in the story.

He can list a top-level item, an item inside a chest, or an empty chest. A chest that still has something in it is not listed on its own; the things inside it are. For a stack whose qty is a number above 1 (`x6`, `6`, or a bare JSON number), he picks how many. Anything else is the whole item.

Each add is sent to `log_pocket_action` with `p_kind` `sell`. Each remove is `unsell`. `p_qty` is the count he is listing, such as `x6`. `p_chest` is the chest name, or `""` when the item is not inside a chest. These calls use the same function as a discard. There is no write key in the app. Until you run `sql/setup4_sell_actions.sql`, the database rejects `sell` and `unsell`. The phone keeps the list and tries the call again later. Do not put these ids in `appliedActions` to make the item disappear. That does not remove it.

When the sale actually happens:

1. Remove the item from `gear.pocket`, or from that chest's `contents`. If he only sold some of a stack, lower `qty` instead.
2. Update `coins`, and the coin pouch note if the count changed.
3. Bump `rev`.

On that new rev the phone drops a listed row that is gone, and lowers the listed count when the stack shrank. You do not edit the sell list.

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
| `enemies` | Creatures on the map. They are the CONTACTS table. |
| `allies` | Optional friends. Each is `{id, name, x, y, label?, status?}`. Drawn as an accent diamond with the label beside it, and listed under ALLIES, not CONTACTS. |
| `map.battleArchive` | Optional. Past battles, oldest first. Each item is a full battle object, same fields as `map.battle`. When the list has anything in it, Battle view gets a Past battles menu: pick a title to see that map, its note, and its contacts. Current battle is the way back. Omit the field, or use `[]`, and the menu stays hidden. |

Enemy fields: `id` (unique), `name`, `size`, `rank`, `type`, `status`, `x`, `y`. `tone` is `hostile` (red), `warning` (amber), `neutral` (green), `unknown`, or `dead` (a body, drawn with ×). `marker` is the glyph inside the dot (`!`, `·`, `?`, `×`). `facing` is `"player"` or a number (0 is north, clockwise) and draws a notch. `mapLabel` is the short name on the map; `""` hides it. `labelX` and `labelY` place that name. `r` is the dot radius (default 11, pups use 7).

A neutral enemy whose `id` is `gary` is still treated as an ally, so older rows that parked him in `enemies` keep working. Prefer `allies` for anyone new. If the same id is in both lists, the `allies` entry wins and he is not repeated.

### Add or move an enemy

1. Copy an enemy object. New `id`. Set `x` and `y` between him and whatever he is facing.
2. Set `tone`, `status`, and `marker` from what he can tell. Do not mark a pup hostile unless it is.
3. Put the dot inside `reveal` or widen the reveal so the ground around it is visible.
4. Update `note`, and `player` if he moved.
5. Delete a creature that is gone. Do not leave a placeholder dot.
6. To file the scene, copy the whole `battle` object onto the end of `map.battleArchive` before you replace `battle` with the new fight.
7. Bump `rev`.

To move Nate, change `player`, `lantern`, and `lamp` together, and shift `reveal` so he is still in the lit area.

## What not to edit for story

Pinned tabs, the Refresh button, colors, and the service worker are the app, not the scene. The worker is written to never cache `nate.json`. Do not add a cache rule for that file.

Story text does not belong in `src/`. If a scene needs a kind of picture the battle fields cannot draw, then the map component has to grow, and the new fields should be added to this file in the same change.
