// Read-only visual experiments with actual runtime assets and CSS masks.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
const output = path.resolve(process.env.MONEY_LEVEL_QA_OUTPUT ?? path.join(tmpdir(), "money-level-night-final-raw/experiments"));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1320, height: 900 } });
  await page.goto(`${process.env.MONEY_LEVEL_QA_URL ?? "http://127.0.0.1:3001"}/money-level?time=day&weather=sunny&houseAmbient=off`);
  const data = await page.evaluate(async () => {
    const load = async src => { const i = new Image(); i.src = src; await i.decode(); return i; };
    const bg = await load("/money-level/art/background/forest-day-sunny-docked.webp");
    const assets = [
      ["small", "brokerage-stage-35-40-small-cabin.webp", "masked", "cottage"],
      ["expanded", "brokerage-stage-40-45-expanded-cabin-alpha.webp", "alpha", "cottage"],
      ["proper", "brokerage-stage-45-50-proper-house.webp", "masked", "cottage"],
      ["fallback-camp", "tax-stage-10-15-camp-plus.webp", "masked", "camp"],
    ];
    const canvas = (w,h) => Object.assign(document.createElement("canvas"), {width:w,height:h});
    const painted = [];
    for (const [name, file, composite, family] of assets) {
      const image = await load(`/money-level/art/houses/${file}`);
      const c = canvas(623,416),ctx=c.getContext("2d"); ctx.drawImage(image,0,0,623,416);
      if(composite==="masked") {
        ctx.globalCompositeOperation="destination-in"; ctx.save();
        ctx.translate(623*.5,416*(family==="camp"?.61:.55));
        ctx.scale(623*(family==="camp"?.39:.49),416*(family==="camp"?.35:.47));
        const gradient=ctx.createRadialGradient(0,0,0,0,0,1); gradient.addColorStop(family==="camp"?.58:.67,"black");gradient.addColorStop(1,"transparent");
        ctx.fillStyle=gradient;ctx.fillRect(-3,-3,6,6);ctx.restore();
      }
      painted.push([name,c]);
    }
    const full=canvas(1683,935),ctx=full.getContext("2d");ctx.drawImage(bg,0,0);
    const master=ctx.getImageData(0,0,1683,935).data;
    // Actual brown stump silhouette in the source, excluding the nearby bench.
    const protectedPixels=[];
    for(let y=572;y<641;y++)for(let x=391;x<474;x++) {
      const p=(y*1683+x)*4;
      if(master[p]>master[p+1]*1.08 && master[p+1]>master[p+2]*1.13) protectedPixels.push([x,y]);
    }
    const records=[],images=[];
    for(const [name,sprite]of painted)for(const dx of [0, ...Array.from({length: 12}, (_, i) => 34 + i * 2)])for(const dy of [0, ...Array.from({length: 10}, (_, i) => -28 - i * 2)]){
      const layer=canvas(1683,935),lc=layer.getContext("2d");lc.drawImage(sprite,563.805+dx-622.71/2,434.35+dy-415.14/2,622.71,415.14);
      const pixels=lc.getImageData(0,0,1683,935).data;
      const covered=protectedPixels.filter(([x,y])=>pixels[(y*1683+x)*4+3]>25).length;
      records.push({name,dx,dy,covered,total:protectedPixels.length});
      if([0,36,48].includes(dx) && [0,-40,-44].includes(dy)) {
        ctx.clearRect(0,0,1683,935);ctx.drawImage(bg,0,0);ctx.drawImage(layer,0,0);
        const crop=canvas(900,600);crop.getContext("2d").drawImage(full,345,490,360,240,0,0,900,600);
        images.push({name:`geometry-${name}-${dx}-${dy}.png`,url:crop.toDataURL()});
        if(dx===36 && dy===-44) images.push({name:`geometry-full-${name}.png`,url:full.toDataURL()});
      }
    }
    ctx.clearRect(0,0,1683,935);ctx.drawImage(bg,0,0);
    const off=canvas(900,600);off.getContext("2d").drawImage(full,345,490,360,240,0,0,900,600);images.push({name:"geometry-house-off.png",url:off.toDataURL()});
    return {records,images};
  });
  for(const {name,url} of data.images) await writeFile(path.join(output,name),Buffer.from(url.split(",")[1],"base64"));
  await writeFile(path.join(output,"geometry-candidates.json"),"[\n"+data.records.map(r=>JSON.stringify(r)).join(",\n")+"\n]\n");
  const aggregate=data.records.filter(r=>r.name==="expanded").map(r=>({...r,maxCovered:Math.max(...data.records.filter(x=>x.dx===r.dx&&x.dy===r.dy).map(x=>x.covered))})).sort((a,b)=>a.maxCovered-b.maxCovered||Math.hypot(a.dx,a.dy)-Math.hypot(b.dx,b.dy));
  console.log(aggregate.slice(0,12));
} finally { await browser.close(); }
