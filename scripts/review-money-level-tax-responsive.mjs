import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve('art-review/money-level/tax-safe-frame-v2');
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try {
  for(const width of [1440,1320,1100,980,768,390]) for(const [label,value] of [['small-white',170000000],['largest-white',220000000],['max-fallback',950000000]]) {
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390,reducedMotion:'reduce'});
    await context.addInitScript(value=>{localStorage.setItem('gorani.money-level.snapshot.v1',JSON.stringify({brokerageValue:440000000,isaPrincipal:value,pensionPrincipal:0,updatedAt:new Date().toISOString()}));localStorage.setItem('gorani.money-level.settings.v1',JSON.stringify({leftStatue:'marble-bear',rightStatue:'gold-bear'}));},value);
    const page=await context.newPage();await page.goto(`${process.env.MONEY_LEVEL_QA_URL??'http://127.0.0.1:3001'}/money-level?time=day&weather=sunny`);
    await page.waitForFunction(()=>document.querySelector('.spine-forest-stage')?.dataset.ready==='true');await page.waitForFunction(()=>[...document.querySelectorAll('.house-art-image,.scene-background-current,.forest-statue')].every(i=>i.complete&&i.naturalWidth));
    if(width===390){const box=await page.locator('.forest-scene').boundingBox();for(let i=0;i<3;i++){await page.mouse.move(box.x+box.width-35,box.y+90);await page.mouse.down();await page.mouse.move(box.x+35,box.y+90,{steps:12});await page.mouse.up();}}
    const geometry=await page.evaluate(()=>{const h=document.querySelector('.house-tax'),g=window.__MONEY_LEVEL_DEBUG__.camera();return {art:h.dataset.art,x:(parseFloat(h.style.getPropertyValue('--house-x'))+g.cropX)/g.scale,y:(parseFloat(h.style.getPropertyValue('--house-y'))+parseFloat(h.style.getPropertyValue('--house-width'))*388/1536+g.cropY)/g.scale,mask:getComputedStyle(h.querySelector('img')).maskImage};});
    assert.ok(Math.abs(geometry.x-1246.884)<.01&&Math.abs(geometry.y-540.10661328125)<.01);assert.equal(geometry.mask,'none');
    const overlaps=await page.evaluate(()=>{const label=document.querySelector('.house-label-tax').getBoundingClientRect(),h=document.querySelector('.house-tax').getBoundingClientRect();const art=document.querySelector('.house-tax').dataset.art,minY=art==='tent-small'?224:art==='tent-large'?70:71;return label.bottom>h.top+minY*h.width/1536-8;});assert.equal(overlaps,false);
    const filename=`${label}-viewport-${width}.png`;await page.locator('.forest-scene').screenshot({path:path.join(out,filename)});results.push({width,label,...geometry,filename});await context.close();
  }
  await writeFile(path.join(out,'responsive-artwork-audit.json'),JSON.stringify(results,null,2));console.log('PASS: 18 tent/max responsive visual cases; fixed world contact at all six widths');
} finally {await browser.close();}
