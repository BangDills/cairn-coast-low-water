export class GameInput {
  constructor(canvas) {
    this.keys=new Set();this.pressed=new Set();this.mouse={x:innerWidth*.5,y:innerHeight*.52,fire:false,active:false};this.dragging=false;this.dragX=0;this.dragY=0;
    window.addEventListener('keydown',e=>{
      if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
      if(e.target.tagName==='BUTTON'&&(e.code==='Space'||e.code==='Enter'))return;
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyM','KeyQ','KeyE','KeyF','F5'].includes(e.code))e.preventDefault();
      if(!this.keys.has(e.code))this.pressed.add(e.code);this.keys.add(e.code);
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>this.clear());
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('mousedown',e=>{this.mouse.active=true;if(e.button===0)this.mouse.fire=true;if(e.button===2)this.dragging=true;});
    window.addEventListener('mouseup',e=>{if(e.button===0)this.mouse.fire=false;if(e.button===2)this.dragging=false;});
    window.addEventListener('mousemove',e=>{if(this.dragging){this.dragX+=e.movementX;this.dragY+=e.movementY;}this.mouse.x=e.clientX;this.mouse.y=e.clientY;});
  }
  down(...keys){return keys.some(k=>this.keys.has(k));}
  tap(key){return this.pressed.has(key);}
  end(){this.pressed.clear();this.dragX=0;this.dragY=0;}
  clear(){this.keys.clear();this.pressed.clear();this.mouse.fire=false;this.dragging=false;this.dragX=0;this.dragY=0;}
}
