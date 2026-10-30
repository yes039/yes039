"""步驟 1：角色定裝圖＋場景圖（後面每一鏡都拿這幾張當參考，鎖住長相）
已存在的圖會跳過；要重生就先刪掉 refs/ 裡那張。"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from common import ROOT, EP, gemini_image

R = ROOT / "refs"


def char(cid):
    """角色有 photo 欄位＝用本人照片當臉部參考（只限本人或已取得本人同意的照片）"""
    c = EP["characters"][cid]
    photo = Path(c["photo"]).expanduser() if c.get("photo") else None
    face = ("The character MUST have exactly the same face as the real person in the attached photo: "
            "same facial structure, eyes, eyebrows, nose, mouth, hairline, skin tone and apparent age. "
            "Ignore the photo's clothing, microphone and background; dress him or her as described. ") if photo else ""
    gemini_image(f"{EP['style']} Character design sheet on a plain light grey background. "
                 f"Left: full-body front view standing. Right: large close-up of the face, three-quarter view. "
                 f"{face}Same person in both views: {c['desc']}. Consistent outfit and facial features.",
                 R / f"{cid}.png", refs=[photo] if photo else (), aspect="16:9")
    print("ok", cid, "（照片參考）" if photo else "")


def location(name="location", desc=None):
    gemini_image(f"{EP['style']} Empty establishing shot, no people. {desc or EP['location']} "
                 "No signage, no logos, no lettering anywhere in the scene.", R / f"{name}.png", aspect="9:16")
    print("ok", name)


with ThreadPoolExecutor(5) as ex:
    # locations 可放多個場景（雙世界劇）：{"location": "...", "location_real": "..."}
    locs = EP.get("locations") or {"location": EP["location"]}
    jobs = [ex.submit(char, c) for c in EP["characters"]]
    jobs += [ex.submit(location, n, d) for n, d in locs.items()]
    for f in jobs:
        f.result()
print("👀 下一步：打開 refs/ 目視每張定裝圖（長相、服裝、牆上有沒有字或 logo），不滿意就刪掉重跑")
