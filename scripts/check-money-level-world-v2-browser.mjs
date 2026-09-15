import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
const base=process.env.MONEY_LEVEL_QA_URL??'http://127.0.0.1:3001';
const out=path.resolve('art-review/money-level/world-settings-v2');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],results=[];
const slots={CEREMONY_LEFT_A:{x:470,y:751.6},CEREMONY_LEFT_B:{x:694,y:736},CEREMONY_RIGHT:{x:1370,y:593}};
const seed={leftStatue:'marble-bear',rightStatue:'gold-bear',brokerageTextMode:'CUSTOM',brokerageCustomText:'곰라니의\n조기은퇴 기지',taxTextMode:'CUSTOM',taxCustomText:'다람쥐 절세 연구소'};
async function ready(page){
  await page.waitForFunction(()=>document.querySelector('.spine-forest-stage')?.dataset.ready==='true');
  await page.waitForFunction(()=>[...document.querySelectorAll('.house-art-image,.scene-background-current,.forest-statue')].every(i=>i.complete&&i.naturalWidth));
  await page.getByRole('button',{name:'설정 열기'}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('[aria-label="설정 열기"]').disabled);
}
async function drop(page,id,slot){
  await page.evaluate(({id,point})=>window.__MONEY_LEVEL_DEBUG__.dropCharacter(id,point),{id,point:slots[slot]});
  await page.waitForFunction(id=>window.__MONEY_LEVEL_DEBUG__.state()[id].phase==='statue-appreciation',id);
}
async function snapshot(page,name){await page.locator('.forest-scene').screenshot({path:path.join(out,name)});}
try{
  for(const width of [1440,1320,1100,980,768,390]){
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390,reducedMotion:'reduce'});
    await context.addInitScript(seed=>localStorage.setItem('gorani.money-level.settings.v1',JSON.stringify(seed)),seed);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/money-level?time=day&weather=sunny`);await ready(page);
    await snapshot(page,`viewport-${width}-custom.png`);
    const geometry=await page.evaluate(()=>{
      const scene=document.querySelector('.forest-scene'),s=scene.getBoundingClientRect();
      return {width:scene.clientWidth,height:scene.clientHeight,cameraMaxX:Number(scene.dataset.cameraMaxX),labels:[...document.querySelectorAll('.house-label')].map(label=>{
        const b=label.getBoundingClientRect(),strong=label.querySelector('strong'),title=label.querySelector('p');
        return {kind:label.dataset.houseLabel,left:b.left-s.left,right:b.right-s.left,top:b.top-s.top,bottom:b.bottom-s.top,text:strong.textContent,
          textOverflow:strong.scrollWidth>strong.clientWidth+1,titleOverflow:title.scrollWidth>title.clientWidth+1};
      })};
    });
    for(const label of geometry.labels){assert.equal(label.textOverflow,false);assert.equal(label.titleOverflow,false);assert.ok(label.top>=0);assert.ok(label.right<=geometry.width+3);assert.ok(label.left>=-1);}
    await page.getByRole('button',{name:'설정 열기'}).click();
    await page.getByRole('textbox',{name:'위탁집 커스텀 문구'}).fill(seed.brokerageCustomText);
    await page.getByRole('textbox',{name:'절세집 커스텀 문구'}).fill(seed.taxCustomText);
    await page.locator('.object-settings').first().locator('select').nth(0).selectOption('marble-bear');
    await page.locator('.object-settings').first().locator('select').nth(1).selectOption('gold-bear');
    await page.getByRole('button',{name:'저장',exact:true}).click();
    await page.reload();await ready(page);
    assert.equal(await page.locator('.house-label-brokerage strong').textContent(),seed.brokerageCustomText);
    assert.equal(await page.locator('.house-label-tax strong').textContent(),seed.taxCustomText);
    assert.equal(await page.locator('.forest-statue').count(),2);
    if(width===1320){
      // Both actors walk through the actual erased opening, using the real
      // behavior controller rather than teleporting to a debug anchor.
      for(const id of ['gorani','daramji']){
        await page.reload();await ready(page);
        assert.equal(await page.evaluate(id=>window.__MONEY_LEVEL_DEBUG__.startActivity(id,'CEREMONY_RIGHT'),id),true);
        const visited=new Set(),deadline=Date.now()+30000;
        while(Date.now()<deadline){
          const state=await page.evaluate(id=>window.__MONEY_LEVEL_DEBUG__.state()[id],id);
          visited.add(state.waypoint);
          if(state.phase==='statue-appreciation')break;
          await page.waitForTimeout(80);
        }
        assert.equal(await page.evaluate(id=>window.__MONEY_LEVEL_DEBUG__.state()[id].phase,id),'statue-appreciation');
        assert.ok(visited.has('fence_opening'),`${id} walks through erased fence opening`);
        results.push({rightPathfinding:id,visited:[...visited]});
        await snapshot(page,`right-walk-${id}.png`);
      }
      for(const [time,weather] of [['day','sunny'],['evening','sunny'],['night','sunny'],['day','rain']]){
        await page.goto(`${base}/money-level?time=${time}&weather=${weather}`);await ready(page);
        await snapshot(page,`scene-${time}-${weather}-after-fence.png`);
        const file=path.resolve(`private/money-level-world-v2-before-right-fence/public/money-level/art/background/forest-${time}-${weather}-docked.webp`);
        const data='data:image/webp;base64,'+(await readFile(file)).toString('base64');
        await page.locator('.scene-background-current').evaluate(async(node,src)=>{node.src=src;await node.decode();},data);
        await snapshot(page,`scene-${time}-${weather}-before-fence.png`);
      }
      await page.goto(`${base}/money-level?time=day&weather=sunny`);await ready(page);
      for(const [g,d] of [['CEREMONY_LEFT_A','CEREMONY_LEFT_B'],['CEREMONY_LEFT_A','CEREMONY_RIGHT'],['CEREMONY_LEFT_A','CEREMONY_LEFT_A'],['CEREMONY_RIGHT','CEREMONY_RIGHT']]){
        await drop(page,'gorani',g);await drop(page,'daramji',d);
        const state=await page.evaluate(()=>({owners:window.__MONEY_LEVEL_DEBUG__.ceremonyOwners(),actors:window.__MONEY_LEVEL_DEBUG__.state()}));
        assert.equal(Object.values(state.owners).filter(Boolean).length,2);
        assert.notDeepEqual(state.actors.gorani.position,state.actors.daramji.position);
        assert.equal(state.actors.gorani.animation,'ceremony_valentinesday');assert.equal(state.actors.daramji.animation,'ceremony_valentinesday');
        results.push({matrix:[g,d],...state});
        await snapshot(page,`ceremony-${g}-${d}.png`);
      }
      await drop(page,'gorani','CEREMONY_LEFT_A');await drop(page,'daramji','CEREMONY_RIGHT');
      for(const resized of [980,768,390,1320]){
        await page.setViewportSize({width:resized,height:900});await page.waitForTimeout(250);
        const values=await page.evaluate(()=>{const d=window.__MONEY_LEVEL_DEBUG__,g=d.camera();return {owners:d.ceremonyOwners(),points:Object.fromEntries(Object.entries(d.state()).map(([id,state])=>[id,{x:(state.position.x*g.width/100+g.cropX)/g.scale,y:(state.position.y*g.height/100+g.cropY)/g.scale}]))};});
        for(const [slot,id] of Object.entries(values.owners))if(id){assert.ok(Math.abs(values.points[id].x-slots[slot].x)<.1);assert.ok(Math.abs(values.points[id].y-slots[slot].y)<.1);}
        results.push({activeResize:resized,...values});
      }
      await drop(page,'gorani','CEREMONY_LEFT_A');
      await page.evaluate(()=>window.__MONEY_LEVEL_DEBUG__.startFishingAs('gorani'));
      await page.waitForFunction(()=>window.__MONEY_LEVEL_DEBUG__.state().gorani.phase==='fishing',null,{timeout:30000});
      assert.ok(!(await page.evaluate(()=>Object.values(window.__MONEY_LEVEL_DEBUG__.ceremonyOwners()))).includes('gorani'));
      await drop(page,'gorani','CEREMONY_LEFT_A');await page.evaluate(()=>window.__MONEY_LEVEL_DEBUG__.startBenchSitting('gorani'));
      await page.waitForFunction(()=>window.__MONEY_LEVEL_DEBUG__.state().gorani.phase==='bench-sit',null,{timeout:30000});
      assert.ok(!(await page.evaluate(()=>Object.values(window.__MONEY_LEVEL_DEBUG__.ceremonyOwners()))).includes('gorani'));
      await snapshot(page,'bench-release.png');
      // All twenty stages use the unchanged resolver/fallback artwork mapping.
      for(let stage=0;stage<20;stage++){
        await page.evaluate(stage=>localStorage.setItem('gorani.money-level.snapshot.v1',JSON.stringify({brokerageValue:427486959,isaPrincipal:stage*50000000+1000000,pensionPrincipal:0,updatedAt:'2026-09-14T00:00:00.000Z'})),stage);
        await page.reload();await ready(page);await snapshot(page,`tax-stage-${stage}.png`);
        results.push({taxStage:stage,art:await page.locator('.house-tax').getAttribute('data-art')});
      }
      await page.evaluate(()=>localStorage.removeItem('gorani.money-level.snapshot.v1'));await page.reload();await ready(page);
      await page.evaluate(()=>{
        const scene=document.querySelector('.forest-scene'),w=scene.clientWidth,h=scene.clientHeight,k=Math.max(w/1683,h/935),cx=(1683*k-w)/2,cy=(935*k-h)/2;
        const house=document.querySelector('.house-tax');house.style.setProperty('--house-x',`${1258.884*k-cx}px`);house.style.setProperty('--house-y',`${449.905*k-cy}px`);house.style.setProperty('--house-width',`${521.73*k}px`);
        const label=document.querySelector('.house-label-tax');label.style.left=`${1208.394*k-cx}px`;label.style.top=`${596.785*k-cy}px`;
        label.querySelector('p').innerHTML='절세 집 <small>Lv.3</small>';label.querySelector('strong').textContent='생활 소품이 놓인 캠프';
        const amount=document.createElement('b');amount.textContent='1.4억원';label.querySelector('.house-label-content').append(amount);
      });await snapshot(page,'tax-banner-old.png');await page.reload();await ready(page);await snapshot(page,'tax-banner-new.png');
    }
    if(width===390){
      await page.locator('.forest-scene').scrollIntoViewIfNeeded();
      const scene=await page.locator('.forest-scene').boundingBox();
      const cameraBefore=await page.evaluate(()=>window.__MONEY_LEVEL_DEBUG__.camera());
      await page.mouse.move(scene.x+scene.width-80,scene.y+100);await page.mouse.down();await page.mouse.move(scene.x+60,scene.y+100,{steps:10});await page.mouse.up();
      const cameraAfter=await page.evaluate(()=>window.__MONEY_LEVEL_DEBUG__.camera());assert.ok(cameraAfter.x>cameraBefore.x);assert.equal(cameraAfter.scale,cameraBefore.scale);
      await snapshot(page,'viewport-390-pan-right.png');
      const cdp=await context.newCDPSession(page);
      const send=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:/End|Cancel/.test(type)?[]:[{x,y,radiusX:8,radiusY:8,force:.6}]});
      const panTo=async master=>{
        for(let i=0;i<6;i++){
          const g=await page.evaluate(()=>window.__MONEY_LEVEL_DEBUG__.camera());const sx=master.x*g.scale-g.x;
          if(sx>45&&sx<g.width-45)return;
          const start=sx<45?65:g.width-65,end=sx<45?g.width-65:65;
          await send('touchStart',scene.x+start,scene.y+90);await send('touchMove',scene.x+end,scene.y+90);await send('touchEnd');
        }
      };
      // Actual browser touch long-press and edge auto-pan, both actors → RIGHT.
      for(const id of ['gorani','daramji']){
        const current=await page.evaluate(id=>{const d=window.__MONEY_LEVEL_DEBUG__,g=d.camera(),p=d.state()[id].position;return {x:(p.x*g.width/100+g.cropX)/g.scale,y:(p.y*g.height/100+g.cropY)/g.scale};},id);
        await panTo(current);
        const box=await page.locator(`#${id}-drag-target`).boundingBox();const start={x:box.x+box.width/2,y:box.y+box.height/2};
        await send('touchStart',start.x,start.y);await page.waitForTimeout(340);
        assert.equal(await page.locator('.forest-scene').getAttribute('data-pointer-owner'),'CHARACTER_DRAG');
        const initial=await page.evaluate(id=>{const d=window.__MONEY_LEVEL_DEBUG__,g=d.camera(),p=d.state()[id].position;return {x:p.x*g.width/100+g.cropX-g.x,y:p.y*g.height/100};},id);
        const offset={x:scene.x+initial.x-start.x,y:scene.y+initial.y-start.y};
        await send('touchMove',scene.x+scene.width-5,scene.y+260);
        for(let i=0;i<110;i++){
          const g=await page.evaluate(()=>window.__MONEY_LEVEL_DEBUG__.camera());const x=1370*g.scale-g.x;
          if(x>55&&x<g.width-35)break;await page.waitForTimeout(60);
        }
        const g=await page.evaluate(()=>window.__MONEY_LEVEL_DEBUG__.camera());
        await send('touchMove',scene.x+1370*g.scale-g.x-offset.x,scene.y+593*g.scale-g.cropY-offset.y);await send('touchEnd');
        await page.waitForFunction(id=>window.__MONEY_LEVEL_DEBUG__.state()[id].phase==='statue-appreciation',id,{timeout:30000});
        results.push({touchRight:id,owners:await page.evaluate(()=>window.__MONEY_LEVEL_DEBUG__.ceremonyOwners())});
        await snapshot(page,`390-touch-right-${id}.png`);
      }
      const tax=await page.locator('.house-label-tax').boundingBox();assert.ok(tax.x>=scene.x-1&&tax.x+tax.width<=scene.x+scene.width+1);
      results.push({mobilePan:{before:cameraBefore,after:cameraAfter},realAndroid:'NOT RUN'});
    }
    await page.goto(`${base}/portfolio`);await page.goto(`${base}/money-level?time=day&weather=sunny`);await ready(page);
    assert.equal(await page.locator('.forest-statue').count(),2);
    await page.close();const reopened=await context.newPage();await reopened.goto(`${base}/money-level?time=day&weather=sunny`);await ready(reopened);
    assert.equal(await reopened.locator('.house-label-tax strong').textContent(),seed.taxCustomText);
    await reopened.getByRole('button',{name:'설정 열기'}).click();
    for(const field of await reopened.locator('.house-text-settings select').all())await field.selectOption('DEFAULT');
    await reopened.getByRole('button',{name:'저장',exact:true}).click();await snapshot(reopened,`viewport-${width}-default.png`);
    assert.equal(await reopened.locator('.house-label-brokerage strong').textContent(),'확장 오두막');
    assert.equal(await reopened.locator('.house-label-tax strong').textContent(),'생활 소품이 놓인 캠프');
    results.push({viewport:width,...geometry,persistence:'reload/re-entry/tab reopen local PASS',cloud:'LIVE LOGIN/CROSS-SESSION NOT RUN'});
    await context.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile(path.join(out,'browser-results.json'),JSON.stringify({results,errors,cloud:'mock contract tests only; live Cloud not verified',android:'simulated CDP touch only'},null,2));
  console.log(`PASS ${results.length} results; screenshots in ${out}; live Cloud and real Android NOT RUN`);
}finally{await browser.close();}
