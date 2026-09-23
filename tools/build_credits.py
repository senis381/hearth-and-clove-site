#!/usr/bin/env python3
"""Regenerate credits.html from assets/img/credits.json. Run after any image swap."""
import json, pathlib, html

ROOT = pathlib.Path(__file__).resolve().parent.parent
data = json.loads((ROOT / "assets/img/credits.json").read_text(encoding="utf-8"))
IMG = ROOT / "assets/img"

missing = [k for k in data if not (IMG / k).exists()]
unlisted = sorted(str(p.relative_to(IMG)) for p in IMG.rglob("*.jpg") if str(p.relative_to(IMG)) not in data)
if missing or unlisted:
    raise SystemExit(f"credits.json out of sync — credited but absent: {missing}; on disk but uncredited: {unlisted}")

PROVIDER = {"rawpixel": "rawpixel", "stocksnap": "StockSnap",
            "wordpress": "WordPress Photo Directory", "wikimedia": "Wikimedia Commons"}

def row(path, c):
    lic = f'{c["license"].upper().replace("BY-SA", "BY-SA")} {c["license_version"]}'
    verb = "Marked with" if c["license"] == "cc0" else "Licensed under"
    bits = []
    if c.get("creator"):
        bits.append("By " + html.escape(c["creator"]))
    bits.append(PROVIDER.get(c["provider"], c["provider"]))
    bits.append(f'{verb} <a href="{c["license_url"]}" target="_blank" rel="noopener">{lic}</a>')
    bits.append(f'<a href="{c["foreign_landing_url"]}" target="_blank" rel="noopener">Source</a>')
    return f'''      <div class="credit-row">
        <div class="credit-row__path">{path}</div>
        <div>
          <div class="credit-row__title">"{html.escape(c["title"])}"</div>
          <div class="credit-row__meta">{" · ".join(bits)}</div>
        </div>
      </div>'''

rows = "\n\n".join(row(p, c) for p, c in sorted(data.items()))
page = (ROOT / "tools/credits.template.html").read_text(encoding="utf-8").replace("<!--ROWS-->", rows)
(ROOT / "credits.html").write_text(page, encoding="utf-8")
print(f"credits.html: {len(data)} photos")
