import assert from 'node:assert/strict';
import { T } from '../game/src/models.js';
import { Vehicle, TrafficSystem } from '../game/src/vehicles.js';
import { roadRoute, segmentBox, seeded, dist } from '../game/src/math.js';
import { MissionDirector, STORY, SideActivities } from '../game/src/missions.js';
import { PoliceDispatch } from '../game/src/police.js';
import { SaveStore, freshSave, purchase } from '../game/src/progression.js';
import { CombatSystem } from '../game/src/combat.js';
import { CityWorld } from '../game/src/world.js';

const checks=[];
function check(name,fn){fn();checks.push(name);console.log('PASS',name);}
const clearWorld={move(p,x,z){p.x+=x;p.z+=z;return false;},visible:()=>true,route:roadRoute};
check('seeded city input is repeatable',()=>{const a=seeded(99),b=seeded(99);for(let i=0;i<100;i++)assert.equal(a(),b());});
check('building line of sight blocks only intersecting segments',()=>{const box={x:0,z:0,w:10,d:10};assert(segmentBox({x:-12,z:0},{x:12,z:0},box));assert(!segmentBox({x:-12,z:8},{x:12,z:8},box));assert(segmentBox({x:0,z:0},{x:0,z:9},box));});
check('road routes stay axis aligned between street anchors',()=>{for(const [a,b]of [[{x:303,z:25},{x:185,z:72}],[{x:100,z:-170},{x:300,z:300}],[{x:-200,z:180},{x:15,z:-76}]]){const path=roadRoute(a,b);assert.deepEqual(path.at(-1),b);for(let i=1;i<path.length-1;i++)assert(Math.abs(path[i].x-path[i-1].x)<.01||Math.abs(path[i].z-path[i-1].z)<.01);}});
check('container geometry leaves the convoy lane and manifest accessible',()=>{
  const world=Object.create(CityWorld.prototype);world.colliders=[];world.scene=new T.Scene();world.box=()=>{};world.cylinder=()=>{};world.building=()=>{};
  const drawing=new Proxy({measureText:()=>({width:1})},{get:(target,key)=>target[key]||(()=>{})});
  const previous=globalThis.document;globalThis.document={createElement:()=>({width:1,height:1,getContext:()=>drawing})};
  try{world.createPort();}finally{globalThis.document=previous;}
  for(let z=202;z<299;z++)assert(!world.blocked({x:203,z},1.55),'Dock Road at '+z);
  assert(!world.blocked({x:238,z:253},.42));
});
check('a moving convoy does not route backward to its previous junction',()=>{
  const v=new Vehicle(new T.Scene(),'convoy','truck',203,267,0,'convoy');v.speed=11;
  TrafficSystem.prototype.wanderNext.call({random:()=>.1},v);assert(v.path.length);assert(v.path[0].z<v.z);assert(Math.abs(v.path[0].x-v.x)<1);
});
check('three vehicle archetypes have distinct handling and measured upgrades',()=>{
  const scene=new T.Scene(),coupe=new Vehicle(scene,'c','coupe',0,0),van=new Vehicle(scene,'v','van',0,0),stock=new Vehicle(scene,'s','sedan',0,0),tuned=new Vehicle(scene,'t','sedan',0,0);
  for(let i=0;i<600;i++){coupe.updatePhysics(1/60,clearWorld,{throttle:1,steer:0});van.updatePhysics(1/60,clearWorld,{throttle:1,steer:0});stock.updatePhysics(1/60,clearWorld,{throttle:1,steer:0});tuned.updatePhysics(1/60,clearWorld,{throttle:1,steer:0},{turbo:true});}
  assert(coupe.speed>stock.speed&&stock.speed>van.speed);assert(tuned.speed>=stock.speed*1.19);
  const a=new Vehicle(scene,'a','sedan',0,0),b=new Vehicle(scene,'b','sedan',0,0);a.speed=b.speed=12;a.updatePhysics(.2,clearWorld,{steer:1});b.updatePhysics(.2,clearWorld,{steer:1},{grip:true});assert(b.a>a.a*1.17);
  const wall={move:()=>true},c=new Vehicle(scene,'x','coupe',0,0),d=new Vehicle(scene,'y','coupe',0,0);c.speed=d.speed=20;c.updatePhysics(.1,wall,{});d.updatePhysics(.1,wall,{},{armor:true});assert(c.health<d.health);assert(c.speed<0);console.log('  measured top speeds m/s:',coupe.speed,stock.speed,van.speed,tuned.speed);
});
check('reinforced chassis also reduces actual vehicle collision damage',()=>{
  function impact(armor){const g=stubGame();Object.assign(g.player,{x:0,z:0});g.save.upgrades.armor=armor;const car=g.traffic.add('coupe',0,0,0,'parked'),other=g.traffic.add('patrol',0,2,Math.PI,'patrol');g.player.car=car;car.speed=20;other.speed=15;g.police={level:3,crime(){}};g.effects.impact=()=>{};g.audio.hit=()=>{};TrafficSystem.prototype.collisions.call({cars:g.traffic.cars,world:clearWorld},g);return car.maxHealth-car.health;}
  assert(Math.abs(impact(true)/impact(false)-1/1.7)<1e-9);
});
check('a heavy cargo truck takes less collision damage than the lighter vehicle it hits',()=>{const g=stubGame();Object.assign(g.player,{x:0,z:0});const a=g.traffic.add('truck',0,0,0,'parked'),b=g.traffic.add('sedan',0,2,Math.PI,'parked');a.speed=b.speed=15;g.police={level:0};g.effects.impact=()=>{};TrafficSystem.prototype.collisions.call({cars:g.traffic.cars,world:clearWorld},g);assert(a.maxHealth-a.health<b.maxHealth-b.health);});
check('save validation rejects malformed versions and clamps imported values',()=>{const store=new SaveStore();assert.throws(()=>store.validate({version:5}));const raw=freshSave();raw.money=-5;raw.chapter=50;raw.x=99999;raw.caches=[-1,0,2,50];const s=store.validate(raw);assert.equal(s.money,0);assert.equal(s.chapter,5);assert.equal(s.x,386);assert.deepEqual(s.caches,[0,2]);});
check('save validation preserves the zero coordinates of Civic Mile',()=>{const raw=freshSave();raw.x=0;raw.z=0;const s=new SaveStore().validate(raw);assert.equal(s.x,0);assert.equal(s.z,0);});
function stubGame(){
  const scene=new T.Scene();return {time:0,save:freshSave(),player:{x:286,z:28,hp:100,armor:0,car:null},traffic:{cars:[],add(type,x,z,a,role,color){const v=new Vehicle(scene,'test'+this.cars.length,type,x,z,a,role,color);this.cars.push(v);return v;},wanderNext(){}},world:clearWorld,render:{scene,yaw:0,shake:0},people:{people:[],contact:{x:286,z:18},guards(points){const a=points.map(([x,z])=>({x,z,hp:80,model:{group:new T.Group()}}));this.people.push(...a);return a;},add(){}},combat:{weapon:'fists',ammo:{pistol:72,smg:112},mag:{pistol:12,smg:28}},input:{down:()=>false},effects:{tracer(){}},audio:{checkpoint(){},pickup(){},success(){},alert(){},hit(){}},ui:{shopMessage:'',showShop(){}},closeMenu(){},toast(){},speech(){},saveProgress(){return true;},recordEvent(){},defeat(){throw Error('Unexpected defeat');},menu:null};
}
check('all five jobs have real stage transitions, payment and unlocks',()=>{
  const g=stubGame();g.police={level:0,seen:false,crime(n){this.level=Math.ceil(n);},clear(){this.level=0;}};g.missions=new MissionDirector(g);
  for(let i=0;i<STORY.length;i++){
    const before=g.save.money;g.missions.start(i);const m=g.missions;let count=0;
    while(m.active&&count++<30){const s=m.stage;
      if(s.target){g.player.x=s.target.x;g.player.z=s.target.z;}
      if(s.kind==='pickup'){g.player.car=null;assert(m.interact());}
      if(s.kind==='vehicle'){g.player.car=g.traffic.add('coupe',294,17,0,'parked');m.update(.1);}
      if(s.kind==='deliver'){g.police.level=0;g.player.car=s.car?(g.traffic.cars.find(v=>v.missionTag===s.tag)||g.traffic.add('sedan',185,72,0,'parked')):null;assert(m.interact());}
      if(s.kind==='steal'){g.player.car=g.traffic.cars.find(v=>v.missionTag===s.tag);assert(g.player.car);m.update(.1);}
      if(s.kind==='escape'){g.police.level=0;if(s.tag)g.player.car=g.traffic.cars.find(v=>v.missionTag===s.tag);m.elapsed=2;m.update(.1);}
      if(s.kind==='travel')m.update(.1);
      if(s.kind==='guards'){m.guards.forEach(p=>p.hp=0);m.update(.1);}
      if(s.kind==='hack'){g.player.car=null;g.input.down=()=>true;for(let j=0;j<185&&m.stage===s;j++)m.update(1/60);g.input.down=()=>false;}
      if(s.kind==='disable'){const v=m.target;v.health=v.maxHealth*.35;m.update(.1);}
    }
    assert(!m.active,'Job '+i+' terminates');assert.equal(g.save.chapter,i+1);assert.equal(g.save.money,before+STORY[i].reward);
  }
  assert(g.save.completed);
});
check('failed jobs keep completed progress and retry from their briefing',()=>{const g=stubGame();g.police={crime(){},clear(){}};g.missions=new MissionDirector(g);g.save.chapter=3;g.missions.start(3);g.missions.elapsed=211;g.missions.update(.1);assert(g.missions.failed);assert.equal(g.save.chapter,3);g.missions.retry();assert(!g.missions.failed);assert.equal(g.missions.stageIndex,0);});
check('archive cutoff gives reaction time and the crew bypass restores getaway condition',()=>{
  const g=stubGame();g.police={crime(){}};const m=new MissionDirector(g);g.missions=m;m.start(4);const truck=m.target;truck.health=100;m.update(.1);assert.equal(m.stage.kind,'steal');assert(g.combat.cooldown>=.8);truck.health=32;g.player.car=truck;m.update(.1);assert.equal(m.stage.kind,'escape');assert.equal(truck.health,truck.maxHealth*.78);
});
check('police tiers dispatch pursuit, cordon and air search, then permit a hidden escape',()=>{
  for(const tier of [1,3,5]){
    const g=stubGame();g.world={...clearWorld,visible:()=>false};g.player.car={a:0,speed:0};g.player.speed=0;g.police=new PoliceDispatch(g.render.scene);g.police.game=g;g.police.crime(tier,'test crime');let cordon=false,air=false;
    for(let i=0;i<3000;i++){g.time+=1/60;g.police.update(1/60,g);cordon ||= g.police.units.some(c=>c.task==='CORDON');air ||= g.police.heli.group.visible;}
    assert.equal(g.police.level,0,'tier '+tier+' clears');assert(g.police.eventLog.some(e=>e.event==='dispatched'));if(tier>=3)assert(cordon);if(tier>=4)assert(air);assert.equal(g.save.stats.escapes,1);
  }
});
check('patrol recognition uses direction outside close range',()=>{
  const g=stubGame();g.player.x=0;g.player.z=0;g.player.car={a:0,speed:10};const dispatch=new PoliceDispatch(g.render.scene);g.police=dispatch;dispatch.game=g;dispatch.score=2;dispatch.level=2;dispatch.spawnClock=999;
  const car=g.traffic.add('patrol',0,-50,0,'patrol');car.unitName='TEST';car.occupant='officer';car.repath=1;car.footTimer=1;dispatch.units=[car];dispatch.update(1/60,g);assert(!dispatch.seen,'behind a distant patrol');car.a=Math.PI;dispatch.update(1/60,g);assert(dispatch.seen,'in front of the patrol');
});
check('low-tier patrol brakes instead of repeatedly rear-ending a stopped car',()=>{
  const g=stubGame();g.player.x=0;g.player.z=0;g.player.car={a:0,speed:0};const dispatch=new PoliceDispatch(g.render.scene);g.police=dispatch;dispatch.game=g;dispatch.score=2;dispatch.level=2;dispatch.spawnClock=999;
  const car=g.traffic.add('patrol',0,8,0,'patrol');car.unitName='TEST';car.occupant='officer';car.speed=20;car.repath=1;car.footTimer=1;dispatch.units=[car];dispatch.update(1/60,g);assert(car.speed<19.4,'close-following braking changes physical speed');
});
check('arrest requires a living officer within reach, not a nearby empty patrol',()=>{
  const g=stubGame();Object.assign(g.player,{x:0,z:0,speed:0,arrest:0});let arrested=false;g.defeat=()=>{arrested=true;};
  const dispatch=new PoliceDispatch(g.render.scene);g.police=dispatch;dispatch.game=g;dispatch.score=1;dispatch.level=1;dispatch.report=20;dispatch.spawnClock=999;
  const car=g.traffic.add('patrol',0,2,0,'patrol');Object.assign(car,{unitName:'TEST',occupant:'officer',repath:1,footTimer:999});dispatch.units=[car];
  for(let i=0;i<210;i++)dispatch.update(1/60,g);assert(!arrested);
  g.people.people.push({x:0,z:2,hp:80,role:'officer'});for(let i=0;i<190;i++)dispatch.update(1/60,g);assert(arrested);
});
check('shop charges once and upgrades gameplay state',()=>{const g=stubGame();g.police={level:0,seen:false};g.save.money=2000;g.menu='garage';purchase(g,'grip');assert(g.save.upgrades.grip);assert.equal(g.save.money,1550);purchase(g,'grip');assert.equal(g.save.money,1550);g.player.car=g.traffic.add('sedan',0,0,0,'parked');g.player.car.health=2;purchase(g,'repair');assert.equal(g.player.car.health,g.player.car.maxHealth);});
check('clinic, ammunition, weapon and unseen-plate purchases change the promised inventory',()=>{const g=stubGame();g.police={level:0,seen:false};g.save.money=5000;g.menu='clinic';g.player.hp=10;purchase(g,'heal');purchase(g,'vest');assert.equal(g.player.hp,100);assert.equal(g.player.armor,100);g.menu='arms';purchase(g,'pistolAmmo');purchase(g,'smg');purchase(g,'smgAmmo');assert.equal(g.combat.ammo.pistol,120);assert.equal(g.combat.ammo.smg,308);assert.equal(g.combat.weapon,'smg');g.player.car=g.traffic.add('van',0,0,0,'parked');g.menu='garage';g.police={score:5,level:5,seen:true,unseen:0};const balance=g.save.money;purchase(g,'plates');assert.equal(g.save.money,balance);g.police.seen=false;purchase(g,'plates');assert.equal(g.police.score,3);assert.equal(g.save.money,balance-350);});
check('armor absorbs damage and defeat fires at zero health',()=>{const g=stubGame(),c=new CombatSystem();c.game=g;g.player.armor=100;c.damagePlayer(20,'test');assert.equal(g.player.armor,86);assert.equal(g.player.hp,94);let defeated=false;g.defeat=()=>{defeated=true;};g.player.hp=1;g.player.armor=0;c.damagePlayer(20,'test');assert(defeated);});
check('cargo armor resists patrol rounds while retaining vehicle and occupant damage',()=>{const g=stubGame(),c=new CombatSystem();c.game=g;const truck=g.traffic.add('truck',0,0,0,'parked');g.player.car=truck;c.damagePlayer(30,'Patrol fire');assert(Math.abs(truck.maxHealth-truck.health-8.4)<1e-9);assert(Math.abs(g.player.hp-97.6)<1e-9);});
check('repeatable race has checkpoints, reward and a persistent best time',()=>{const g=stubGame();g.missions={active:false};g.player.car={};const a=new SideActivities(g);a.start('race');for(let i=0;i<4;i++){Object.assign(g.player,a.target);a.update(10);}assert.equal(a.active,null);assert.equal(g.save.money,800);assert.equal(g.save.bestRace,40);assert.equal(g.save.stats.activities,1);});
console.log(JSON.stringify({passed:checks.length,checks}));
