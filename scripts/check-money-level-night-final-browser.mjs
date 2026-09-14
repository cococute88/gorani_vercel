import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
const base = process.env.MONEY_LEVEL_QA_URL ?? "http://127.0.0.1:3001";
const output = path.resolve(process.env.MONEY_LEVEL_QA_OUTPUT ?? path.join(tmpdir(), "money-level-night-final-raw/final"));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [], errors = [];
async function ready(p) {
  await p.waitForFunction(() => document.querySelector(".spine-forest-stage")?.dataset.ready === "true");
  await p.waitForFunction(() => [...document.querySelectorAll(".house-art-image,.scene-background-current")].every(i => i.complete && i.naturalWidth));
  await p.waitForTimeout(550);
}
try {
  for (const stage of ["current", "max"]) {
    const context = await browser.newContext({ viewport: { width: 1320, height: 900 }, reducedMotion: "reduce" });
    await context.addInitScript(stage => {
      localStorage.setItem("gorani.money-level.settings.v1", JSON.stringify({ leftStatue: "stone-bear", rightStatue: "gold-bear" }));
      if (stage === "max") localStorage.setItem("gorani.money-level.snapshot.v1", JSON.stringify({ brokerageValue: 950000000, isaPrincipal: 500000000, pensionPrincipal: 450000000, updatedAt: "2026-09-13T09:00:00.000Z" }));
    }, stage);
    const p = await context.newPage(); p.on("pageerror", e => errors.push(e.message));
    for (const weather of ["sunny", "cloudy", "rain", "thunderstorm"]) {
      await p.goto(`${base}/money-level?time=night&weather=${weather}`); await ready(p);
      await p.addStyleTag({ content: ".spine-forest-stage,.character-anchor{visibility:hidden!important}" });
      for (const mode of ["new-tuned", "old-crisp", "off"]) {
        await p.evaluate(({ mode, weather }) => {
          const filter = document.querySelector('filter:not([id$="-statue"])');
          const world = document.querySelector(".scene-world");
          if (mode === "new-tuned") window.nightReview = { html: filter.innerHTML, css: world.style.getPropertyValue("--money-level-house-lighting") };
          if (mode === "old-crisp") {
            const rgb = { sunny: [.70,.88,1.16], cloudy: [.686,.88,1.177], rain: [.665,.871,1.201], thunderstorm: [.637,.854,1.212] }[weather];
            const color = { sunny: "#486a87", cloudy: "#54718b", rain: "#4f6f8b", thunderstorm: "#476582" }[weather];
            const strength = { sunny: .05, cloudy: .065, rain: .07, thunderstorm: .075 }[weather];
            filter.innerHTML = `<feColorMatrix type="matrix" values="${rgb[0]} 0 0 0 0 0 ${rgb[1]} 0 0 0 0 0 ${rgb[2]} 0 0 0 0 0 1 0" result="houseBase"/><feFlood flood-color="${color}" result="ambientColor"/><feComposite in="houseBase" in2="ambientColor" operator="arithmetic" k1="1" result="ambientSurface"/><feComposite in="houseBase" in2="ambientSurface" operator="arithmetic" k2="${1-strength}" k3="${strength}"/>`;
            const saturation = { sunny: .83, cloudy: .714, rain: .697, thunderstorm: .681 }[weather];
            const brightness = { sunny: .67, cloudy: .643, rain: .61, thunderstorm: .549 }[weather];
            world.style.setProperty("--money-level-house-lighting", `brightness(${brightness}) saturate(${saturation}) contrast(1) sepia(0) hue-rotate(14deg) url(#${filter.id})`);
          }
          if (mode === "off") {
            filter.innerHTML = window.nightReview.html.split('<feComponentTransfer')[0];
            world.style.setProperty("--money-level-house-lighting", window.nightReview.css);
          }
        }, { mode, weather });
        await p.waitForTimeout(550);
        for (const kind of ["brokerage", "tax"]) await p.locator(`.house-${kind}`).screenshot({ path: path.join(output, `${stage}-${weather}-${mode}-${kind}.png`) });
        if (mode === "new-tuned") await p.locator(".forest-scene").screenshot({ path: path.join(output, `${stage}-${weather}-scene.png`) });
        results.push({ stage, weather, mode });
      }
      // Rasterize the actual production filter against the unfiltered source.
      await p.reload(); await ready(p);
      const alpha = await p.evaluate(async () => {
        const filter = document.querySelector('filter:not([id$="-statue"])').cloneNode(true); filter.id = "alpha-final";
        async function raster(off, protection = true) {
          const f = filter.cloneNode(true);
          if (!protection) f.querySelector('[result="practicalMask"] feFuncA').setAttribute("slope", "0");
          const shapes = [.25,.5,.75,1].map((a,i)=>`<rect x="${10.4+i*20}" y="10.4" width="14.4" height="32.4" fill="#477e67" opacity="${a}"/>`).join("") + '<rect x="10" y="47" width="28" height="8" fill="black"/><rect x="48" y="47" width="28" height="8" fill="#edb443"/>';
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64"><defs>${f.outerHTML}</defs><g ${off ? "" : 'filter="url(#alpha-final)"'}>${shapes}</g></svg>`;
          const i = new Image();i.src="data:image/svg+xml;base64,"+btoa(svg);await i.decode();
          const c=document.createElement("canvas");c.width=96;c.height=64;const ctx=c.getContext("2d");ctx.drawImage(i,0,0);return ctx.getImageData(0,0,96,64).data;
        }
        const source=await raster(true),final=await raster(false),unprotected=await raster(false,false);
        let alphaDelta=0,transparentTint=0,blackLift=0;
        for(let i=0;i<source.length;i+=4){alphaDelta=Math.max(alphaDelta,Math.abs(source[i+3]-final[i+3]));if(!source[i+3] && final.slice(i,i+4).some(Boolean))transparentTint++;if(source[i+3]===255 && !source[i]&&!source[i+1]&&!source[i+2])blackLift=Math.max(blackLift,final[i],final[i+1],final[i+2]);}
        const warm=(50*96+60)*4;
        return {alphaDelta,transparentTint,blackLift,warmRedGain:final[warm]-unprotected[warm],warmBlueGain:final[warm+2]-unprotected[warm+2]};
      });
      assert.ok(alpha.alphaDelta <= 1);assert.equal(alpha.transparentTint,0);assert.equal(alpha.blackLift,0);assert.ok(alpha.warmRedGain>alpha.warmBlueGain,"practical protection restores warm accents rather than a blue highlight");
      results.push({stage,weather,alpha});
    }
    await context.close();
  }
  const p = await browser.newPage({ viewport: { width: 1320, height: 900 }, reducedMotion: "reduce" });
  await p.addInitScript(() => localStorage.setItem("gorani.money-level.settings.v1",JSON.stringify({leftStatue:"stone-bear",rightStatue:"gold-bear"})));
  for (let level=0;level<20;level++) {
    await p.goto(`${base}/money-level?time=day&weather=sunny&houseAmbient=off`);
    await p.evaluate(level => localStorage.setItem("gorani.money-level.snapshot.v1",JSON.stringify({brokerageValue:level*50000000+25000000,isaPrincipal:100000000,pensionPrincipal:49000000,updatedAt:"2026-09-13T09:00:00.000Z"})),level);
    await p.reload();await ready(p);
    const art=await p.locator(".house-brokerage").evaluate(h=>({level:Number(h.dataset.level),art:h.dataset.art,composite:h.dataset.composite,src:h.querySelector("img").getAttribute("src")}));
    assert.equal(art.level,level);results.push({allStage:art});
    if([2,7,8,9,10,11,19].includes(level)) await p.locator(".forest-scene").screenshot({path:path.join(output,`stage-${level}-ambient-off.png`)});
  }
  await p.evaluate(()=>localStorage.removeItem("gorani.money-level.snapshot.v1"));
  const viewportReview=[];
  for(const width of [1440,1320,1100,980,768])for(const height of [760,1100]) {
    await p.setViewportSize({width,height});await p.goto(`${base}/money-level?time=day&weather=sunny&houseAmbient=off`);await ready(p);
    const geometry=await p.evaluate(()=>{
      const bg=document.querySelector(".scene-background-current").getBoundingClientRect();
      const scale=Math.max(bg.width/1683,bg.height/935),cropY=(935*scale-bg.height)/2;
      return [...document.querySelectorAll(".house-card")].map(h=>{const b=h.getBoundingClientRect();return{kind:h.classList.contains("house-brokerage")?"brokerage":"tax",x:(b.x+b.width/2-bg.x)/scale,y:(b.y+b.height/2-bg.y+cropY)/scale,width:b.width/scale};});
    });
    for(const h of geometry){const expected=h.kind==="brokerage"?[599.805,390.35,622.71]:[1258.884,449.905,521.73];[h.x,h.y,h.width].forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<.1));}
    for(const mode of ["new-anchor","old-anchor","house-off"]) {
      await p.evaluate(mode=>{const h=document.querySelector(".house-brokerage");if(mode==="new-anchor")window.newHousePosition={x:h.style.getPropertyValue("--house-x"),y:h.style.getPropertyValue("--house-y")};if(mode==="old-anchor"){const bg=document.querySelector(".scene-background-current").getBoundingClientRect(),scale=Math.max(bg.width/1683,bg.height/935);h.style.setProperty("--house-x",`${parseFloat(window.newHousePosition.x)-36*scale}px`);h.style.setProperty("--house-y",`${parseFloat(window.newHousePosition.y)+44*scale}px`);}if(mode==="house-off")h.style.visibility="hidden";},mode);
      await p.waitForTimeout(100);
      const clip=await p.evaluate(()=>{const bg=document.querySelector(".scene-background-current").getBoundingClientRect();const s=Math.max(bg.width/1683,bg.height/935),crop=(935*s-bg.height)/2;return{x:bg.x+345*s,y:bg.y+490*s-crop,width:360*s,height:240*s};});
      const file=`geometry-${width}-${height}-${mode}.png`;await p.screenshot({path:path.join(output,file),clip});viewportReview.push({width,height,mode,file});
    }
    results.push({viewport:{width,height},geometry});
  }
  const experiment=JSON.parse(await readFile("art-review/money-level/night-final/geometry-candidates.json","utf8"));
  const clear=experiment.filter(r=>r.dx===36&&r.dy===-44);assert.equal(clear.length,4);assert.ok(clear.every(r=>r.covered===0),"all four resolved Brokerage artwork silhouettes clear actual brown stump pixels");
  assert.deepEqual(errors,[]);
  await writeFile(path.join(output,"results.json"),JSON.stringify(results,null,2));
  await writeFile(path.join(output,"review.html"),`<!doctype html><meta charset="utf-8"><title>PR232 Final Night / Brokerage review</title><style>body{background:#19211f;color:#eee;font:14px system-ui;margin:20px}section{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}figure{margin:0}img{width:100%}figcaption{padding:8px}h2{font-size:18px}</style><h1>Night lighting — same new world anchor in every panel</h1>${["current","max"].flatMap(stage=>["brokerage","tax"].map(kind=>`<h2>${stage} ${kind}</h2>${["off","old-crisp","new-tuned"].map(mode=>`<section>${["sunny","rain","thunderstorm"].map(weather=>`<figure><figcaption>${mode} / Night ${weather}</figcaption><img src="${stage}-${weather}-${mode}-${kind}.png"></figure>`).join("")}</section>`).join("")}`)).join("")}<h1>Geometry — ambient OFF; House OFF / old / new anchor</h1>${[1440,1320,1100,980,768].flatMap(width=>[760,1100].map(height=>`<h2>${width}×${height}</h2><section>${["house-off","old-anchor","new-anchor"].map(mode=>`<figure><figcaption>${mode}</figcaption><img src="geometry-${width}-${height}-${mode}.png"></figure>`).join("")}</section>`)).join("")}<p>All 20 Brokerage stages resolve through existing art/fallbacks. No new artwork. Actual SVG alpha verified for all Night weather states. Physical Android regression NOT RUN.</p>`);
  console.log(JSON.stringify({status:"PASS",nightWeather:4,alphaFixtures:8,stageMappings:20,viewportRatios:10,protectedStumpPixels:clear[0].total,output}));
} finally { await browser.close(); }
