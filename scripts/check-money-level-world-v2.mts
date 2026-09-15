import assert from "node:assert/strict";
import { MoneyLevelSettingsSession, settingsCacheKey, LEGACY_SETTINGS_KEY, type SettingsCloud } from "../lib/money-level/settings-persistence";
import { houseTextDraftError, normalizeMoneyLevelSettings, resolveHouseText } from "../lib/money-level/settings";
import { CharacterActivityCoordinator } from "../lib/money-level/forest/activity-coordinator";
import { CEREMONY_SLOTS, CEREMONY_SLOT_IDS } from "../lib/money-level/forest/statue-view";
import { getActivityZone, resolveManualActivityIntent } from "../lib/money-level/forest/activity-zones";
import { getWaypoint, waypointPoint, imagePointToScene, scenePointToImage, isPointSafe, routeWaypoints, resolveDrop, setForestSceneViewport } from "../lib/money-level/forest/navigation";
import { houseWorldToViewport, HOUSE_WORLD_GEOMETRY, taxHouseLabelPoint } from "../lib/money-level/forest/house-geometry";

const stored = () => { const values = new Map<string,string>(), writes: string[] = []; return { values, writes,
  getItem: (key: string) => values.get(key) ?? null, setItem: (key: string,value: string) => { values.set(key,value); writes.push(key); } }; };
const legacy = normalizeMoneyLevelSettings({ leftStatue: "marble-bear", rightStatue: "gold-bear", brokerageYield: .07, brokerageCustomText: "곰라니의\n조기은퇴 기지", brokerageTextMode: "CUSTOM", taxTextMode: "CUSTOM", taxCustomText: "다람쥐 절세 연구소" });
const memory = stored(); memory.values.set(LEGACY_SETTINGS_KEY,JSON.stringify(legacy));
let remote: Partial<typeof legacy> | null = null, migrations = 0, saves = 0;
const cloud: SettingsCloud = { load: async () => remote, migrate: async settings => { migrations++; remote ??= settings; return remote; }, save: async patch => { saves++; remote = { ...remote, ...patch }; } };
const session = new MoneyLevelSettingsSession("user-a",memory,cloud,()=>{});
await assert.rejects(session.save(legacy),/not hydrated/);
assert.equal(memory.writes.length,0); assert.equal(saves,0);
await session.hydrate(); assert.deepEqual(session.state.settings,legacy); assert.equal(migrations,1);
await session.save({ ...legacy, retirementDate: "2035-01-01" }); assert.equal(remote?.retirementDate,"2035-01-01");
const reopened = new MoneyLevelSettingsSession("user-a",memory,cloud,()=>{}); await reopened.hydrate();
assert.equal(reopened.state.settings.leftStatue,"marble-bear"); assert.equal(reopened.state.settings.brokerageYield,.07); assert.equal(migrations,1);
const anotherBrowser = new MoneyLevelSettingsSession("user-a",stored(),cloud,()=>{}); await anotherBrowser.hydrate(); assert.deepEqual(anotherBrowser.state.settings,reopened.state.settings);
const userB = new MoneyLevelSettingsSession("user-b",memory,{...cloud,load:async()=>null},()=>{}); await userB.hydrate(); assert.equal(userB.state.settings.leftStatue,"none"); assert.equal(migrations,1);
const unavailable: SettingsCloud = { load: async()=>{throw Error("offline");},migrate:async()=>{throw Error("offline");},save:async()=>{throw Error("offline");} };
const offline = new MoneyLevelSettingsSession("user-a",memory,unavailable,()=>{}); await offline.hydrate(); assert.equal(offline.state.settings.rightStatue,"gold-bear");
await offline.save({ ...offline.state.settings,taxCustomText:"오프라인 절세 연구소" });
assert.ok(JSON.parse(memory.getItem(settingsCacheKey("user-a"))!).pending.taxCustomText);
remote = {...remote,brokerageYield:.09};
const online = new MoneyLevelSettingsSession("user-a",memory,cloud,()=>{}); await online.hydrate();
assert.equal(online.state.settings.taxCustomText,"오프라인 절세 연구소"); assert.equal(online.state.settings.brokerageYield,.09);
const deferred = stored(); let resolveRead!: (value: null)=>void;
const pending = new MoneyLevelSettingsSession("race",deferred,{ ...cloud, load:()=>new Promise(resolve=>{resolveRead=resolve;}) },()=>{});
const hydration = pending.hydrate(); await assert.rejects(pending.save(legacy),/not hydrated/); assert.equal(deferred.writes.length,0); resolveRead(null); await hydration;
assert.equal(deferred.writes.length,0,"empty Cloud does not cache defaults that could become a false legacy migration");
assert.equal(resolveHouseText(legacy,"brokerage","확장 오두막"),"곰라니의\n조기은퇴 기지");
assert.equal(resolveHouseText(legacy,"brokerage","다음 stage"),"곰라니의\n조기은퇴 기지");
assert.equal(resolveHouseText({...legacy,brokerageTextMode:"DEFAULT"},"brokerage","다음 stage"),"다음 stage");
const limited=normalizeMoneyLevelSettings({...legacy,brokerageCustomText:"가".repeat(50)+"\n둘째\n셋째",taxCustomText:"가".repeat(30)+"\n둘째"});
assert.equal(limited.brokerageCustomText,"가".repeat(50)+"\n둘째\n셋째"); assert.equal(limited.taxCustomText,"가".repeat(30)+"\n둘째");
for (const kind of ["brokerage","tax"] as const) {
  assert.equal(houseTextDraftError("가".repeat(12)+"\n"+"나".repeat(12),"",kind),"");
  assert.notEqual(houseTextDraftError("가".repeat(13),"",kind),"");
  assert.notEqual(houseTextDraftError("첫째\n둘째\n셋째","",kind),"");
  const existing="가".repeat(18)+"\n나".repeat(18); assert.equal(houseTextDraftError(existing,existing,kind),"");
}

