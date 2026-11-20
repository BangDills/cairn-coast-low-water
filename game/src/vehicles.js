import { T, createVehicleModel, VEHICLE_TYPES } from './models.js';
import { clamp, mix, dist, angleDelta, headingTo, nearest, ROADS_X, ROADS_Z, seeded } from './math.js';

export class Vehicle {
  constructor(scene,id,type,x,z,a=0,role='parked',color) {
    Object.assign(this,{id,type,x,z,a,role, speed:0, steer:0, throttle:0, health:VEHICLE_TYPES[type].health, maxHealth:VEHICLE_TYPES[type].health, occupant:role==='traffic'?'civilian':null, stolen:false, owned:false, path:[], repath:0, crash:0, stuck:0, destroyed:false, smoke:0});
    this.config=VEHICLE_TYPES[type];this.model=createVehicleModel(type,color);scene.add(this.model.group);
    this.model.group.position.set(x,.13,z);this.model.group.rotation.y=-a;
  }
  updatePhysics(dt,world,control,upgrades={}) {
    if(this.destroyed){this.speed*=Math.exp(-dt*3);return;}
    this.crash=Math.max(0,this.crash-dt);
    const cfg=this.config,drive=control?.throttle||0,steer=control?.steer||0;
    this.throttle=drive;this.steer=mix(this.steer,steer,1-Math.exp(-dt*9));
    const grip=cfg.grip*(upgrades.grip?1.3:1);
    const top=cfg.max*(upgrades.turbo?1.2:1)*(this.health/this.maxHealth<.25?.68:1);
    this.speed+=drive*cfg.accel*(upgrades.turbo?1.16:1)*dt;
    this.speed*=Math.exp(-dt*(control?.brake?2.1:drive?.10:.68));
    this.speed=clamp(this.speed,-top*.32,top);
    const traction=control?.brake?.62:1;
    this.a+=this.steer*cfg.turn*(upgrades.grip?1.18:1)*clamp(Math.abs(this.speed)*.16,0,1)*Math.sign(this.speed)*dt*traction;
    const lateral=control?.brake?this.steer*Math.abs(this.speed)*.2:0;
    const dx=(Math.sin(this.a)*this.speed+Math.cos(this.a)*lateral)*dt;
    const dz=(-Math.cos(this.a)*this.speed+Math.sin(this.a)*lateral)*dt;
    const hit=world.move(this,dx,dz,this.type==='truck'?1.55:1.2);
    if(this.x>343){this.speed*=Math.exp(-dt*2.5);if(this.x>385)this.health-=dt*15;}
    if(hit&&Math.abs(this.speed)>4&&this.crash===0) {
      const damage=Math.max(1,Math.abs(this.speed)*.52)/(upgrades.armor?1.7:1);
      this.health-=damage;this.impact={damage,x:this.x,z:this.z};this.speed*=-.22;this.crash=.65;
    }
    this.model.group.position.set(this.x,.14+Math.sin(this.speed*.2)*.015,this.z);
    this.model.group.rotation.set(Math.abs(this.speed)>6?-drive*.018:0,-this.a,-this.steer*this.speed*.0015);
    this.model.wheels.forEach((wheel,i)=>{wheel.children[0].rotation.x+=this.speed*dt*2;wheel.rotation.y=i%2===0?-.15*this.steer:0;});
    if(this.model.lights)this.model.lights.forEach((m,i)=>{const on=(this.role==='patrol'||this.occupant==='player')&&((performance.now()/180+i)|0)%2===0;m.visible=on;if(this.model.glows[i])this.model.glows[i].visible=on;});
    if(this.health<=0)this.destroyed=true;
    this.stuck=Math.abs(this.speed)<1&&drive>0?this.stuck+dt:0;
    this.health=clamp(this.health,0,this.maxHealth);
    this.skid=!!control?.brake&&Math.abs(this.speed)>9;
    this.grip=grip;
  }
  seek(target,dt,world,maxSpeed=16,avoid=[]) {
    if(!target)return {throttle:0,steer:0};
    const error=angleDelta(this.a,headingTo(this,target));
    let wanted=maxSpeed*(1-Math.min(Math.abs(error)/Math.PI,.83));
    for(const other of avoid) {
      if(other===this||other.destroyed)continue;
      const d=dist(this,other);
      if(d<11&&Math.abs(angleDelta(this.a,headingTo(this,other)))<.34)wanted=Math.min(wanted,Math.max(0,(d-4)*1.9));
    }
    if(this.stuck>2){return {throttle:-.65,steer:error>0?-1:1};}
    return {throttle:this.speed<wanted?1:this.speed>wanted+2?-.6:0,steer:clamp(error*2.7,-1,1),brake:Math.abs(error)>1.25&&Math.abs(this.speed)>9};
  }
}

