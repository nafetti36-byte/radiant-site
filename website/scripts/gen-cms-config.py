"""Regenerate static/admin/config.yml from content/en.json + settings.json.
Run after adding new text keys:  python3 website/scripts/gen-cms-config.py"""
import json, os, yaml
here = os.path.dirname(os.path.abspath(__file__)); site = os.path.dirname(here)
def f(v, name):
    if isinstance(v, dict):
        return {"label": name, "name": name, "widget": "object", "collapsed": True, "fields": [f(x, k) for k, x in v.items()]}
    if isinstance(v, list):
        if v and isinstance(v[0], dict):
            return {"label": name, "name": name, "widget": "list", "fields": [f(x, k) for k, x in v[0].items()]}
        return {"label": name, "name": name, "widget": "list"}
    return {"label": name, "name": name, "widget": "text" if len(str(v)) > 80 else "string"}
en = json.load(open(os.path.join(site, "content/en.json"), encoding="utf-8"))
st = json.load(open(os.path.join(site, "content/settings.json"), encoding="utf-8"))
files = [{"file": "website/content/settings.json", "label": "Settings (contact details, analytics)", "name": "settings",
          "fields": [dict(f(v, k), required=False) for k, v in st.items()]}]
for code, name in [("en", "English"), ("ar", "Arabic"), ("fr", "French")]:
    files.append({"file": f"website/content/{code}.json", "label": f"{name} text", "name": code, "fields": [f(v, k) for k, v in en.items()]})
cfg = {"backend": {"name": "git-gateway", "branch": "main"}, "media_folder": "website/static/assets/uploads",
       "public_folder": "/assets/uploads", "collections": [{"name": "site", "label": "Website", "files": files}]}
with open(os.path.join(site, "static/admin/config.yml"), "w", encoding="utf-8") as fh:
    yaml.safe_dump(cfg, fh, allow_unicode=True, sort_keys=False)
print("wrote static/admin/config.yml")
