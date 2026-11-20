import { createHelicopter, T } from './models.js';
import { clamp, dist, headingTo, angleDelta, roadAnchor, nearest, ROADS_X, ROADS_Z } from './math.js';

export class PoliceDispatch {
  constructor(scene) {
    this.score=0;this.level=0;this.units=[];this.unseen=0;this.seen=false;this.report=0;this.spawnClock=0;this.roadblockLevel=0;this.lastKnown={x:286,z:18};this.state='CLEAR';this.crimeLabel='';this.eventLog=[];
    this.heli=createHelicopter();scene.add(this.heli.group);this.heli.group.visible=false;this.heli.x=0;this.heli.z=0;
  }
  crime(severity,reason) {
    const old=this.level;this.score=clamp(this.score+severity,0,5);this.level=Math.ceil(this.score);this.report=2;
    if(this.game){this.lastKnown={x:this.game.player.x,z:this.game.player.z};this.game.save.stats.crimes++;}
    this.crimeLabel=reason;
    if(this.level>old){this.eventLog.push({time:this.game?.time||0,event:'escalated',level:this.level,reason});if(this.game){this.game.toast('COAST PATROL • '+reason);this.game.audio.alert();}}
  }
  spawn(g,roadblock=false) {
    const p=g.player,base=roadAnchor(p),a=p.car?p.car.a:g.render.yaw;
    let x,z;
    if(roadblock){x=nearest(base.x+Math.sin(a)*130,ROADS_X);z=nearest(base.z-Math.cos(a)*130,ROADS_Z);}
    else {const off=this.units.length%2?1:-1;x=nearest(p.x+Math.cos(a)*off*115-Math.sin(a)*90,ROADS_X);z=nearest(p.z+Math.sin(a)*off*115+Math.cos(a)*90,ROADS_Z);}
    if(dist({x,z},p)<85){z=clamp(z+(p.z>0?-120:120),-300,300);}
    const car=g.traffic.add('patrol',x+3,z,headingTo({x,z},p),'patrol');car.occupant='officer';car.speed=roadblock?0:16;car.task=roadblock?'CORDON':'PURSUIT';car.roadblock=roadblock;car.footTimer=0;car.repath=0;
    car.unitName=['TERN','GANNET','SKUA','PETREL','HERON','SWIFT','KITE','OSPREY'][this.units.length%8]+' '+(this.units.length+1);
    this.units.push(car);this.eventLog.push({time:g.time,event:roadblock?'roadblock':'dispatched',unit:car.unitName,x,z});
    if(roadblock){g.toast('Cordon reported ahead. Use a side street.');g.speech('INEZ • lookout','They are closing the next junction. Turn inland and break their sightline.');}
  }
  clear(g) {
    const had=this.level>0;this.score=0;this.level=0;this.seen=false;this.unseen=0;this.state='CLEAR';this.report=0;this.roadblockLevel=0;
    for(const car of this.units){car.role='traffic';car.roadblock=false;car.task='RETURNING';if(car.model.lights)car.model.lights.forEach(l=>l.visible=false);}
    this.units=[];this.heli.group.visible=false;
    if(had&&g){g.save.stats.escapes++;g.save.rep+=35;g.toast('Pursuit escaped • +35 standing');this.eventLog.push({time:g.time,event:'escaped'});g.audio.success();}
  }
  changedCar(g) {
    if(this.level>0&&!this.seen){this.unseen+=6;g.toast('Unseen vehicle swap • search shortened');this.eventLog.push({time:g.time,event:'unseen-swap'});}
  }
  update(dt,g) {
    this.game=g;this.level=Math.ceil(this.score);this.report=Math.max(0,this.report-dt);
    if(!this.level){this.state='CLEAR';return;}
    this.spawnClock-=dt;
    const active=this.units.filter(c=>!c.destroyed&&c.occupant!=='player');
    if(active.length<Math.min(7,this.level+1)&&this.spawnClock<=0){this.spawn(g);this.spawnClock=2.5;}
    if(this.level>=3&&this.roadblockLevel<this.level&&this.spawnClock<1){this.spawn(g,true);this.roadblockLevel=this.level;}
    this.seen=this.report>0;
    const p=g.player;
    for(let i=0;i<this.units.length;i++) {
      const car=this.units[i];if(car.destroyed||car===p.car||car.role!=='patrol')continue;
      const distance=dist(car,p),facing=Math.abs(angleDelta(car.a,headingTo(car,p)))<1.35,los=distance<82&&(distance<25||facing)&&g.world.visible(car,p);
      if(los)this.seen=true;
      car.footTimer=Math.max(0,car.footTimer-dt);car.repath-=dt;
      let control={throttle:0,steer:0};
      if(!car.roadblock||distance<34) {
        car.roadblock=false;
        const predict=this.level>1&&i%2===1?Math.min(3,this.level*.65):0;
        const pos=p.car?{x:p.x+Math.sin(p.car.a)*p.car.speed*predict,z:p.z-Math.cos(p.car.a)*p.car.speed*predict}:p;
        const goal=this.seen?pos:this.lastKnown;
        car.task=i%2&&this.level>1?'INTERCEPT':'PURSUIT';
        if(car.repath<=0){car.path=g.world.route(car,goal);car.repath=1.2+i*.07;}
        while(car.path.length&&dist(car,car.path[0])<7)car.path.shift();
        const target=distance<23&&los?p:(car.path[0]||goal);
        let pursuitSpeed=this.level>=3?33:this.level===2?18:16;
        if(this.level<=2&&p.car&&los&&distance<22)pursuitSpeed=Math.min(pursuitSpeed,Math.abs(p.car.speed)*.92+Math.max(0,distance-10)*.8);
        control=car.seek(target,dt,g.world,pursuitSpeed,[]);
        if(this.level<=2&&p.car&&los&&distance<12&&car.speed>Math.abs(p.car.speed)+2)control.brake=true;
        if(!this.seen&&distance<14)control.throttle=0;
        if(!p.car&&distance<10){control.throttle=car.speed>2?-.5:0;car.task='ON FOOT';if(car.footTimer===0&&g.people.people.filter(p=>p.role==='officer'&&p.hp>0).length<5){g.people.add(car.x+2.5,car.z,'officer','#234854');car.footTimer=18;}}
      } else car.task='CORDON';
      car.updatePhysics(dt,g.world,control);
      if(this.level>=3&&distance<17&&p.car&&Math.random()<dt*.8&&los){g.effects.tracer(car,p,'#ffb495');g.combat.damagePlayer(3,'Patrol fire');}
      if(car.stuck>5){car.stuck=0;car.repath=0;car.a+=.8;}
    }
    if(this.level>=4) {
      const h=this.heli;if(!h.group.visible){h.x=p.x+70;h.z=p.z+90;h.group.visible=true;}
      const target=this.seen?p:this.lastKnown,dx=target.x-h.x,dz=target.z-h.z,d=Math.hypot(dx,dz)||1;
      if(d>28){h.x+=dx/d*23*dt;h.z+=dz/d*23*dt;}
      h.group.position.set(h.x,40+Math.sin(g.time)*2,h.z);h.group.rotation.y=-headingTo(h,target);h.rotor.rotation.y+=dt*32;
      if(dist(h,p)<66&&g.world.visible(h,p))this.seen=true;
    }else this.heli.group.visible=false;
    const required=6+this.level*1.6;
    if(this.seen){this.unseen=0;this.lastKnown={x:p.x,z:p.z};this.state='IN SIGHT';}
    else {this.unseen+=dt;this.state=this.unseen>required?'COOLING':'SEARCHING';if(this.unseen>required)this.score=Math.max(0,this.score-dt*.38);}
    this.searchProgress=clamp(this.unseen/required,0,1);
    const arrestingOfficer=g.people.people.some(officer=>officer.role==='officer'&&officer.hp>0&&dist(officer,p)<3.8&&g.world.visible(officer,p));
    if(!p.car&&arrestingOfficer&&p.speed<1&&this.seen) {
      p.arrest+=dt;if(p.arrest>3)g.defeat('Busted','Coast Patrol caught you standing still. Keep moving or find a car.');
    }else p.arrest=Math.max(0,p.arrest-dt*1.3);
    if(this.score<=0)this.clear(g);
  }
}
