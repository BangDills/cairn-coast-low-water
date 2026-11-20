import { clamp, dist } from './math.js';
export class OriginalAudio {
  constructor(){this.ctx=null;this.muted=false;this.radio=true;this.beat=0;this.nextBeat=0;this.volume=.32;}
  start(){
    try{
      if(this.ctx){this.ctx.resume();return;}
      this.ctx=new (window.AudioContext||window.webkitAudioContext)();
      this.master=this.ctx.createGain();this.master.gain.value=this.volume;this.master.connect(this.ctx.destination);
      this.engine=this.ctx.createOscillator();this.engine.type='sawtooth';this.engineGain=this.ctx.createGain();this.engineGain.gain.value=0;
      const filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=300;this.engine.connect(filter);filter.connect(this.engineGain);this.engineGain.connect(this.master);this.engine.start();
      this.siren=this.ctx.createOscillator();this.siren.type='sine';this.sirenGain=this.ctx.createGain();this.sirenGain.gain.value=0;this.siren.connect(this.sirenGain);this.sirenGain.connect(this.master);this.siren.start();
    }catch{this.ctx=null;}
  }
  tone(freq,duration=.14,type='sine',gain=.15,slide=0){
    if(!this.ctx||this.muted)return;const t=this.ctx.currentTime,o=this.ctx.createOscillator(),v=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(Math.max(20,freq),t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t+duration);v.gain.setValueAtTime(gain,t);v.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(v);v.connect(this.master);o.start(t);o.stop(t+duration+.03);
  }
  noise(duration=.1,volume=.1){
    if(!this.ctx||this.muted)return;const buffer=this.ctx.createBuffer(1,Math.ceil(this.ctx.sampleRate*duration),this.ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
    const source=this.ctx.createBufferSource(),v=this.ctx.createGain();v.gain.value=volume;source.buffer=buffer;source.connect(v);v.connect(this.master);source.start();
  }
  shot(type){this.noise(.095,type==='smg'?.20:.3);this.tone(130,.11,'triangle',.22,42);}
  enemyShot(distance){if(distance<45)this.noise(.08,.035);}
  hit(n){this.noise(.16,.2*n);this.tone(80,.15,'sine',.3*n,30);}
  reload(){this.noise(.04,.12);this.tone(640,.06,'square',.015);}
  pickup(){this.tone(520,.12,'sine',.2);this.tone(780,.25,'sine',.12);}
  checkpoint(){this.tone(440,.13,'triangle',.14);this.tone(660,.25,'triangle',.12);}
  success(){for(const [i,f]of [261.6,329.6,392,523.2].entries()){if(this.ctx){const delay=i*.11;const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),v=this.ctx.createGain();o.frequency.value=f;v.gain.setValueAtTime(.13,t);v.gain.exponentialRampToValueAtTime(.001,t+.6);o.connect(v);v.connect(this.master);o.start(t);o.stop(t+.65);}}}
  alert(){this.tone(390,.22,'triangle',.18,520);}
  toggle(){this.muted=!this.muted;if(this.master)this.master.gain.value=this.muted?0:this.volume;return this.muted;}
  pause(paused){if(this.ctx){if(paused)this.ctx.suspend();else this.ctx.resume();}}
  update(dt,g){
    if(!this.ctx)return;const t=this.ctx.currentTime,car=g.player.car;
    this.engine.frequency.setTargetAtTime(car?45+Math.abs(car.speed)*4.0+(car.throttle>0?20:0):35,t,.12);
    this.engineGain.gain.setTargetAtTime(car?.12:0,t,.2);
    const closest=g.police.units.reduce((n,c)=>Math.min(n,dist(c,g.player)),999);
    this.sirenGain.gain.setTargetAtTime(g.police.level?clamp(1-closest/110,0,1)*.07:0,t,.4);this.siren.frequency.setTargetAtTime(530+Math.sin(g.time*5)*220,t,.05);
    if(this.radio&&this.nextBeat<t){
      this.nextBeat=t+.38;const notes=[130.81,155.56,196,174.61,130.81,116.54,155.56,174.61],note=notes[Math.floor(this.beat/4)%notes.length];
      if(this.beat%2===0)this.tone(note,.35,'triangle',.045);
      if(this.beat%4===0)this.tone(60,.12,'sine',.15,28);
      if(this.beat%4===2)this.noise(.055,.028);
      if(this.beat%3===0)this.tone(note*4,.19,'sine',.022);
      this.beat++;
    }
  }
}
