import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const out=path.resolve('art-review/money-level/tax-safe-frame-v2');
const base=process.env.MONEY_LEVEL_QA_URL??'http://127.0.0.1:3001';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[],errors=[],sections=[];
async function ready(page){await page.waitForFunction(()=>document.querySelector('.spine-forest-stage')?.dataset.ready==='true');await page.waitForFunction(()=>[...document.querySelectorAll('.house-art-image,.scene-background-current,.forest-statue')].every(i=>i.complete&&i.naturalWidth));}
async function old(page,time){
  const uri='data:image/webp;base64,'+execFileSync('git',['show',`372425e:public/money-level/art/background/forest-${time}-sunny-docked.webp`],{maxBuffer:10000000}).toString('base64');
  await page.evaluate(uri=>{const card=document.querySelector('.house-tax'),img=card.querySelector('img');card.classList.replace('house-composite-alpha','house-composite-masked');img.src=img.src.replace('-alpha-v2.webp','.webp');document.querySelector('.scene-background-current').src=uri;const g=window.__MONEY_LEVEL_DEBUG__.camera();document.querySelector('.house-label-tax').style.top=`${Math.max(32,Math.min(g.height-32,363*g.scale-g.cropY))}px`;},uri);await ready(page);
}
try{
  for(const width of [1440,1320,1100,980,768,390]){
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390,reducedMotion:'reduce'});
    await context.addInitScript(()=>localStorage.setItem('gorani.money-level.settings.v1',JSON.stringify({leftStatue:'marble-bear',rightStatue:'gold-bear'})));
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/money-level?time=day&weather=sunny`);await ready(page);
    if(width===390){
      await page.locator('.forest-scene').screenshot({path:path.join(out,'viewport-390-initial.png')});
      const box=await page.locator('.forest-scene').boundingBox();
      for(let i=0;i<3;i++){await page.mouse.move(box.x+box.width-35,box.y+90);await page.mouse.down();await page.mouse.move(box.x+35,box.y+90,{steps:12});await page.mouse.up();}
    }
    const geometry=await page.evaluate(()=>{const h=document.querySelector('.house-tax'),img=h.querySelector('img');return {x:h.style.getPropertyValue('--house-x'),y:h.style.getPropertyValue('--house-y'),width:h.style.getPropertyValue('--house-width'),mask:getComputedStyle(img).maskImage,overflow:getComputedStyle(h).overflow,layer:getComputedStyle(h.parentElement).zIndex,viewportOverflow:getComputedStyle(document.querySelector('.forest-scene')).overflow};});
    assert.equal(geometry.mask,'none');assert.equal(geometry.overflow,'visible');assert.equal(geometry.viewportOverflow,'hidden');
    const ground=await page.evaluate(()=>{const g=window.__MONEY_LEVEL_DEBUG__.camera(),h=document.querySelector('.house-tax');return {x:(parseFloat(h.style.getPropertyValue('--house-x'))+g.cropX)/g.scale,y:(parseFloat(h.style.getPropertyValue('--house-y'))+parseFloat(h.style.getPropertyValue('--house-width'))*388/1536+g.cropY)/g.scale};});
    assert.ok(Math.abs(ground.x-1246.884)<.01 && Math.abs(ground.y-540.10661328125)<.01);
    if(width===1320){await page.setViewportSize({width:980,height:900});await page.waitForTimeout(300);const resized=await page.evaluate(()=>{const g=window.__MONEY_LEVEL_DEBUG__.camera(),h=document.querySelector('.house-tax');return {x:(parseFloat(h.style.getPropertyValue('--house-x'))+g.cropX)/g.scale,y:(parseFloat(h.style.getPropertyValue('--house-y'))+parseFloat(h.style.getPropertyValue('--house-width'))*388/1536+g.cropY)/g.scale};});assert.ok(Math.abs(resized.x-ground.x)<.01 && Math.abs(resized.y-ground.y)<.01);await page.setViewportSize({width,height:900});await page.waitForTimeout(300);}
    await page.locator('.forest-scene').screenshot({path:path.join(out,`viewport-${width}.png`)});results.push({width,geometry,ground,resizeGroundInvariant:width===1320?'PASS':'covered by projection'});
    if(width===1320) for(let level=0;level<20;level++){
      await page.evaluate(value=>localStorage.setItem('gorani.money-level.snapshot.v1',JSON.stringify({brokerageValue:440000000,isaPrincipal:value,pensionPrincipal:0,updatedAt:new Date().toISOString()})),(level*.5+.25)*100000000);
      await page.reload();await ready(page);
      const resolved=await page.locator('.house-tax').evaluate(h=>({level:Number(h.dataset.level),art:h.dataset.art,composite:h.dataset.composite,src:h.querySelector('img').getAttribute('src')}));
      assert.equal(resolved.level,level);assert.equal(resolved.composite,'alpha');results.push({stageMapping:resolved});
    }
    await context.close();
  }
  for(const time of ['day','evening','night']) for(const [label,value] of [['current',140000000],['small-white',170000000],['largest-white',220000000],['colored',270000000],['max-fallback',950000000]]){
    const context=await browser.newContext({viewport:{width:1320,height:900},reducedMotion:'reduce'});
    await context.addInitScript(value=>{localStorage.setItem('gorani.money-level.snapshot.v1',JSON.stringify({brokerageValue:440000000,isaPrincipal:value,pensionPrincipal:0,updatedAt:new Date().toISOString()}));localStorage.setItem('gorani.money-level.settings.v1',JSON.stringify({leftStatue:'marble-bear',rightStatue:'gold-bear'}));},value);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(`${base}/money-level?time=${time}&weather=sunny`);await ready(page);
    const art=await page.locator('.house-tax').getAttribute('data-art');const name=`${label}-${time}`;
    await page.locator('.forest-scene').screenshot({path:path.join(out,`${name}-fixed.png`)});
    await page.locator('.house-tax').screenshot({path:path.join(out,`${name}-asset-fixed.png`)});
    await old(page,time);
    await page.locator('.forest-scene').screenshot({path:path.join(out,`${name}-old.png`)});
    await page.locator('.house-tax').screenshot({path:path.join(out,`${name}-asset-old.png`)});
    sections.push(`<h2>${label} / ${time} / ${art}</h2><div class="pair"><figure><img src="${name}-old.png"><figcaption>OLD radial mask</figcaption></figure><figure><img src="${name}-fixed.png"><figcaption>FIXED original RGB, full silhouette</figcaption></figure></div>`);
    results.push({label,time,value,art});await context.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile(path.join(out,'browser-audit.json'),JSON.stringify({results,errors,remoteCloud:'not tested; no signed-in credentials',physicalAndroid:'not tested'},null,2));
  await writeFile(path.join(out,'review.html'),`<!doctype html><meta charset="utf-8"><title>Tax clipping and safe-frame review</title><style>body{font:16px system-ui;margin:24px;background:#dae2d0}img{max-width:100%;width:100%}.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}figure{margin:0}h2{margin-top:36px}</style><h1>Tax safe-frame / mask correction</h1><p>Same world center, scale and lighting. Original sources are opaque; fixed assets have full-alpha subject cores and feathered ground only. Red: canvas; cyan: visual bounds; magenta: logical contact.</p>${[0,1,2,3].map(i=>`<img style="max-width:768px" src="safe-frame-${i}.jpg">`).join('')}<h2>Tax plot rock: local removal only</h2><div class="pair"><img src="tax-rock-before.png"><img src="tax-rock-after.png"></div>${sections.join('')}<h2>Responsive</h2>${[1440,1320,1100,980,768,390].map(w=>`<h3>${w}px</h3><img src="viewport-${w}.png">`).join('')}`);
  console.log(`PASS ${results.length} browser visual cases; review: ${out}`);
}finally{await browser.close();}
