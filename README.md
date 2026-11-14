# Nate Maray

Mobile character sheet for Nate Maray in a He Who Fights With Monsters game. The live sheet is a Supabase row. Nate keeps his own equip, loadouts, and pinned tabs on his phone.

**Sheet:** https://natemaray.github.io/Character-Sheet/

**Backup file:** https://natemaray.github.io/Character-Sheet/data/nate.json

The Pages site updates when `main` changes. The workflow is `.github/workflows/pages.yml` (GitHub Actions). Story updates go to the Supabase row and show up live; the JSON file is the fallback.

## On an iPhone

1. Open the sheet URL in Safari.
2. Share → Add to Home Screen.
3. Open it from the icon. It runs full screen, including the area around the notch.

A green dot means the sheet is live. Refresh reloads the row and leaves equip, loadouts, and pins alone. The rev under his name is how you know which scene you are looking at.

## For the game master

Write the campaign object to the Supabase row `public.sheet` (`id` `nate`). Change `rev` every time. `public/data/nate.json` is the backup copy. The field guide is [DATA_SCHEMA.md](DATA_SCHEMA.md).

## Local

```bash
npm install
npm test
npm run dev
```

The dev server uses the same base path as Pages: http://localhost:5173/Character-Sheet/

```bash
npm run build
npm run preview
```
