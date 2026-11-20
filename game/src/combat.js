import { dist, headingTo, angleDelta, clamp } from './math.js';
export const WEAPONS = { fists:{name:'HANDS',clip:0,interval:.55,damage:30,range:2.6},pistol:{name:'KITE 9',clip:12,interval:.3,damage:32,range:80},smg:{name:'TERN SMG',clip:28,interval:.10,damage:17,range:66} };
export class CombatSystem {
  constructor() {this.weapon='fists';this.ammo={pistol:72,smg:112};this.mag={pistol:12,smg:28};this.cooldown=0;this.reload=0;this.justFired=0;this.damageFlash=0;}
  cycle(g) {
    const w=g.save.upgrades.smg?['fists','pistol','smg']:['fists','pistol'];this.weapon=w[(w.indexOf(this.weapon)+1)%w.length];this.reload=0;g.toast(this.weapon==='fists'?'Hands equipped. Click close to a target.':WEAPONS[this.weapon].name+' equipped. Aim with the cursor.');
  }
  startReload(g) {
    if(this.weapon==='fists'||this.reload||this.mag[this.weapon]===WEAPONS[this.weapon].clip)return;
    if(this.ammo[this.weapon]<=0){g.toast('No reserve ammunition. Visit Foundry Supply.');return;}
    this.reload=1.3;g.audio.reload();
  }
  attack(g) {
    if(this.cooldown>0||this.reload>0)return;
    const w=WEAPONS[this.weapon],p=g.player;
    if(this.weapon!=='fists'&&this.mag[this.weapon]<=0){this.startReload(g);return;}
    this.cooldown=w.interval;this.justFired=.18;
    const aim=g.render.aim(g.input.mouse,p),a=headingTo(p,aim);p.a=a;
    const reach=this.weapon==='fists'?w.range:w.range;
    let hit=null,best=reach;
    const targets=[...g.people.people.filter(x=>x.role!=='contact'&&x.hp>0),...g.traffic.cars.filter(x=>x!==p.car&&!x.destroyed)];
    for(const target of targets) {
      const d=dist(p,target),tolerance=this.weapon==='fists'?.85:(target.model.wheels?.055+.9/Math.max(1,d):.065+.35/Math.max(1,d));
      if(d<best&&Math.abs(angleDelta(a,headingTo(p,target)))<tolerance&&g.world.visible(p,target)){best=d;hit=target;}
    }
    const end=hit||{x:p.x+Math.sin(a)*reach,z:p.z-Math.cos(a)*reach};
    if(this.weapon!=='fists') {
      this.mag[this.weapon]--;g.effects.tracer(p,end);g.effects.burst(p.x+Math.sin(a),1.3,p.z-Math.cos(a),5,'#ffd578',2,.12);g.audio.shot(this.weapon);g.police.crime(.12,'Shots reported');
      g.render.shake=Math.max(g.render.shake,this.weapon==='smg'?.07:.13);
    } else {g.audio.hit(.15);g.effects.impact(p.x+Math.sin(a)*1.4,1,p.z-Math.cos(a)*1.4,3);}
    if(hit) {
      if(hit.model.wheels){hit.health-=w.damage*(hit.type==='truck'?.7:1);if(hit.role==='patrol')g.police.crime(.7,'Patrol under fire');}
      else {
        hit.hp-=w.damage;hit.panic=8;hit.flash=.3;
        if(hit.role==='civilian')g.police.crime(.9,'Assault reported');
        if(hit.role==='officer')g.police.crime(.8,'Officer under fire');
        if(hit.hp<=0&&hit.role==='guard'){g.save.rep+=18;g.toast('Security neutralized • +18 standing');}
      }
      g.effects.impact(hit.x,1.1,hit.z,6);g.ui.hitTime=.14;
    }
  }
  damagePlayer(amount,source) {
    const g=this.game,p=g.player;if(g.menu||p.hp<=0)return;
    if(p.car&&source!=='Vehicle explosion'){p.car.health-=amount*(p.car.type==='truck'?.28:.9);amount*=p.car.type==='truck'?.08:.2;}
    const absorbed=Math.min(p.armor,amount*.7);p.armor-=absorbed;p.hp=clamp(p.hp-(amount-absorbed),0,100);p.hurt=18;this.damageFlash=.6;g.render.shake=Math.max(g.render.shake,.18);
    if(p.hp<=0)g.defeat('Wounded',source+' stopped your run. Your completed jobs are safe.');
  }
  update(dt,g) {
    this.game=g;this.cooldown=Math.max(0,this.cooldown-dt);this.justFired=Math.max(0,this.justFired-dt);this.damageFlash=Math.max(0,this.damageFlash-dt);
    if(this.reload>0){this.reload-=dt;if(this.reload<=0){const n=Math.min(WEAPONS[this.weapon].clip-this.mag[this.weapon],this.ammo[this.weapon]);this.mag[this.weapon]+=n;this.ammo[this.weapon]-=n;}}
    if(g.input.mouse.fire&&!g.input.dragging)this.attack(g);
  }
}
