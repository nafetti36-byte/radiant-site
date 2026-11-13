# Builds index.html (standalone site) from store.tpl.html + products.json
import json, pathlib
here = pathlib.Path(__file__).parent
data = json.loads((here/"products.json").read_text(encoding="utf-8"))
body = (here/"store.tpl.html").read_text(encoding="utf-8").replace("__DATA__", json.dumps(data, ensure_ascii=False))
head, rest = body.split("</style>", 1)
page = ('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        + head + "</style>\n</head>\n<body>\n" + rest + "\n</body>\n</html>\n")
(here/"index.html").write_text(page, encoding="utf-8")
(here/"preview.html").write_text(body, encoding="utf-8")
print("built")
