import { GameRenderer, Effects } from './renderer.js';
import { CityWorld, PLACES } from './world.js';
import { TrafficSystem } from './vehicles.js';
import { PlayerController, PeopleSystem } from './player.js';
import { PoliceDispatch } from './police.js';
import { CombatSystem } from './combat.js';
import { MissionDirector, SideActivities, STORY } from './missions.js';
import { SaveStore, freshSave } from './progression.js';
import { OriginalAudio } from './audio.js';
import { GameInput } from './input.js';
import { GameUI } from './ui.js';
import { WorldMarkers } from './markers.js';
import { dist, forward, clamp } from './math.js';

class CairnCoastGame {
  constructor() {
    this.time=0;this.started=false;this.menu='start';this.events=[];this.frameTimes=[];this.settings={quality:'auto',reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};
    this.input=new GameInput(document.getElementById('view'));this.audio=new OriginalAudio();this.store=new SaveStore();this.save=freshSave();
    this.render=new GameRenderer(document.getElementById('view'));this.world=new CityWorld(this.render.scene);this.effects=new Effects(this.render.scene);
    this.player=new PlayerController(this.render.scene);this.traffic=new TrafficSystem(this.render.scene,this.world);this.people=new PeopleSystem(this.render.scene);this.police=new PoliceDispatch(this.render.scene);this.combat=new CombatSystem();this.combat.game=this;
    this.missions=new MissionDirector(this);this.activities=new SideActivities(this);this.markers=new WorldMarkers(this);this.ui=new GameUI(this);
    this.toastTime=0;this.speechTime=0;this.skidClock=0;this.autoSave=0;this.ui.start();
    this.police.game=this;
    let last=performance.now();
    const frame=now=>{
      const elapsed=now-last;last=now;this.frameTimes.push(elapsed);if(this.frameTimes.length>1800)this.frameTimes.shift();
      const dt=Math.min(elapsed/1000,.25);this.handleKeys();
      if(this.started&&!this.menu){let remaining=dt;while(remaining>.0001){const step=Math.min(remaining,1/60);this.update(step);remaining-=step;}}
      if(this.settings.quality==='auto'&&this.frameTimes.length===20&&this.frameTimes.slice(-10).reduce((a,b)=>a+b,0)/10>65){this.render.quality('eco');this.recordEvent('adaptive-quality',{mode:'eco'});}
      this.render.update(dt,this);this.ui.update(dt);this.markers.update();this.input.end();requestAnimationFrame(frame);
    };requestAnimationFrame(frame);
    window.addEventListener('blur',()=>{if(this.started&&!this.menu)this.ui.pause();});
    document.getElementById('view').addEventListener('webglcontextlost',e=>{e.preventDefault();this.input.clear();this.ui.screen('error','<h1 class="menu-title">The graphics context stopped.</h1><p class="menu-sub">Reload this page and continue your local save. Performance quality uses fewer graphics resources.</p><button id="reload-page">Reload game</button>');document.getElementById('reload-page').onclick=()=>location.reload();});
    window.cairn=Object.freeze({snapshot:()=>this.snapshot()});
  }
  recordEvent(event,data={}) {this.events.push({time:Math.round(this.time*100)/100,event,...data});if(this.events.length>300)this.events.shift();}
  rankName(){return this.save.rep>=1200?'HARBOR LEGEND':this.save.rep>=650?'FIXER':this.save.rep>=250?'WHEELMAN':'LOCAL';}
  begin(load) {
    this.missions.cancel();this.police.clear();
    for(const c of this.traffic.cars)this.render.scene.remove(c.model.group);
    for(const p of this.people.people)this.render.scene.remove(p.model.group);
    this.render.scene.remove(this.player.model.group);this.render.scene.remove(this.police.heli.group);
    this.save=load&&this.store.cached?JSON.parse(JSON.stringify(this.store.cached)):freshSave();
    this.player=new PlayerController(this.render.scene);Object.assign(this.player,{x:this.save.x,z:this.save.z,hp:this.save.hp,armor:this.save.armor});
    if(this.world.blocked(this.player,.6)){this.player.x=286;this.player.z=28;}
    this.traffic=new TrafficSystem(this.render.scene,this.world);this.people=new PeopleSystem(this.render.scene);this.police=new PoliceDispatch(this.render.scene);this.police.game=this;this.combat=new CombatSystem();this.combat.game=this;this.combat.ammo={...this.save.ammo};
    this.missions=new MissionDirector(this);this.activities=new SideActivities(this);this.render.yaw=0;this.render.target.set(this.player.x,1.3,this.player.z);this.render.camera.position.set(this.player.x,7,this.player.z+13);
    this.started=true;this.time=0;this.closeMenu();this.audio.start();this.recordEvent(load?'continued':'new-story',{chapter:this.save.chapter});
    if(!load)this.missions.start(0);else this.speech('SORA • mechanic','Welcome back. Your completed jobs are safe. Call Inez from the map when you are ready.');
  }
  closeMenu(){this.menu=null;document.getElementById('screen').hidden=true;this.input.clear();this.audio.pause(false);}
  toast(text,seconds=3.5){const e=document.getElementById('toast');e.textContent=text;e.hidden=false;this.toastTime=seconds;}
  speech(name,text,seconds=9){document.getElementById('speaker').textContent=name;document.getElementById('dialogue').textContent=text;document.getElementById('speech').hidden=false;this.speechTime=seconds;}
  activeTarget(){return this.activities.target||this.missions.target;}
  handleKeys() {
    const k=this.input;
    if(this.menu==='defeat'||this.menu==='error')return;
    if(k.tap('Escape')){if(!this.started){this.ui.start();return;}if(this.menu)this.closeMenu();else this.ui.pause();return;}
    if(k.tap('KeyM')&&this.started){if(this.menu==='map')this.closeMenu();else this.ui.journal();return;}
    if(this.menu||!this.started)return;
    if(k.tap('KeyE')){if(this.player.car)this.exitCar();else this.enterCar();}
    if(k.tap('KeyF'))this.interact();
    if(k.tap('KeyQ'))this.combat.cycle(this);
    for(const [key,weapon]of [['Digit1','fists'],['Digit2','pistol'],['Digit3','smg']])if(k.tap(key)&&(weapon!=='smg'||this.save.upgrades.smg)){this.combat.reload=0;this.combat.weapon=weapon;}
    if(k.tap('KeyR'))this.combat.startReload(this);
    if(k.tap('Space')&&!this.player.car&&this.player.jump===0)this.player.jump=.7;
    if(k.tap('KeyC')){this.render.yaw=this.player.car?this.player.car.a:this.player.a;this.render.lookTime=0;}
    if(k.tap('KeyV')){this.audio.radio=!this.audio.radio;this.toast(this.audio.radio?'Radio Tern 92.4 tuned in.':'Radio off.');}
    if(k.tap('F5')&&this.saveProgress())this.toast('Progress saved on this device.');
  }
  nearbyVehicle() {
    const target=this.missions.stage?.kind==='steal'?this.missions.target:null;
    return target&&!target.destroyed&&dist(target,this.player)<5.5?target:this.traffic.nearest(this.player);
  }
  enterCar() {
    const p=this.player,car=this.nearbyVehicle();
    if(!car){this.toast('Get closer to a vehicle, then press E.');return;}
    if(Math.abs(car.speed)>11){this.toast('That vehicle is moving too fast to take.');return;}
    if(car.type==='truck'&&car.missionTag==='archive'&&this.missions.stage?.kind==='disable'){this.toast('Disable the archive truck first.');return;}
    const occupied=!!car.occupant;
    if(occupied&&car.occupant!=='player') {
      const old=this.people.add(car.x+2.7,car.z,'civilian','#739c94','#b68a66');old.panic=7;
    }
    p.car=car;p.x=car.x;p.z=car.z;car.occupant='player';car.role='parked';this.save.stats.cars++;
    if(!car.owned&&!car.stolen){car.stolen=true;this.police.crime(car.type==='patrol'?1.8:occupied?.9:.55,'Vehicle theft reported');}
    this.police.changedCar(this);this.render.lookTime=0;this.audio.start();this.recordEvent('entered-vehicle',{id:car.id,type:car.type,stolen:car.stolen});this.toast((car.stolen?'VEHICLE TAKEN • ':'YOUR RIDE • ')+car.config.name);
  }
  exitCar(force=false) {
    const p=this.player,car=p.car;if(!car)return;
    if(!force&&Math.abs(car.speed)>12){this.toast('Slow down before leaving the vehicle.');return;}
    const side={x:Math.cos(car.a),z:Math.sin(car.a)};
    const options=[{x:car.x+side.x*2.6,z:car.z+side.z*2.6},{x:car.x-side.x*2.6,z:car.z-side.z*2.6},{x:car.x-Math.sin(car.a)*3.5,z:car.z+Math.cos(car.a)*3.5}];
    const point=options.find(v=>!this.world.blocked(v,.45));
    if(!point&&!force){this.toast('Both doors are blocked. Move the vehicle.');return;}
    Object.assign(p,point||{x:car.x,z:car.z});p.car=null;car.occupant=null;car.speed*=.25;p.a=car.a;this.recordEvent('exited-vehicle',{id:car.id});
  }
  context() {
    if(this.menu)return '';
    const m=this.missions;
    if(m.canInteract())return '<kbd>F</kbd> '+(m.stage.kind==='hack'?'Hold & move inside the relay ring':m.stage.kind==='pickup'?'Collect / speak':m.stage.car?'Deliver vehicle or parcel':'Hand over manifest');
    const near=this.world.nearestPlace(this.player,7);
    if(near)return '<kbd>F</kbd> '+near.name;
    const cache=this.world.caches.find(c=>!this.save.caches.includes(c.id)&&dist(c,this.player)<3);
    if(cache)return '<kbd>F</kbd> Collect hidden dock case';
    if(!this.player.car){const car=this.nearbyVehicle();if(car)return '<kbd>E</kbd> '+(car.owned?'Drive ':car.occupant?'Carjack ':'Take ')+car.config.name;}
    return '';
  }
  interact() {
    if(this.missions.interact()||this.activities.interact())return;
    const cache=this.world.caches.find(c=>!this.save.caches.includes(c.id)&&dist(c,this.player)<3);
    if(cache){this.save.caches.push(cache.id);this.save.money+=100;this.save.rep+=20;this.audio.pickup();this.toast('DOCK CASE '+this.save.caches.length+' / 12 • +$100');if(!this.police.level)this.saveProgress();return;}
    const near=this.world.nearestPlace(this.player,7);
    if(!near){this.toast('Nothing to interact with here. Check the map for services.');return;}
    if(near.id==='contact'){if(this.missions.active)this.speech(this.missions.job.contact,this.missions.failed?'Open the map to retry the job.':this.missions.stage.hint);else if(this.save.chapter<STORY.length)this.ui.briefing();else this.speech('INEZ • ferry steward','The morning ferry is running. For once, the route belongs to the people who work it.');}
    else if(['garage','clinic','arms'].includes(near.id)){this.ui.shopMessage='';this.ui.showShop(near.id);}
    else if(near.id==='home')this.ui.home();
    else this.ui.activity(near.id==='race'?'race':'delivery');
  }
  saveProgress(){return this.store.write(this);}
  defeat(title,reason){if(this.menu==='defeat')return;this.recordEvent('defeat',{title});if(this.missions.active)this.missions.fail('You were stopped.');this.ui.defeat(title,reason);}
  recover(retry) {
    this.exitCar(true);this.player.x=315;this.player.z=79;this.player.hp=100;this.player.armor=0;this.player.arrest=0;this.save.money=Math.max(0,this.save.money-150);this.police.clear();this.closeMenu();this.toast('Recovered at Strand clinic. Completed jobs preserved.');this.recordEvent('recovered',{retry});
    if(retry)this.missions.retry();
  }
  update(dt) {
    this.time+=dt;this.world.update(dt);this.combat.update(dt,this);this.player.update(dt,this);this.traffic.update(dt,this);this.people.update(dt,this);this.police.update(dt,this);this.missions.update(dt);this.activities.update(dt);this.effects.update(dt);this.audio.update(dt,this);
    this.toastTime-=dt;this.speechTime-=dt;if(this.toastTime<=0)document.getElementById('toast').hidden=true;if(this.speechTime<=0)document.getElementById('speech').hidden=true;
    this.skidClock-=dt;if(this.player.car?.skid&&this.skidClock<0){this.effects.skid(this.player.car);this.skidClock=.07;}
    if(this.player.car&&this.player.car.health<15&&!this.player.car.destroyed)this.toastTime=Math.max(this.toastTime,1);
  }
  snapshot() {
    const p=this.player,m=this.missions,frames=[...this.frameTimes].sort((a,b)=>a-b);
    const screen=v=>this.render.project(v.x,1,v.z);
    return {title:'Cairn Coast: Low Water',started:this.started,menu:this.menu,time:this.time,player:{x:p.x,z:p.z,a:p.a,hp:p.hp,armor:p.armor,car:p.car?.id||null,speed:p.car?.speed||p.speed},camera:{yaw:this.render.yaw},progress:{chapter:this.save.chapter,money:this.save.money,rep:this.save.rep,upgrades:{...this.save.upgrades},stats:{...this.save.stats},bestRace:this.save.bestRace},mission:{active:m.active,index:m.index,stage:m.stageIndex,failed:m.failed,objective:m.stage?.text||'',target:m.target?{x:m.target.x,z:m.target.z}:null,guards:m.guards.map(v=>({x:v.x,z:v.z,hp:v.hp,screen:screen(v)}))},activity:{kind:this.activities.active,index:this.activities.index,target:this.activities.target},police:{level:this.police.level,state:this.police.state,seen:this.police.seen,search:this.police.unseen,units:this.police.units.map(c=>({x:c.x,z:c.z,task:c.task,health:c.health})),events:this.police.eventLog.slice(-30)},cars:this.traffic.cars.map(c=>({id:c.id,type:c.type,x:c.x,z:c.z,a:c.a,speed:c.speed,health:c.health,max:c.maxHealth,tag:c.missionTag||null,owned:c.owned,role:c.role,destroyed:c.destroyed,screen:screen(c)})),weapon:{name:this.combat.weapon,mag:{...this.combat.mag},ammo:{...this.combat.ammo}},people:this.people.people.filter(v=>dist(v,p)<90).map(v=>({x:v.x,z:v.z,hp:v.hp,role:v.role,panic:v.panic})),frames:{count:frames.length,median:frames[Math.floor(frames.length*.5)]||0,p95:frames[Math.floor(frames.length*.95)]||0},drawCalls:this.render.renderer.info.render.calls,triangles:this.render.renderer.info.render.triangles,events:this.events.slice(-50)};
  }
}

try { new CairnCoastGame(); }
catch(error) {
  console.error(error);document.getElementById('screen-content').innerHTML='<div id="fatal"><h1>Could not start Cairn Coast.</h1><p>This game requires WebGL in a desktop browser. Check that hardware acceleration is available, then reload.</p><pre></pre><button id="reload-page">Reload</button></div>';document.querySelector('#fatal pre').textContent=String(error.message);document.getElementById('reload-page').onclick=()=>location.reload();
}
