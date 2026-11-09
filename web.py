#!/usr/bin/env python3
"""
web.py - Roblox-NameBotin selainkäyttöliittymä.

Käynnistä tuplaklikkaamalla Aja.bat (tai: py web.py). Selain aukeaa
osoitteeseen http://localhost:8765, jossa kirjoitat genren ja saat nimet.
Haut tehdään tällä koneella, joten ikkuna pitää pitää auki ajon ajan.
Vain Pythonin vakiokirjasto.
"""

import json
import os
import re
import sys
import threading
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import roblox_nimet as rn  # noqa: E402

PORT = 8765
HERE = os.path.dirname(os.path.abspath(__file__))

job = {"running": False, "phase": "", "done": 0, "total": 0, "found": 0,
       "genre": "", "result": None, "error": None, "file": None}
lock = threading.Lock()


def run_job(genre, limit, fresh):
    slug = re.sub(r"\W+", "_", genre)
    cache = os.path.join(HERE, f"cache_{slug}.json")
    try:
        if fresh and os.path.exists(cache):
            os.remove(cache)

        def progress(phase, done, total, found):
            with lock:
                job.update(phase=phase, done=done, total=total, found=found)

        suggestions, games = rn.collect(genre, 10, limit, cache, progress=progress)
        if not suggestions and not games:
            raise RuntimeError("Robloxista ei saatu dataa. Tarkista nettiyhteys - "
                               "Roblox on voinut myös muuttaa hakurajapintaa.")
        result, report = rn.analyze(genre, suggestions, games, 10, 25)
        fname = os.path.join(HERE, f"roblox_nimet_{slug}.txt")
        with open(fname, "w", encoding="utf-8") as f:
            f.write(report)
        with lock:
            job.update(result=result, file=os.path.basename(fname))
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        with lock:
            job["error"] = str(e)
    finally:
        with lock:
            job["running"] = False


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # hiljainen loki
        pass

    def send(self, code, body, ctype="application/json"):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype + "; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/":
            self.send(200, PAGE, "text/html")
        elif self.path == "/status":
            with lock:
                self.send(200, json.dumps(job))
        else:
            self.send(404, "{}")

    def do_POST(self):
        if self.path != "/start":
            return self.send(404, "{}")
        n = int(self.headers.get("Content-Length") or 0)
        try:
            req = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return self.send(400, json.dumps({"error": "virheellinen pyyntö"}))
        genre = " ".join(str(req.get("genre", "")).lower().split())
        limit = max(50, min(int(req.get("hakuja") or 1000), 5000))
        if not genre:
            return self.send(400, json.dumps({"error": "Kirjoita genre"}))
        with lock:
            if job["running"]:
                return self.send(409, json.dumps({"error": "Haku on jo käynnissä"}))
            job.update(running=True, phase="haut", done=0, total=limit, found=0,
                       genre=genre, result=None, error=None, file=None)
        threading.Thread(target=run_job, args=(genre, limit, bool(req.get("uusi"))),
                         daemon=True).start()
        self.send(200, json.dumps({"ok": True}))


