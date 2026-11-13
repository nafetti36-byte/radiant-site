# 3achra — Tout à 9,900 DT

Online shop for Tunisia: everything costs 9,900 DT, cash on delivery, free delivery from 5 items.
Orders are sent to the shop's WhatsApp, so the site works with no backend.

## Files
- `index.html` — the finished website (open it in a browser or host it anywhere).
- `store.tpl.html` — the source page. Edit this, not index.html.
- `products.json` — the 44 products: [category, name, description, China price USD, weight g, optional list of variants such as phone models].
- `build.py` — run `python3 build.py` after editing to rebuild `index.html` and the Shopify CSV.
- `3achra-products-shopify.csv` — the same products for Shopify (Products → Import); `build.py` regenerates it.

## Before going live
1. In `store.tpl.html`, set `CONFIG.whatsapp` to your WhatsApp number (country code + number, digits only), then run `python3 build.py`.
2. Replace the coloured product tiles with your own product photos.
3. Host it (Vercel, Netlify or GitHub Pages) and connect a domain like 3achra.tn.
