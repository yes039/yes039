# usage: fitpdf.py index.html base.css width out_html
import sys,subprocess,re,os,json
idx,basecss,width,out=sys.argv[1],sys.argv[2],int(sys.argv[3]),sys.argv[4]
s=open(idx,encoding='utf8').read(); css=open(basecss,encoding='utf8').read()
# strip any @page rules and min-height/page-break rules from base css
css=re.sub(r'@page[^{]*\{[^}]*\}','',css)
extra=f'''<style>@page{{margin:0}}
html,body{{background:#fbf6ec!important;margin:0!important;padding:0!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.pages{{display:block!important;gap:0!important}}
.page{{width:{width}px!important;max-width:{width}px!important;min-height:0!important;box-shadow:none!important;break-before:page;page-break-before:always;overflow:visible!important}}
.page:first-child{{break-before:auto}}
</style>'''
d=os.path.dirname(os.path.abspath(idx))
tmp=os.path.join(d,'_m.html')
open(tmp,'w',encoding='utf8').write('<!doctype html><html><head><meta charset="utf-8"></head><body>'+s+css+extra+'</body></html>')
probe=os.path.join(d,'_probe.html')
open(probe,'w').write(f'<html><body style="margin:0"><iframe id="f" src="_m.html" style="width:{width}px;height:40000px;border:0"></iframe><script>setTimeout(()=>{{const d=document.getElementById("f").contentDocument;document.body.setAttribute("data-h",JSON.stringify([...d.querySelectorAll(".page")].map(p=>Math.ceil(p.getBoundingClientRect().height))))}},5000)</script></body></html>')
C='/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
dom=subprocess.run([C,'--headless','--no-sandbox','--disable-gpu','--allow-file-access-from-files','--virtual-time-budget=10000','--dump-dom','file://'+probe],capture_output=True,text=True).stdout
hs=json.loads(re.search(r'data-h="([^"]*)"',dom).group(1).replace('&quot;','"'))
rules=''.join(f'@page pg{i}{{size:{width}px {h+2}px;margin:0}}\n.page:nth-of-type({i+1}){{page:pg{i}}}\n' for i,h in enumerate(hs))
open(out,'w',encoding='utf8').write('<!doctype html><html><head><meta charset="utf-8"></head><body>'+s+css+extra+'<style>'+rules+'</style></body></html>')
os.remove(tmp); os.remove(probe); print(hs)
