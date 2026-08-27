# Bury Youth Cabinet

Public site for young people across Bury to share concerns and vote on Youth Cabinet polls — so those voices can be pushed forward to Bury Council and beyond.

**Developed by [Alexandro Ghanem](https://ghanem.uk)** · [ghanem.uk](https://ghanem.uk)

## Pages

- `index.html` — public site (suggestions + live polls)
- `admin.html` — dashboard to create polls, view votes, and manage suggestions

## Admin

Admin password: set in `js/store.js`

Data is stored in the browser via `localStorage` (no backend required).

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Stack

HTML · Tailwind CSS (CDN) · vanilla JavaScript
