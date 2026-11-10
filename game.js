(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 960, H = 600;
  const hud = document.getElementById('hud');
  const menuScreen = document.getElementById('menuScreen');
  const pauseScreen = document.getElementById('pauseScreen');
  const endScreen = document.getElementById('endScreen');
  const alertBar = document.getElementById('alertBar');
  const alertTrack = document.querySelector('.alert-track');
  const keys = new Set();
  const walls = [
    {x:192,y:205,w:118,h:54}, {x:350,y:118,w:130,h:54}, {x:526,y:202,w:106,h:62},
    {x:296,y:320,w:145,h:62}, {x:500,y:374,w:126,h:64}, {x:700,y:142,w:105,h:56},
    {x:83,y:322,w:70,h:90}, {x:803,y:370,w:68,h:70}, {x:630,y:493,w:118,h:34}
  ];
  const startPos = {x:87,y:506};
  let player, guards, cards, decoys, alert, state='menu', lastTime=0, elapsed=0, sound=false, won=false;
  let particles=[], floaters=[], best=Number(localStorage.getItem('gaggedBest')||0);
  document.getElementById('bestScore').textContent = best ? `BEST: ${best}S` : 'BEST: —';

  function newGame(){
    player={x:startPos.x,y:startPos.y,r:12,face:0,speed:122,step:0};
    guards=[
      makeGuard([{x:335,y:105},{x:595,y:105},{x:595,y:164},{x:335,y:164}],1.0,0),
      makeGuard([{x:666,y:282},{x:850,y:282},{x:850,y:344},{x:666,y:344}],.82,1),
      makeGuard([{x:176,y:450},{x:271,y:450},{x:271,y:540},{x:176,y:540}],.72,2)
    ];
    cards=[{x:143,y:144,got:false},{x:475,y:493,got:false},{x:755,y:225,got:false}];
    decoys=2;alert=0;elapsed=0;particles=[];floaters=[];won=false;
    syncHud();
  }
  function makeGuard(path,speed,index){return {path,speed,index,point:0,x:path[0].x,y:path[0].y,face:0,distTarget:null,distract:0};}
  function begin(){newGame();state='playing';menuScreen.hidden=true;pauseScreen.hidden=true;endScreen.hidden=true;hud.hidden=false;document.getElementById('objectiveText').textContent='COLLECT ALL 3 GAG CARDS, THEN FIND THE EXIT';}
  function syncHud(){
    const count=cards?cards.filter(c=>c.got).length:0;
    document.getElementById('collectCount').textContent=`${count} / 3`;
    document.getElementById('decoys').textContent=decoys;
    document.getElementById('touchDecoys').textContent=decoys;
    alertBar.style.width=`${alert}%`;
    alertTrack.classList.toggle('hot',alert>62);
    const txt=document.getElementById('alertText');
    txt.textContent=alert>72?'UH-OH':alert>35?'SUSPICIOUS':'CLEAR';
    txt.style.color=alert>72?'#ff746d':alert>35?'#f6cb65':'#8eddb7';
  }
  function pause(){if(state==='playing'){state='paused';pauseScreen.hidden=false;}else if(state==='paused'){state='playing';pauseScreen.hidden=true;}}
  function finish(win){state=win?'won':'caught';won=win;hud.hidden=true;endScreen.hidden=false;
    document.getElementById('endIcon').textContent=win?'✦':'◌';
    document.getElementById('endEyebrow').textContent=win?'A PERFECT EXIT':'THE SHOW IS OVER';
    document.getElementById('endTitle').textContent=win?'ENCORE!':'BUSTED!';
    document.getElementById('endMessage').textContent=win?'You stole the punchlines and left without a sound.':'The guards caught your act. Take a bow, then try again.';
    document.getElementById('finalCount').textContent=`${cards.filter(c=>c.got).length} / 3`;
    document.getElementById('againButton').innerHTML='PLAY AGAIN <span>↻</span>';
    if(win){let score=Math.floor(elapsed);if(!best||score<best){best=score;localStorage.setItem('gaggedBest',best);document.getElementById('bestScore').textContent=`BEST: ${best}S`;}}
  }

  function circleRect(cx,cy,r,rect){const x=Math.max(rect.x,Math.min(cx,rect.x+rect.w)),y=Math.max(rect.y,Math.min(cy,rect.y+rect.h));return (cx-x)**2+(cy-y)**2<r*r;}
  function movePlayer(dx,dy){
    let nx=player.x+dx,ny=player.y;
    if(nx<42||nx>918)nx=player.x;
    if(!walls.some(r=>circleRect(nx,ny,player.r,r)))player.x=nx;
    ny=player.y+dy;if(ny<72||ny>565)ny=player.y;
    if(!walls.some(r=>circleRect(player.x,ny,player.r,r)))player.y=ny;
  }
  function blocked(x1,y1,x2,y2){
    const d=Math.hypot(x2-x1,y2-y1),steps=Math.ceil(d/9);
    for(let i=1;i<steps;i++){let t=i/steps,x=x1+(x2-x1)*t,y=y1+(y2-y1)*t;if(walls.some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h))return true;}
    return false;
  }
  function throwDecoy(){if(state!=='playing'||decoys<=0)return;decoys--;const x=Math.max(50,Math.min(910,player.x+Math.cos(player.face)*135)),y=Math.max(80,Math.min(555,player.y+Math.sin(player.face)*135));
    floaters.push({x,y,t:3.4});particles.push({x,y,color:'#f6cb65',n:12});
    guards.forEach(g=>{if(Math.hypot(g.x-x,g.y-y)<310){g.distTarget={x,y};g.distract=3.8;}});syncHud();
  }
  function update(dt){
    if(state!=='playing')return;elapsed+=dt;
    const ix=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0);
    const iy=(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0);
    const moving=ix!==0||iy!==0,tip=keys.has(' ')||keys.has('Space'),sprint=(keys.has('Shift')&&!tip),mult=tip?.57:sprint?1.52:1;
    if(moving){const len=Math.hypot(ix,iy);const vx=ix/len,vy=iy/len;player.face=Math.atan2(vy,vx);movePlayer(vx*player.speed*mult*dt,vy*player.speed*mult*dt);player.step+=dt*(tip?4:9);}
    guards.forEach(g=>{
      if(g.distract>0&&g.distTarget){g.distract-=dt;let tx=g.distTarget.x,ty=g.distTarget.y,dd=Math.hypot(tx-g.x,ty-g.y);if(dd>5){g.face=Math.atan2(ty-g.y,tx-g.x);let sp=g.speed*100;g.x+=Math.cos(g.face)*Math.min(sp*dt,dd);g.y+=Math.sin(g.face)*Math.min(sp*dt,dd);}else if(g.distract<.35)g.distTarget=null;
      }else{g.distract=0;let p=g.path[g.point],dd=Math.hypot(p.x-g.x,p.y-g.y);if(dd<3)g.point=(g.point+1)%g.path.length;else{g.face=Math.atan2(p.y-g.y,p.x-g.x);let step=g.speed*100*dt;g.x+=Math.cos(g.face)*Math.min(step,dd);g.y+=Math.sin(g.face)*Math.min(step,dd);}}
    });
    let danger=0;
    guards.forEach(g=>{let dx=player.x-g.x,dy=player.y-g.y,d=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),ad=Math.abs(Math.atan2(Math.sin(angle-g.face),Math.cos(angle-g.face))),radius=tip?52:sprint?148:104;
      if(g.distract>0)radius*=.25;
      if(d<radius&&ad<.92&& !blocked(g.x,g.y,player.x,player.y))danger=Math.max(danger,1-(d/radius));
      if(sprint&&d<180&&g.distract<=0&&Math.random()<dt*.55){g.distTarget={x:player.x,y:player.y};g.distract=1.5;}
    });
    if(danger>0)alert=Math.min(100,alert+dt*(tip?10:29)*danger);else alert=Math.max(0,alert-dt*14);
    if(alert>=100){syncHud();finish(false);return;}
    cards.forEach(c=>{if(!c.got&&Math.hypot(player.x-c.x,player.y-c.y)<25){c.got=true;particles.push({x:c.x,y:c.y,color:'#f6cb65',n:18});syncHud();}});
    floaters=floaters.filter(f=>(f.t-=dt)>0);
    particles.forEach(p=>p.t=(p.t||.55)-dt);particles=particles.filter(p=>p.t>0);
    if(cards.every(c=>c.got)&&Math.hypot(player.x-880,player.y-510)<35)finish(true);
    syncHud();
  }

  function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
  function draw(){
    ctx.clearRect(0,0,W,H);
    // museum floor
    ctx.fillStyle='#24232b';ctx.fillRect(0,0,W,H);
    for(let y=52;y<H;y+=48){for(let x=28;x<W;x+=48){ctx.fillStyle=((x/48+y/48)%2<1)?'#292830':'#27262e';ctx.fillRect(x,y,47,47);ctx.strokeStyle='#ffffff08';ctx.strokeRect(x+.5,y+.5,46,46);}}
    // outer trim, gallery rails
    ctx.fillStyle='#39343b';ctx.fillRect(0,0,W,55);ctx.fillRect(0,565,W,35);ctx.fillRect(0,55,28,510);ctx.fillRect(932,55,28,510);
    ctx.strokeStyle='#a58c64';ctx.lineWidth=2;ctx.strokeRect(28,55,904,510);ctx.lineWidth=1;
    ctx.fillStyle='#b9a378';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText('GALLERY 04  ·  OBJECTS OF QUESTIONABLE IMPORTANCE',480,33);
    // spotlight pools
    [[250,180],[450,185],[740,210],[230,460],[540,470],[820,430]].forEach(([x,y],i)=>{let grd=ctx.createRadialGradient(x,y,10,x,y,145);grd.addColorStop(0,'rgba(249,211,148,.095)');grd.addColorStop(1,'rgba(249,211,148,0)');ctx.fillStyle=grd;ctx.fillRect(x-145,y-145,290,290);});
    // doorway and exit
    ctx.fillStyle='#504746';ctx.fillRect(850,541,78,26);ctx.fillStyle='#2d2527';ctx.fillRect(861,541,54,24);
    const cardCount=cards?cards.filter(c=>c.got).length:0,active=cardCount===3;
    ctx.save();ctx.translate(880,510);ctx.shadowColor=active?'#64e0bb':'#ff745c';ctx.shadowBlur=active?22:8;ctx.strokeStyle=active?'#80e4c2':'#cf7668';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,20,Math.PI,Math.PI*2);ctx.stroke();ctx.fillStyle=active?'#61d6b1':'#57454a';ctx.fillRect(-18,0,36,19);ctx.restore();
    ctx.fillStyle=active?'#94edcb':'#b99088';ctx.font='8px monospace';ctx.fillText(active?'EXIT OPEN':'EXIT LOCKED',880,540);
    // exhibit shadows and plinths
    walls.forEach((r,i)=>{
      ctx.fillStyle='#12121855';ctx.fillRect(r.x+5,r.y+7,r.w,r.h);
      ctx.fillStyle='#65564f';ctx.fillRect(r.x,r.y,r.w,r.h);
      ctx.fillStyle='#8b7666';ctx.fillRect(r.x+3,r.y+3,r.w-6,5);
      ctx.fillStyle='#484147';ctx.fillRect(r.x+5,r.y+10,r.w-10,r.h-13);
      ctx.strokeStyle='#ad9270';ctx.globalAlpha=.6;ctx.strokeRect(r.x+.5,r.y+.5,r.w-1,r.h-1);ctx.globalAlpha=1;
      // little surreal exhibits
      ctx.save();ctx.translate(r.x+r.w/2,r.y+r.h/2);
      if(i%3===0){ctx.fillStyle='#df916e';ctx.beginPath();ctx.arc(0,-5,12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e7c787';ctx.fillRect(-3,-20,6,8);ctx.fillStyle='#423239';ctx.fillRect(-5,-7,3,3);ctx.fillRect(3,-7,3,3);}
      else if(i%3===1){ctx.fillStyle='#8dc5ad';ctx.beginPath();ctx.moveTo(-14,8);ctx.lineTo(0,-18);ctx.lineTo(14,8);ctx.closePath();ctx.fill();ctx.fillStyle='#dfb774';ctx.beginPath();ctx.arc(0,-4,4,0,Math.PI*2);ctx.fill();}
      else{ctx.strokeStyle='#d2a4d5';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,-4,12,0,Math.PI*1.6);ctx.stroke();ctx.fillStyle='#f6cb65';ctx.fillRect(8,-18,5,5);}
      ctx.restore();
    });
    // subtle room placards
    ctx.font='7px monospace';ctx.textAlign='center';ctx.fillStyle='#a9a0a0';[['THE INVISIBLE','126,282'],['A VERY LOUD','469,290'],['UNTITLED (MUTE)','691,463']].forEach(([s,pos])=>{let [x,y]=pos.split(',').map(Number);ctx.fillText(s,x,y);});
    // guard vision cones drawn behind tokens
    guards?.forEach(g=>{let radius=keys.has(' ')||keys.has('Space')?52:104;if(g.distract>0)radius*=.35;ctx.save();ctx.translate(g.x,g.y);ctx.rotate(g.face);ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,radius,-.78,.78);ctx.closePath();ctx.fillStyle=g.distract>0?'rgba(246,203,101,.06)':'rgba(255,116,92,.075)';ctx.fill();ctx.strokeStyle=g.distract>0?'rgba(246,203,101,.15)':'rgba(255,116,92,.18)';ctx.stroke();ctx.restore();});
    // cards
    cards?.forEach(c=>{if(c.got){ctx.globalAlpha=.22;drawCard(c.x,c.y,true);ctx.globalAlpha=1;}else{let bob=Math.sin(performance.now()/260+c.x)*3;ctx.save();ctx.shadowColor='#f6cb65';ctx.shadowBlur=17;drawCard(c.x,c.y+bob,false);ctx.restore();}});
    // decoy notes
    floaters.forEach(f=>{ctx.save();ctx.globalAlpha=Math.min(1,f.t*2);ctx.translate(f.x,f.y);ctx.rotate(Math.sin(performance.now()/100)*.1);ctx.fillStyle='#f6cb65';ctx.fillRect(-9,-7,18,14);ctx.fillStyle='#725b32';ctx.font='9px serif';ctx.textAlign='center';ctx.fillText('?!',0,3);ctx.restore();});
    // particles
    particles.forEach(p=>{let t=p.t/.55;for(let i=0;i<p.n;i++){let a=i*6.28/p.n,rad=(1-t)*28;ctx.globalAlpha=t;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x+Math.cos(a)*rad,p.y+Math.sin(a)*rad,2.2*t,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;});
    // actors
    guards?.forEach(drawGuard);
    if(player)drawPlayer();
    // grain overlay
    ctx.fillStyle='rgba(6,7,10,.12)';ctx.fillRect(0,0,W,2);ctx.fillRect(0,H-2,W,2);
    requestAnimationFrame(draw);
  }
  function drawCard(x,y,dim){ctx.save();ctx.translate(x,y);ctx.rotate(-.16);ctx.fillStyle=dim?'#9b8b68':'#f6cb65';ctx.fillRect(-11,-9,22,18);ctx.fillStyle='#453b38';ctx.font='bold 12px Georgia';ctx.textAlign='center';ctx.fillText('!',0,5);ctx.strokeStyle='#927a49';ctx.strokeRect(-11,-9,22,18);ctx.restore();}
  function drawGuard(g){ctx.save();ctx.translate(g.x,g.y);ctx.rotate(g.face);ctx.fillStyle='#11131a66';ctx.beginPath();ctx.ellipse(0,14,16,6,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=g.distract>0?'#d5a856':'#d87661';ctx.beginPath();ctx.roundRect(-12,-13,24,27,8);ctx.fill();ctx.fillStyle='#27242d';ctx.fillRect(-9,-17,18,8);ctx.fillStyle='#e8b665';ctx.fillRect(-6,-19,12,4);ctx.fillStyle='#f4ddba';ctx.beginPath();ctx.ellipse(3,-3,7,6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#34303a';ctx.beginPath();ctx.arc(6,-3,2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f1c78a';ctx.fillRect(5,9,5,8);ctx.restore();
    if(g.distract>0){ctx.fillStyle='#f6cb65';ctx.font='bold 17px sans-serif';ctx.textAlign='center';ctx.fillText('?',g.x,g.y-24);}
  }
  function drawPlayer(){ctx.save();ctx.translate(player.x,player.y);ctx.rotate(player.face);ctx.fillStyle='#11131a77';ctx.beginPath();ctx.ellipse(-1,14,15,6,0,0,Math.PI*2);ctx.fill();
    // body / scarf / face
    ctx.fillStyle='#79b9a2';ctx.beginPath();ctx.roundRect(-12,-8,24,23,8);ctx.fill();ctx.fillStyle='#e4bd91';ctx.beginPath();ctx.arc(2,-8,10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f06e68';ctx.beginPath();ctx.ellipse(0,-16,13,6,-.1,Math.PI,Math.PI*2);ctx.fill();ctx.fillStyle='#25212a';ctx.fillRect(-2,-10,2,2);ctx.fillRect(5,-10,2,2);ctx.fillStyle='#f17766';ctx.fillRect(7,4,13,4);ctx.fillStyle='#25212a';ctx.fillRect(7,-3,7,2);
    // mute badge
    ctx.fillStyle='#f6cb65';ctx.beginPath();ctx.arc(-9,6,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#433642';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-12,9);ctx.lineTo(-6,3);ctx.stroke();ctx.restore();
  }

  document.getElementById('playButton').addEventListener('click',begin);
  document.getElementById('pauseButton').addEventListener('click',pause);
  document.getElementById('resumeButton').addEventListener('click',pause);
  document.getElementById('restartPause').addEventListener('click',begin);
  document.getElementById('againButton').addEventListener('click',begin);
  document.getElementById('soundToggle').addEventListener('click',e=>{sound=!sound;e.currentTarget.querySelector('span').textContent=sound?'Sound on':'Sound off';e.currentTarget.firstChild.textContent=sound?'♫ ':'♪ ';});
  document.getElementById('tiptoeButton').addEventListener('pointerdown',()=>keys.add(' '));
  ['pointerup','pointerleave','pointercancel'].forEach(ev=>document.getElementById('tiptoeButton').addEventListener(ev,()=>keys.delete(' ')));
  document.getElementById('decoyButton').addEventListener('click',throwDecoy);
  document.querySelectorAll('[data-dir]').forEach(btn=>{const mapping={up:'w',down:'s',left:'a',right:'d'},k=mapping[btn.dataset.dir];btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);keys.add(k);});['pointerup','pointercancel','lostpointercapture'].forEach(ev=>btn.addEventListener(ev,()=>keys.delete(k)));});
  window.addEventListener('keydown',e=>{let k=e.key===' '?' ':e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase()))e.preventDefault();keys.add(k);if(e.repeat&&['e','escape','p','enter'].includes(k))return;if(k==='e')throwDecoy();if(k==='escape'||k==='p')pause();if(state==='menu'&&k==='enter')begin();});
  window.addEventListener('keyup',e=>keys.delete(e.key===' '?' ':e.key.toLowerCase()));
  window.addEventListener('blur',()=>keys.clear());
  function loop(now){let dt=Math.min(.04,(now-lastTime)/1000||0);lastTime=now;update(dt);requestAnimationFrame(loop);}
  newGame();requestAnimationFrame(loop);requestAnimationFrame(draw);
})();