export class TrafficSystem {
  constructor(scene,world) {
    this.scene=scene;this.world=world;this.cars=[];this.serial=0;this.random=seeded(12739);
    this.add('coupe',294,17,0,'parked','#d17b50').owned=true;
    this.add('van',113,-167,Math.PI/2,'parked','#5f9690').missionTag='borrowed';
    this.add('sedan',-185,-43,Math.PI,'parked','#b85c4d');
    this.add('coupe',285,-184,Math.PI/2,'parked','#dbb65b');
    this.add('sedan',185,193,0,'parked','#718b90');
    this.add('van',15,193,0,'parked','#dfc7a3');
    for(let i=0;i<28;i++) {
      const ix=i%7,iz=Math.floor(i/7)%6,x=ROADS_X[ix]+(i%2?3.1:-3.1),z=ROADS_Z[iz]+27+this.random()*40,a=i%2?0:Math.PI;
      const v=this.add(['sedan','sedan','coupe','van'][i%4],x,z,a,'traffic',['#e5d8b3','#748d85','#a75e50','#577d87','#cda961','#b5b7a0'][i%6]);
      v.speed=8+this.random()*5;this.wanderNext(v);
    }
  }
  add(type,x,z,a,role,color) {
    const v=new Vehicle(this.scene,'v'+this.serial++,type,x,z,a,role,color);this.cars.push(v);return v;
  }
  wanderNext(v) {
    const x=nearest(v.x,ROADS_X),z=nearest(v.z,ROADS_Z);
    let options=[];
    for(const xx of ROADS_X)if(Math.abs(xx-x)===100)options.push({x:xx,z});
    for(const zz of ROADS_Z)if(Math.abs(zz-z)<=120&&Math.abs(zz-z)>10)options.push({x,z:zz});
    const straight=options.filter(p=>Math.abs(angleDelta(v.a,headingTo(v,p)))<1.6);
    if(straight.length)options=straight;
    const t=options[Math.floor(this.random()*options.length)]||{x,z};
    const a=headingTo({x,z},t);v.path=[{x:x+Math.cos(a)*3.1,z:z+Math.sin(a)*3.1},{x:t.x+Math.cos(a)*3.1,z:t.z+Math.sin(a)*3.1}];
    if(dist(v,v.path[0])<7||Math.abs(angleDelta(v.a,headingTo(v,v.path[0])))>Math.PI/2)v.path.shift();
  }
  nearest(p,r=5.5) { return this.cars.filter(v=>!v.destroyed&&dist(v,p)<r).sort((a,b)=>dist(a,p)-dist(b,p))[0]; }
  update(dt,g) {
    for(const car of this.cars) {
      car.model.group.visible=dist(car,g.player)<220;
      if(car===g.player.car) {
        car.updatePhysics(dt,this.world,{throttle:(g.input.down('KeyW','ArrowUp')?1:0)-(g.input.down('KeyS','ArrowDown')?1:0),steer:(g.input.down('KeyD')?1:0)-(g.input.down('KeyA')?1:0),brake:g.input.down('Space')},g.save.upgrades);
        g.player.x=car.x;g.player.z=car.z;
      } else if(car.role==='traffic'||car.role==='convoy') {
        if(!car.path.length)this.wanderNext(car);
        if(car.path[0]&&dist(car,car.path[0])<6)car.path.shift();
        const c=car.seek(car.path[0],dt,this.world,car.role==='convoy'?14:12+Number(car.id.slice(1))%7,this.cars.filter(v=>v.role!=='patrol'));
        car.updatePhysics(dt,this.world,c);
        if(car.stuck>4){car.stuck=0;this.wanderNext(car);}
      } else if(car.role!=='patrol') car.updatePhysics(dt,this.world,{throttle:0,steer:0});
      if(car.impact){if(dist(car,g.player)<40)g.effects.impact(car.x,1,car.z,car.impact.damage);if(car===g.player.car)g.audio.hit(.3);car.impact=null;}
      if(car.destroyed&&!car.exploded) {
        car.exploded=true;car.model.group.children.forEach(m=>{if(m.material?.color){m.material=m.material.clone();m.material.color.multiplyScalar(.3);}});if(car.model.lights)car.model.lights.forEach(m=>m.visible=false);car.model.glows.forEach(m=>m.visible=false);
        g.effects.explosion(car.x,1,car.z);g.audio.hit(1);
        if(dist(car,g.player)<8)g.combat.damagePlayer(28,'Vehicle explosion');
        if(car===g.player.car){g.exitCar(true);g.toast('Vehicle destroyed. Find another ride.');}
        if(car.missionTag&&g.missions.active&&g.missions.job.stages.some(s=>s.tag===car.missionTag))g.missions.fail('The job vehicle was destroyed. Retry from the journal.');
      }
      if(car.health<car.maxHealth*.3&&!car.destroyed) {
        car.smoke-=dt;if(car.smoke<0&&dist(car,g.player)<100){g.effects.smoke(car.x,1.5,car.z);car.smoke=.15;}
      }
    }
    this.collisions(g);
  }
  collisions(g) {
    const cars=this.cars.filter(c=>!c.destroyed&&dist(c,g.player)<120);
    for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++) {
      const a=cars[i],b=cars[j],d=dist(a,b),r=a.type==='truck'||b.type==='truck'?3.6:2.85;
      if(d>=r||d<.001)continue;
      const dx=(a.x-b.x)/d,dz=(a.z-b.z)/d,move=(r-d)*.5;
      this.world.move(a,dx*move,dz*move,1.2);this.world.move(b,-dx*move,-dz*move,1.2);
      if(a.crash===0&&b.crash===0) {
        const impact=Math.abs(a.speed-b.speed)+Math.abs(angleDelta(a.a,b.a))*Math.min(Math.abs(a.speed),Math.abs(b.speed));
        const damage=clamp(impact*.6,0,30),player=g.player.car,patrolCollision=(a===player&&b.role==='patrol')||(b===player&&a.role==='patrol');
        const patrolDamage=g.police.level<=2?.25:.5;
        const protection=g.save.upgrades.armor?1/1.7:1;
        const totalMass=a.config.mass+b.config.mass;
        a.health-=damage*b.config.mass/totalMass*(a===player?protection*(patrolCollision?patrolDamage:1):1);b.health-=damage*a.config.mass/totalMass*(b===player?protection*(patrolCollision?patrolDamage:1):1);
        if(a===player||b===player){if(damage>4){g.audio.hit(.4);g.effects.impact((a.x+b.x)/2,.8,(a.z+b.z)/2,8);const other=a===player?b:a;if(other.role==='patrol'&&Math.abs(player.speed)>Math.abs(other.speed)+4&&Math.abs(angleDelta(player.a,headingTo(player,other)))<.75)g.police.crime(.25,'Patrol deliberately rammed');}}
        a.speed*=.6;b.speed*=.6;a.crash=.65;b.crash=.65;
      }
    }
  }
}
