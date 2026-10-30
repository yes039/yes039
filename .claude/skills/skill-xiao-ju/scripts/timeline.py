"""時間軸：對白鏡頭長度＝該句音檔長度；其他鏡頭長度＝episode.json 的 dur"""
import json, sys
from common import ROOT, EP, dur


def build():
    t, out = 0.0, []
    for sh in EP["shots"]:
        if sh["type"] == "talk":
            f = ROOT / "audio" / f"{sh['id']}.mp3"
            if not f.exists():
                sys.exit(f"⏳ 還沒配音：找不到 audio/{sh['id']}.mp3（先跑 gen_audio.py）")
            d = dur(f)
            # 短句被補過靜音（為了餵對嘴模型），鏡頭只取到講完話＋0.15 秒，不然每句講完都會空一拍
            sd = ROOT / "audio" / "speech_dur.json"
            if sd.exists():
                spoken = json.loads(sd.read_text()).get(sh["id"])
                if spoken and spoken + 0.15 < d:
                    # 但再短也要 1.5 秒：「我去。」這種兩字短句會縮成 0.68 秒，
                    # 觀眾根本來不及看清楚誰在講話（EP09 s17 踩過）
                    d = max(spoken + 0.15, 1.5)
        else:
            d = sh["dur"]
            vo = ROOT / "audio" / f"{sh['id']}.mp3"
            if sh.get("vo") and vo.exists():
                # 旁白比鏡頭長 → 鏡頭跟著拉長，否則字幕會溢出到下一鏡疊字（EP04 s01 踩過）
                d = max(d, dur(vo) + 0.25)
        out.append({"id": sh["id"], "type": sh["type"], "start": round(t, 3), "dur": round(d, 3), "end": round(t + d, 3)})
        t += d
    return out


if __name__ == "__main__":
    tl = build()
    for x in tl:
        print(f"{x['id']}  {x['type']:5s}  {x['start']:6.2f} → {x['end']:6.2f}  ({x['dur']:.2f}s)")
    print(f"總長 {tl[-1]['end']:.2f} 秒")
