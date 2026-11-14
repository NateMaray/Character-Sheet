# Nate Maray

Mobile character sheet for Nate Maray in a He Who Fights With Monsters game. An AI game master updates one JSON file after each scene. Nate keeps his own equip, loadouts, and pinned tabs on his phone.

**Sheet:** https://natemaray.github.io/Character-Sheet/

**Campaign file:** https://natemaray.github.io/Character-Sheet/data/nate.json

The Pages site updates when `main` changes. The workflow is `.github/workflows/pages.yml` (GitHub Actions). Until that workflow has run on `main`, the URL will 404.

## On an iPhone

1. Open the sheet URL in Safari.
2. Share → Add to Home Screen.
3. Open it from the icon. It runs full screen, including the area around the notch.

Use **Refresh** after a scene, or just switch back to the app. It reloads the campaign file and leaves equip, loadouts, and pins alone. The rev under his name is how you know which scene you are looking at.

## For the game master

Edit `public/data/nate.json` only. Change `rev` every time. The field guide is [DATA_SCHEMA.md](DATA_SCHEMA.md).

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
