# Builds index.html (standalone site) from store.tpl.html + products.json
import json, pathlib, subprocess
here = pathlib.Path(__file__).parent
data = json.loads((here/"products.json").read_text(encoding="utf-8"))
body = (here/"store.tpl.html").read_text(encoding="utf-8").replace("__DATA__", json.dumps(data, ensure_ascii=False))\
    .replace("__ART__", subprocess.run(["node", str(here/"posts/src/shop-art.js")], capture_output=True, text=True, check=True).stdout)
head, rest = body.split("</style>", 1)
page = ('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        + head + "</style>\n</head>\n<body>\n" + rest + "\n</body>\n</html>\n")
(here/"index.html").write_text(page, encoding="utf-8")
(here/"preview.html").write_text(body, encoding="utf-8")
print("built")

# Shopify import CSV (one row per product; extra rows for variants, Option1 Name "Modèle")
import csv, re, unicodedata
def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")
cols = ["Handle","Title","Body (HTML)","Vendor","Product Category","Type","Tags","Published","Option1 Name","Option1 Value",
        "Variant SKU","Variant Grams","Variant Inventory Tracker","Variant Inventory Qty","Variant Inventory Policy",
        "Variant Fulfillment Service","Variant Price","Variant Compare At Price","Variant Requires Shipping","Variant Taxable","Image Src","Status"]
perks = ("<ul><li>Prix unique : 9,900 DT</li><li>Livraison partout en Tunisie, paiement à la livraison</li>"
         "<li>Livraison gratuite dès 5 articles</li></ul>")
with open(here/"3achra-products-shopify.csv", "w", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh, lineterminator="\n")
    w.writerow(cols)
    for i, p in enumerate(data, 1):
        cat, name, desc, grams = p[0], p[1], p[2], p[4]
        opts = p[5] if len(p) > 5 and p[5] else None
        sku = f"3A-{i:03d}"
        variant = lambda val, s: [val, s, grams, "", "", "deny", "manual", "9.900", "", "TRUE", "TRUE", ""]
        first = opts[0] if opts else "Default Title"
        w.writerow([slug(name), name, f"<p>{desc}</p>{perks}", "3achra", "", cat, f"{cat}, tout-a-9900", "TRUE",
                    "Modèle" if opts else "Title"] + variant(first, f"{sku}-01" if opts else sku) + ["draft"])
        for j, o in enumerate(opts[1:] if opts else [], 2):
            w.writerow([slug(name)] + [""] * 7 + [""] + variant(o, f"{sku}-{j:02d}") + [""])
print("csv written")