PAGE = r"""<!DOCTYPE html>
<html lang="fi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Roblox-NameBot</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--ink:#16181d;--mute:#6b7280;--line:#e5e7eb;--acc:#00a2ff;--acc2:#0077cc}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,Segoe UI,sans-serif;background:var(--bg);color:var(--ink)}
main{max-width:900px;margin:0 auto;padding:28px 18px 60px}
h1{font-size:26px;margin:0 0 4px}p.sub{color:var(--mute);margin:0 0 22px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:16px}
form{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
input[type=text]{flex:1;min-width:200px;font-size:17px;padding:11px 13px;border:1px solid var(--line);border-radius:10px}
select{font-size:15px;padding:10px;border:1px solid var(--line);border-radius:10px;background:#fff}
button{font-size:16px;font-weight:600;padding:11px 20px;border:0;border-radius:10px;background:var(--acc);color:#fff;cursor:pointer}
button:hover{background:var(--acc2)}button:disabled{opacity:.5;cursor:default}
label.chk{color:var(--mute);font-size:14px;display:flex;gap:6px;align-items:center}
.bar{height:10px;background:var(--line);border-radius:6px;overflow:hidden;margin:10px 0 6px}
.bar>div{height:100%;width:0;background:var(--acc);transition:width .4s}
.mute{color:var(--mute);font-size:14px}.err{color:#b91c1c;font-weight:600}
h2{font-size:17px;margin:0 0 12px}
ol.names{margin:0;padding:0;list-style:none;counter-reset:n}
ol.names li{display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--line);counter-increment:n}
ol.names li:before{content:counter(n);color:var(--mute);width:22px;text-align:right;font-size:13px}
ol.names .nm{flex:1;font-weight:600;font-size:16px}
ol.names li:first-child .nm{color:var(--acc2);font-size:18px}
.copy{background:none;color:var(--acc2);border:1px solid var(--line);font-size:13px;padding:5px 10px}
.copy:hover{background:var(--bg)}
.chips span{display:inline-block;background:var(--bg);border:1px solid var(--line);border-radius:20px;padding:3px 10px;margin:0 6px 6px 0;font-size:14px}
table{width:100%;border-collapse:collapse;font-size:14px}td{padding:6px 4px;border-bottom:1px solid var(--line)}
td.n{text-align:right;color:var(--mute);white-space:nowrap}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:700px){.grid{grid-template-columns:1fr}}
#out{display:none}
</style></head><body><main>
<h1>Roblox-NameBot</h1>
<p class="sub">Kirjoita pelisi genre. Botti tekee Robloxin hakuun satoja hakuja ja muodostaa niistä hakukoneoptimoidut nimiehdotukset.</p>

<div class="card">
<form id="f">
  <input type="text" id="genre" placeholder="esim. forest, horror, tower defense" autofocus>
  <select id="hakuja"><option value="300">300 hakua (nopea)</option><option value="1000" selected>1000 hakua</option><option value="2000">2000 hakua</option></select>
  <button id="go">Hae nimet</button>
  <label class="chk"><input type="checkbox" id="uusi"> Hae tuore data (ohita välimuisti)</label>
</form>
<div id="prog" style="display:none">
  <div class="bar"><div id="fill"></div></div>
  <div class="mute" id="ptxt"></div>
</div>
<div class="err" id="err"></div>
</div>

<div id="out">
  <div class="card"><h2>Nimiehdotukset</h2><ol class="names" id="names"></ol>
  <p class="mute" id="saved"></p></div>
  <div class="card"><h2>Avainsanat kuvaukseen</h2><div class="chips" id="kw"></div></div>
  <div class="grid">
    <div class="card"><h2>Suosituimmat haut</h2><table id="sug"></table></div>
    <div class="card"><h2>Top-pelit (pelaajia nyt)</h2><table id="games"></table></div>
  </div>
</div>
</main>
<script>
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let timer=null;

$('f').onsubmit=async e=>{
  e.preventDefault();$('err').textContent='';
  const genre=$('genre').value.trim(); if(!genre){$('err').textContent='Kirjoita genre';return;}
  const r=await fetch('/start',{method:'POST',body:JSON.stringify({genre,hakuja:+$('hakuja').value,uusi:$('uusi').checked})});
  const j=await r.json(); if(!r.ok){$('err').textContent=j.error||'Virhe';return;}
  $('out').style.display='none'; poll();
};

async function poll(){
  clearTimeout(timer);
  let s; try{s=await (await fetch('/status')).json();}catch(e){$('err').textContent='Yhteys katkesi - onko komentoikkuna vielä auki?';return;}
  $('go').disabled=s.running;
  if(s.running){
    $('prog').style.display='block';
    const pct=s.phase==='haut'?(s.total?s.done/s.total*95:0):95+(s.total?s.done/s.total*5:0);
    $('fill').style.width=pct.toFixed(1)+'%';
    $('ptxt').textContent=s.phase==='haut'
      ?`Haetaan "${s.genre}": ${s.done} / ${s.total} hakua · ${s.found} eri hakuehdotusta löydetty`
      :`Haetaan top-pelejä… (${s.done}/${s.total})`;
    timer=setTimeout(poll,700); return;
  }
  $('prog').style.display='none';
  if(s.error){$('err').textContent=s.error;return;}
  if(s.result) show(s.result,s.file);
}

function show(r,file){
  $('names').innerHTML=r.names.map(n=>`<li><span class="nm">${esc(n.name)}</span><button class="copy" data-n="${esc(n.name)}">Kopioi</button></li>`).join('');
  $('kw').innerHTML=r.keywords.map(k=>`<span>${esc(k.word)}</span>`).join('');
  $('sug').innerHTML=r.suggestions.slice(0,20).map(x=>`<tr><td>${esc(x.query)}</td><td class="n">#${x.rank} · ${x.hits} haussa</td></tr>`).join('');
  $('games').innerHTML=r.games.slice(0,15).map(g=>`<tr><td>${esc(g.name)}</td><td class="n">${g.players.toLocaleString('fi-FI')}</td></tr>`).join('')||'<tr><td class="mute">Ei pelidataa</td></tr>';
  $('saved').textContent=`${r.total_suggestions} eri hakuehdotusta analysoitu · tallennettu tiedostoon ${file}`;
  $('out').style.display='block';
  document.querySelectorAll('.copy').forEach(b=>b.onclick=()=>{navigator.clipboard.writeText(b.dataset.n);b.textContent='Kopioitu ✓';setTimeout(()=>b.textContent='Kopioi',1500);});
}
poll();
</script></body></html>"""


def main():
    url = f"http://localhost:{PORT}"
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        print(f"Roblox-NameBot on jo käynnissä: {url}")
        webbrowser.open(url)
        return
    print(f"Roblox-NameBot käynnissä: {url}")
    print("Pidä tämä ikkuna auki. Sulje painamalla Ctrl+C tai sulkemalla ikkuna.")
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
