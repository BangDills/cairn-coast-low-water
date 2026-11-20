import { createPersonModel, animatePerson } from './models.js';
import { clamp, angleDelta, headingTo, dist, seeded, ROADS_X, ROADS_Z } from './math.js';

export class PlayerController {
  constructor(scene) {
    this.x=286;this.z=28;this.a=0;this.hp=100;this.armor=0;this.car=null;this.speed=0;this.jump=0;this.hurt=0;this.arrest=0;
    this.model=createPersonModel('#be704f','#bb8765',true);scene.add(this.model.group);
  }
  update(dt,g) {
    this.hurt=Math.max(0,this.hurt-dt);this.jump=Math.max(0,this.jump-dt);
    if(this.car){this.model.group.visible=false;this.speed=this.car.speed;return;}
    this.model.group.visible=true;
    let forward=(g.input.down('KeyW','ArrowUp')?1:0)-(g.input.down('KeyS','ArrowDown')?1:0),right=(g.input.down('KeyD')?1:0)-(g.input.down('KeyA')?1:0);
    const norm=Math.hypot(forward,right)||1;forward/=norm;right/=norm;
    const sprint=g.input.down('ShiftLeft','ShiftRight'),speed=sprint?7.8:4.4;
    this.speed=(forward||right)?speed:0;
    const yaw=g.render.yaw,dx=(Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed*dt,dz=(-Math.cos(yaw)*forward+Math.sin(yaw)*right)*speed*dt;
    g.world.move(this,dx,dz,.42);
    if(g.combat.weapon!=='fists'&&g.input.mouse.active){const target=g.render.aim(g.input.mouse,this);this.a+=angleDelta(this.a,headingTo(this,target))*Math.min(1,dt*13);}
    else if(dx||dz)this.a+=angleDelta(this.a,Math.atan2(dx,-dz))*Math.min(1,dt*12);
    this.model.group.position.set(this.x,.25+(this.jump?Math.sin((1-this.jump/.7)*Math.PI)*1.1:0),this.z);this.model.group.rotation.y=-this.a;
    animatePerson(this.model,g.time,this.speed,g.combat.weapon!=='fists');
    if(this.hp<100&&this.hurt===0&&g.police.level===0)this.hp=Math.min(100,this.hp+dt*.8);
  }
}
export class PeopleSystem {
  constructor(scene) {
    this.scene=scene;this.people=[];this.serial=0;const r=seeded(183921);
    for(let i=0;i<68;i++) {
      const x=i<16?(i%2?326:286):(ROADS_X[Math.floor(r()*7)]+(i%2?14:-14));
      const z=i<16?-90+i*16:-320+r()*640;
      const p=this.add(x,z,'civilian',['#b87c58','#4e8586','#e3c486','#49636a','#b7a98c','#975e52'][i%6],['#b8815f','#d9ab7b','#865e4c'][i%3]);
      p.a=i%2?0:Math.PI;p.homeX=x;p.homeZ=z;p.direction=i%2?1:-1;
    }
    this.contact=this.add(285,17,'contact','#345e62','#aa7455');this.contact.a=1.3;
  }
  add(x,z,role,shirt,skin) {
    const p={id:'p'+this.serial++,x,z,a:0,role,hp:role==='civilian'?45:80,model:createPersonModel(shirt||'#334d54',skin||'#af805c'),panic:0,shot:1.2,flash:0,dead:0,homeX:x,homeZ:z,direction:1};
    this.scene.add(p.model.group);this.people.push(p);return p;
  }
  guards(points) {return points.map(([x,z])=>this.add(x,z,'guard','#43514b','#c09369'));}
  update(dt,g) {
    for(const p of this.people) {
      const distance=dist(p,g.player);p.model.group.visible=distance<135;
      if(p.hp<=0) {
        p.dead+=dt;p.model.group.rotation.z=Math.min(Math.PI/2,p.dead*4);p.model.group.position.set(p.x,.32,p.z);
        if(p.dead>25&&p.role==='civilian'&&distance>70){p.hp=45;p.dead=0;p.x=p.homeX;p.z=p.homeZ;p.model.group.rotation.z=0;}
        continue;
      }
      p.flash=Math.max(0,p.flash-dt);p.panic=Math.max(0,p.panic-dt);let speed=0;
      if(p.role==='civilian') {
        const threat=(g.player.car&&Math.abs(g.player.car.speed)>8&&distance<12)||(g.combat.justFired>0&&distance<32);
        if(threat)p.panic=4;
        if(p.panic>0){const away=headingTo(g.player,p);p.a+=angleDelta(p.a,away)*Math.min(1,dt*8);speed=5.1;}
        else {speed=1.0+(Number(p.id.slice(1))%4)*.15;p.a=p.direction>0?0:Math.PI;if(Math.abs(p.z-p.homeZ)>67||Math.abs(p.z)>334)p.direction*=-1;}
        const hit=g.world.move(p,Math.sin(p.a)*speed*dt,-Math.cos(p.a)*speed*dt,.32);if(hit){p.direction*=-1;p.a+=Math.PI/2;}
        if(g.player.car&&distance<1.7&&Math.abs(g.player.car.speed)>9){p.hp=0;g.police.crime(1.2,'Pedestrian struck');g.player.car.speed*=.84;g.effects.impact(p.x,1,p.z,8);}
      } else if((p.role==='guard'||p.role==='officer')&&distance<90) {
        const hostile=p.role==='guard'||g.police.level>0;
        if(hostile) {
          p.a+=angleDelta(p.a,headingTo(p,g.player))*Math.min(1,dt*6);
          const visible=g.world.visible(p,g.player);
          if(distance>(p.role==='officer'?3:18)||!visible){speed=2.5;g.world.move(p,Math.sin(p.a)*speed*dt,-Math.cos(p.a)*speed*dt,.4);}
          p.shot-=dt;
          if(distance<42&&visible&&p.shot<0){p.shot=1.3+Math.random()*.7;g.effects.tracer(p,g.player,'#ffb495');g.audio.enemyShot(distance);if(Math.random()<.62*(g.player.jump?.3:1))g.combat.damagePlayer(g.player.car?2:7,p.role==='guard'?'Port security':'Coast Patrol');}
        }
      }
      p.model.group.position.set(p.x,.24,p.z);p.model.group.rotation.y=-p.a;animatePerson(p.model,g.time+Number(p.id.slice(1)),speed,(p.role==='guard'||p.role==='officer')&&(p.role==='guard'||g.police.level>0));
    }
  }
}