const coordinator = new CharacterActivityCoordinator(async()=>{});
const occupy = (id:"gorani"|"daramji",slot:typeof CEREMONY_SLOT_IDS[number])=>{const assigned=coordinator.claimCeremony(id,slot); void coordinator.setCharacterActivity(id,"statue-ceremony"); return assigned;};
assert.equal(occupy("gorani","CEREMONY_LEFT_A"),"CEREMONY_LEFT_A");
assert.equal(occupy("daramji","CEREMONY_LEFT_B"),"CEREMONY_LEFT_B");
assert.equal(occupy("daramji","CEREMONY_LEFT_A"),"CEREMONY_LEFT_B");
assert.equal(occupy("daramji","CEREMONY_RIGHT"),"CEREMONY_RIGHT");
assert.equal(occupy("gorani","CEREMONY_RIGHT"),"CEREMONY_LEFT_B");
assert.equal(Object.values(coordinator.getCeremonyOwners()).filter(Boolean).length,2);
assert.equal(coordinator.getCeremonySlot("gorani"),"CEREMONY_LEFT_B");
await coordinator.setCharacterActivity("gorani","fishing"); assert.equal(coordinator.getCeremonySlot("gorani"),null);
occupy("gorani","CEREMONY_LEFT_A"); await coordinator.setCharacterActivity("gorani","bench-sit"); assert.equal(coordinator.getCeremonySlot("gorani"),null);
await coordinator.setCharacterActivity("daramji","roaming"); assert.equal(Object.values(coordinator.getCeremonyOwners()).filter(Boolean).length,0);

for(const width of [1440,1320,1100,980,768,390]) for(const height of [520,610]) {
  const layout=width===390?"mobile":"desktop",mobile=layout==="mobile",scene={width,height}; setForestSceneViewport(scene);
  for(const id of ["gorani","daramji"] as const) {
    for(const slot of CEREMONY_SLOT_IDS) {
      const config=CEREMONY_SLOTS[slot], anchor=imagePointToScene(config.anchor,layout);
      assert.ok(isPointSafe(anchor,layout,id),`${width} ${slot} anchor safe`);
      const result=resolveManualActivityIntent(anchor,resolveDrop(anchor,layout,id),layout,id,{left:"marble-bear",right:"gold-bear"});
      assert.equal(result?.zone.ceremonySlot,slot); assert.deepEqual(result?.point,anchor);
      const world=scenePointToImage(anchor,layout); assert.ok(Math.abs(world.x-config.anchor.x)<1e-7); assert.ok(Math.abs(world.y-config.anchor.y)<1e-7);
      assert.ok(routeWaypoints("path_center",config.waypoint,layout,id).length,`${width}/${height} ${id} reachable ${slot}`);
      if(slot === "CEREMONY_RIGHT") {
        const route=routeWaypoints("path_center",config.waypoint,layout,id).map(p=>p.id);
        assert.ok(route.includes("tax_front")&&route.includes("fence_opening")&&route.includes("right_grass"),"right path uses the VISUALLY removed fence opening");
      }
    }
    assert.ok(isPointSafe(imagePointToScene({x:450,y:606},layout),layout,id),"removed stump ground is walkable");
    assert.ok(isPointSafe(imagePointToScene({x:1270,y:575},layout),layout,id),"removed fence opening is walkable");
    assert.equal(isPointSafe(imagePointToScene({x:1410,y:523},layout),layout,id),false,"retained right stump is solid");
    for (const point of [{x:1280,y:600},{x:1400,y:620}])
      assert.equal(isPointSafe(imagePointToScene(point,layout),layout,id),false,"retained shoreline boulders are solid");
    for(const p of [{x:588,y:720},{x:1470,y:560},{x:1250,y:450},{x:1300,y:740}]) assert.equal(isPointSafe(imagePointToScene(p,layout),layout,id),false,"retained pedestal, house and pond blocked");
  }
  const tax=houseWorldToViewport("tax",scene,mobile); assert.ok(Math.abs(tax.width/tax.scale-HOUSE_WORLD_GEOMETRY.tax.width)<1e-7);
  for(const translation of [0,200,-200]) {const label=taxHouseLabelPoint(scene,mobile,translation); assert.ok(label.x+translation>=90 && label.x+translation<=width-90);}
}
setForestSceneViewport(null);
assert.equal(CEREMONY_SLOT_IDS.length,3); assert.equal(getActivityZone("CEREMONY_LEFT_B").animationByCharacter?.gorani,"ceremony_valentinesday");
console.log("PASS: hydration/migration/isolation/offline replay, labels, 3 slots/max 2, release, 12 projections and corridor connectivity. Live Cloud credentials NOT tested.");
