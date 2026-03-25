import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
// ASCEN BREATHWORX — v5
// Fixes: smooth clouds, low≠depleted, clear cards + dark text
// ═══════════════════════════════════════════════════════════════

const CAP = {
  full:         { label:"Full",         color:"#5CE0D0", glow:"rgba(92,224,208,0.35)",  desc:"Your system is thriving", ns3:82 },
  steady:       { label:"Steady",       color:"#A8CCE8", glow:"rgba(168,204,232,0.25)", desc:"Your system is steady", ns3:55 },
  drawing_down: { label:"Drawing Down", color:"#E8BE6A", glow:"rgba(232,190,106,0.25)", desc:"Your system is working harder today", ns3:35 },
  low:          { label:"Low",          color:"#E09878", glow:"rgba(224,152,120,0.2)",  desc:"Your body needs gentleness", ns3:20 },
  depleted:     { label:"Depleted",     color:"#D88AA0", glow:"rgba(216,138,160,0.18)", desc:"Your body needs rest", ns3:8 },
};

// More granular weather mapping — low and depleted now very different
const WEATHER = {
  full:         { clouds:.05, warm:1.0, calm:1.0,  skyTint:[0,0,0],     waterDim:0 },
  steady:       { clouds:.25, warm:.7,  calm:.75,  skyTint:[0,0,0],     waterDim:0 },
  drawing_down: { clouds:.60, warm:.4,  calm:.45,  skyTint:[10,10,15],  waterDim:.1 },
  low:          { clouds:.82, warm:.18, calm:.25,  skyTint:[20,15,25],  waterDim:.25 },
  depleted:     { clouds:.96, warm:.05, calm:.12,  skyTint:[35,20,40],  waterDim:.45 },
};

function lunoC(t){return[14+t*90,50+t*170,80+t*175]}
function lunaC(t){return[120+t*110,60+t*100,80+t*90]}
function lerp(a,b,t){return a+(b-a)*t}
function lerpC(a,b,t){return[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)]}

// ─── Surface Ocean + Sky (single continuous canvas, never restarts) ───
function SurfaceOcean({coh=0.5,capState="steady",char="luno",sess=7}){
  const ref=useRef(null),parts=useRef([]),raf=useRef(null),initd=useRef(false);
  const dyn=useRef({coh,capState,char,sess});
  dyn.current={coh,capState,char,sess};

  useEffect(()=>{
    if(initd.current)return;
    initd.current=true;
    const c=ref.current;if(!c)return;const ctx=c.getContext("2d");
    const dpr=window.devicePixelRatio||1;let w,h;
    function resize(){w=c.offsetWidth;h=c.offsetHeight;c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
    resize();window.addEventListener("resize",resize);

    // Init 70 plankton particles once
    const iW=w||430,iH=h||800;
    for(let i=0;i<70;i++) parts.current.push({
      x:Math.random()*iW, y:iH*.44+Math.random()*iH*.56,
      sz:1.2+Math.random()*3, vx:(Math.random()-.5)*.18, vy:(Math.random()-.5)*.07,
      ph:Math.random()*Math.PI*2, ps:.003+Math.random()*.006,
      isLuno:Math.random()<.55, dp:.3+Math.random()*.7
    });

    // Smooth interpolation targets
    let sClouds=.25, sWarm=.7, sCalm=.75, sDim=0, sTint=[0,0,0];

    function draw(){
      if(!w||!h){raf.current=requestAnimationFrame(draw);return}
      const d=dyn.current;
      const wth=WEATHER[d.capState]||WEATHER.steady;
      const isL=d.char==="luno";
      const co=d.coh;
      const t=Date.now()*.001;

      // Smooth interpolate weather (prevents choppy transitions)
      sClouds+=(wth.clouds-sClouds)*.02;
      sWarm+=(wth.warm-sWarm)*.02;
      sCalm+=(wth.calm-sCalm)*.02;
      sDim+=(wth.waterDim-sDim)*.02;
      sTint[0]+=(wth.skyTint[0]-sTint[0])*.02;
      sTint[1]+=(wth.skyTint[1]-sTint[1])*.02;
      sTint[2]+=(wth.skyTint[2]-sTint[2])*.02;

      ctx.clearRect(0,0,w,h);
      const skyH=h*.44;

      // ── SKY ──
      const skyTop=lerpC([135-sTint[0],206-sTint[1]*2,250-sTint[2]],[140-sTint[0],150-sTint[1],165-sTint[2]],sClouds);
      const skyMid=lerpC([255,218-sTint[1],160-sTint[2]],[185-sTint[0],180-sTint[1],190-sTint[2]],sClouds);
      const skyBot=lerpC([255,200-sTint[1],140-sTint[2]],[170-sTint[0],168-sTint[1],178-sTint[2]],sClouds);
      const sg=ctx.createLinearGradient(0,0,0,skyH);
      sg.addColorStop(0,`rgb(${Math.max(0,skyTop[0])|0},${Math.max(0,skyTop[1])|0},${Math.max(0,skyTop[2])|0})`);
      sg.addColorStop(.5,`rgb(${Math.max(0,skyMid[0])|0},${Math.max(0,skyMid[1])|0},${Math.max(0,skyMid[2])|0})`);
      sg.addColorStop(1,`rgb(${Math.max(0,skyBot[0])|0},${Math.max(0,skyBot[1])|0},${Math.max(0,skyBot[2])|0})`);
      ctx.fillStyle=sg;ctx.fillRect(0,0,w,skyH);

      // ── SUN ──
      if(sWarm>.08){
        const sx=w*.62,sy=skyH*.22,sr=25+sWarm*30;
        const sunG=ctx.createRadialGradient(sx,sy,0,sx,sy,sr*3.5);
        sunG.addColorStop(0,`rgba(255,242,205,${sWarm*.6})`);
        sunG.addColorStop(.25,`rgba(255,225,165,${sWarm*.25})`);
        sunG.addColorStop(1,`rgba(255,200,120,0)`);
        ctx.fillStyle=sunG;ctx.fillRect(0,0,w,skyH);
        ctx.beginPath();ctx.arc(sx,sy,sr*.35,0,Math.PI*2);
        ctx.fillStyle=`rgba(255,248,225,${sWarm*.7})`;ctx.fill();
      }

      // ── CLOUDS (smooth — positions computed from time, not state changes) ──
      if(sClouds>.04){
        const cn=Math.round(sClouds*10);
        for(let i=0;i<cn;i++){
          // Each cloud has a unique speed and vertical position seeded by index
          const speed=1.8+((i*7+3)%5)*.6;
          const baseY=skyH*(.08+((i*13+5)%7)*.11);
          const cx=((i*127.3+t*speed)%(w+280))-140;
          const cy=baseY+Math.sin(t*.15+i*2.1)*8;
          const cw=65+((i*17+11)%6)*30;
          const ch=15+((i*11+7)%4)*8;
          const a=Math.min(.75,.2+sClouds*.5);

          // Main cloud body
          ctx.beginPath();ctx.ellipse(cx,cy,cw,ch,0,0,Math.PI*2);
          ctx.fillStyle=`rgba(230,234,240,${a})`;ctx.fill();
          // Upper puff
          ctx.beginPath();ctx.ellipse(cx+cw*.3,cy-ch*.55,cw*.5,ch*.7,0,0,Math.PI*2);
          ctx.fillStyle=`rgba(235,238,244,${a*.85})`;ctx.fill();
          // Side puff
          ctx.beginPath();ctx.ellipse(cx-cw*.25,cy-ch*.2,cw*.35,ch*.6,0,0,Math.PI*2);
          ctx.fillStyle=`rgba(228,232,238,${a*.7})`;ctx.fill();
        }
      }

      // ── WATER SURFACE ──
      const wY=skyH;
      ctx.beginPath();ctx.moveTo(0,wY);
      for(let x=0;x<=w;x+=3){
        const wH=2+(1-sCalm)*6;
        const freq1=.016+(.004*(1-sCalm));
        ctx.lineTo(x,wY+Math.sin(x*freq1+t*.6)*wH+Math.sin(x*.028+t*1.0)*wH*.35);
      }
      ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();

      const dimF=1-sDim;
      const wg=ctx.createLinearGradient(0,wY,0,h);
      if(isL){
        wg.addColorStop(0,`rgba(${(45*dimF)|0},${(185*dimF)|0},${(185*dimF)|0},${.26+sWarm*.16})`);
        wg.addColorStop(.2,`rgba(${(18*dimF)|0},${(85*dimF)|0},${(115*dimF)|0},${.46+sWarm*.1})`);
        wg.addColorStop(.55,`rgba(${(10*dimF)|0},${(45*dimF)|0},${(70*dimF)|0},.82)`);
        wg.addColorStop(1,`rgba(${(4*dimF)|0},${(20*dimF)|0},${(40*dimF)|0},.96)`);
      } else {
        wg.addColorStop(0,`rgba(${(145*dimF)|0},${(105*dimF)|0},${(125*dimF)|0},${.2+sWarm*.1})`);
        wg.addColorStop(.2,`rgba(${(65*dimF)|0},${(38*dimF)|0},${(58*dimF)|0},${.4+sWarm*.1})`);
        wg.addColorStop(.55,`rgba(${(32*dimF)|0},${(16*dimF)|0},${(30*dimF)|0},.82)`);
        wg.addColorStop(1,`rgba(${(14*dimF)|0},${(7*dimF)|0},${(16*dimF)|0},.96)`);
      }
      ctx.fillStyle=wg;ctx.fill();

      // ── LIGHT RAYS ──
      if(sWarm>.2){
        const rc=Math.round(sWarm*5);
        for(let i=0;i<rc;i++){
          const rx=w*(.25+i*.13)+Math.sin(t*.2+i*1.5)*10;
          const rw=5+sWarm*10;
          const rg=ctx.createLinearGradient(rx,wY,rx+20,h*.7);
          rg.addColorStop(0,`rgba(255,232,175,${sWarm*.09})`);
          rg.addColorStop(1,`rgba(255,232,175,0)`);
          ctx.save();ctx.beginPath();
          ctx.moveTo(rx-rw/2,wY);ctx.lineTo(rx+rw*1.3,h*.75);ctx.lineTo(rx+rw*.3,h*.75);
          ctx.closePath();ctx.fillStyle=rg;ctx.fill();ctx.restore();
        }
      }

      // ── PLANKTON ──
      const visCount=Math.round(30+co*25+Math.min(d.sess/80,1)*15);
      for(let i=0;i<parts.current.length;i++){
        const p=parts.current[i];
        p.ph+=p.ps;
        p.x+=p.vx+Math.sin(p.ph*.6)*.08;
        p.y+=p.vy+Math.cos(p.ph*.4)*.04;
        if(p.x<-15)p.x=w+15;if(p.x>w+15)p.x=-15;
        if(p.y<wY+8)p.y=h-8;if(p.y>h+10)p.y=wY+15;
        if(i>=visCount)continue;
        const useL=isL?p.isLuno:!p.isLuno;
        const col=useL?lunoC(co):lunaC(co*.75);
        const alpha=(0.12+co*.46+Math.sin(p.ph)*.14)*p.dp*(1-sDim*.5);
        const sz=(p.sz+co*2.5)*(.5+p.dp*.6);
        const glow=(3+co*12)*p.dp;
        ctx.beginPath();ctx.arc(p.x,p.y,sz,0,Math.PI*2);
        ctx.fillStyle=`rgba(${col[0]|0},${col[1]|0},${col[2]|0},${Math.max(0,alpha).toFixed(3)})`;
        if(glow>1.5){ctx.shadowColor=`rgba(${col[0]|0},${col[1]|0},${col[2]|0},${(alpha*.45).toFixed(3)})`;ctx.shadowBlur=glow;}
        ctx.fill();ctx.shadowBlur=0;
      }
      raf.current=requestAnimationFrame(draw);
    }
    draw();
    return()=>{window.removeEventListener("resize",resize);if(raf.current)cancelAnimationFrame(raf.current)};
  },[]);

  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}} />;
}

// ─── Deep Plankton (continuous) ───
function DeepPlankton({coh=.5,char="luno",sess=7}){
  const ref=useRef(null),parts=useRef([]),raf=useRef(null),initd=useRef(false);
  const dyn=useRef({coh,char,sess});
  dyn.current={coh,char,sess};
  useEffect(()=>{
    if(initd.current)return;initd.current=true;
    const c=ref.current;if(!c)return;const ctx=c.getContext("2d");
    const dpr=window.devicePixelRatio||1;let w,h;
    function resize(){w=c.offsetWidth;h=c.offsetHeight;c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
    resize();window.addEventListener("resize",resize);
    for(let i=0;i<70;i++) parts.current.push({
      x:Math.random()*(w||430),y:Math.random()*(h||800),
      sz:1+Math.random()*3.5,vx:(Math.random()-.5)*.16,vy:(Math.random()-.5)*.07,
      ph:Math.random()*Math.PI*2,ps:.003+Math.random()*.006,
      isLuno:Math.random()<.55,dp:.3+Math.random()*.7
    });
    function draw(){
      if(!w||!h){raf.current=requestAnimationFrame(draw);return}
      const d=dyn.current;const co=d.coh;const isL=d.char==="luno";
      ctx.clearRect(0,0,w,h);
      const vis=Math.round(40+co*20+Math.min(d.sess/80,1)*10);
      for(let i=0;i<parts.current.length;i++){
        const p=parts.current[i];
        p.ph+=p.ps;p.x+=p.vx+Math.sin(p.ph*.6)*.08;p.y+=p.vy+Math.cos(p.ph*.4)*.04;
        if(p.x<-15)p.x=w+15;if(p.x>w+15)p.x=-15;if(p.y<-15)p.y=h+15;if(p.y>h+15)p.y=-15;
        if(i>=vis)continue;
        const useL=isL?p.isLuno:!p.isLuno;
        const col=useL?lunoC(co):lunaC(co*.75);
        const alpha=(.12+co*.5+Math.sin(p.ph)*.14)*p.dp;
        const sz=(p.sz+co*2.5)*(.5+p.dp*.6);
        const glow=(3+co*14)*p.dp;
        ctx.beginPath();ctx.arc(p.x,p.y,sz,0,Math.PI*2);
        ctx.fillStyle=`rgba(${col[0]|0},${col[1]|0},${col[2]|0},${Math.max(0,alpha).toFixed(3)})`;
        if(glow>1.5){ctx.shadowColor=`rgba(${col[0]|0},${col[1]|0},${col[2]|0},${(alpha*.45).toFixed(3)})`;ctx.shadowBlur=glow;}
        ctx.fill();ctx.shadowBlur=0;
      }
      raf.current=requestAnimationFrame(draw);
    }
    draw();
    return()=>{window.removeEventListener("resize",resize);if(raf.current)cancelAnimationFrame(raf.current)};
  },[]);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}} />;
}

// ─── Mini Luno ───
function Luno({size=54,coh=.45,char="luno"}){
  const c=coh,isL=char==="luno";
  const core=isL?`rgba(${14+c*90},${50+c*170},${80+c*175},${.55+c*.35})`:`rgba(${120+c*110},${60+c*100},${80+c*90},${.5+c*.4})`;
  const mid=isL?`rgba(${14+c*60},${50+c*120},${80+c*130},${.25+c*.3})`:`rgba(${100+c*70},${50+c*65},${70+c*60},${.2+c*.3})`;
  const outer=isL?`rgba(${14+c*40},${50+c*70},${80+c*80},${.1+c*.18})`:`rgba(${80+c*50},${40+c*45},${60+c*45},${.08+c*.16})`;
  const gl=4+c*14;
  return(
    <div style={{width:size,height:size,position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{position:"absolute",width:size,height:size,borderRadius:"50%",background:outer,boxShadow:`0 0 ${gl*2}px ${outer}`,animation:"lP 8s ease-in-out infinite alternate"}} />
      <div style={{position:"absolute",width:size*.56,height:size*.56,borderRadius:"50%",background:mid,boxShadow:`0 0 ${gl}px ${mid}`}} />
      <div style={{position:"absolute",width:size*.2,height:size*.2,borderRadius:"50%",background:`radial-gradient(circle,${core},${mid})`,boxShadow:`0 0 ${gl}px ${core}`}} />
      <div style={{position:"absolute",width:5,height:5,borderRadius:"50%",background:"#fff",opacity:.3+c*.55,boxShadow:`0 0 ${4+c*10}px rgba(255,255,255,${.2+c*.4})`}} />
    </div>
  );
}

// ─── Coherence Rings ───
function CohRings({coh=.45,size=40,char="luno"}){
  const rings=[{sz:.86},{sz:.6},{sz:.36}];const md=5*(1-coh),op=.12+coh*.5;
  const isL=char==="luno";
  const col=isL?`rgba(${14+coh*90},${50+coh*170},${80+coh*175},${op})`:`rgba(${120+coh*110},${60+coh*100},${80+coh*90},${op})`;
  const gs=coh>.4?(coh-.4)/.6:0;
  return(
    <div style={{width:size,height:size,position:"relative"}}>
      {rings.map((r,i)=>{const s=size*r.sz;const ox=coh>.85?0:Math.sin(i*2.3)*md;const oy=coh>.85?0:Math.cos(i*1.8)*md;
        return <div key={i} style={{position:"absolute",width:s,height:s,left:(size-s)/2+ox,top:(size-s)/2+oy,borderRadius:"50%",border:`${1+coh*.8}px solid ${col}`,boxShadow:gs>0?`0 0 ${3+gs*10}px ${col}`:"none",transition:"all 2.5s ease"}} />;
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ARRIVAL SCREEN — standalone component (never remounts from parent rerenders)
// ═══════════════════════════════════════════════════
const EXERCISES=[
  {name:"Grounding",instruction:"Press your feet into the ground. Feel five things you can touch. Four you can hear. Three you can see."},
  {name:"Self-Holding",instruction:"Place one hand on your chest. One on your belly. Feel your hands rise and fall. You are holding yourself."},
  {name:"Orienting",instruction:"Look around slowly. Name one thing you see in each direction. Your body is finding its place."},
];

function ArrivalScreen({capState,coh,char,sess,onSession,onHome}){
  const [phase,setPhase]=useState("reading");
  const [arrNs3,setArrNs3]=useState(CAP[capState]?.ns3||55);
  const [exercise,setExercise]=useState(null);
  const [timer,setTimer]=useState(0);
  const isL=char==="luno";
  const needsSomatic=arrNs3<25;

  useEffect(()=>{if(phase!=="reading")return;const t=setTimeout(()=>{if(needsSomatic)setPhase("somatic");else setPhase("ready")},3500);return()=>clearTimeout(t)},[phase,needsSomatic]);
  useEffect(()=>{if(phase==="somatic"&&!exercise)setExercise(EXERCISES[Math.floor(Math.random()*3)])},[phase,exercise]);
  useEffect(()=>{
    if(phase!=="somatic"||!exercise)return;
    const iv=setInterval(()=>{setTimer(t=>{if(t>=120){clearInterval(iv);const imp=Math.min(100,arrNs3+18+Math.round(Math.random()*8));setArrNs3(imp);setPhase(imp>=25?"improved":"exit_offer");return 120}return t+1})},1000);
    return()=>clearInterval(iv);
  },[phase,exercise,arrNs3]);

  const wth=WEATHER[capState]||WEATHER.steady;
  const skyT=lerpC([135,206,250],[130,135,155],wth.clouds);
  const skyB=lerpC([255,200,140],[155,150,165],wth.clouds);
  const grad=`linear-gradient(180deg,rgb(${Math.max(0,skyT[0]-wth.skyTint[0])|0},${Math.max(0,skyT[1]-wth.skyTint[1]*2)|0},${Math.max(0,skyT[2]-wth.skyTint[2])|0}),rgba(${Math.max(0,skyB[0]-wth.skyTint[0])|0},${Math.max(0,skyB[1]-wth.skyTint[1])|0},${Math.max(0,skyB[2]-wth.skyTint[2])|0},.9) 44%,${isL?"rgba(10,45,70,.95)":"rgba(32,16,30,.95)"} 70%,${isL?"rgba(4,20,40,1)":"rgba(14,7,16,1)"} 100%)`;

  const ArrCard=({children,style})=>(
    <div style={{background:"rgba(14,28,50,0.45)",border:"1px solid rgba(160,180,210,0.08)",borderRadius:18,padding:"16px 18px",...style}}>{children}</div>
  );

  return(
    <div style={{position:"fixed",inset:0,zIndex:100,background:grad,fontFamily:"'Outfit',-apple-system,sans-serif",color:"#fff",overflow:"hidden"}}>
      <div style={{position:"absolute",top:"44%",left:0,right:0,bottom:0,overflow:"hidden",pointerEvents:"none"}}><DeepPlankton coh={coh} char={char} sess={sess} /></div>
      {phase==="reading"&&<div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:160,height:160,borderRadius:"50%",border:`2px solid ${isL?"rgba(78,205,196,.3)":"rgba(210,140,160,.3)"}`,animation:"scanPulse 1.5s ease-in-out infinite",pointerEvents:"none"}} />}

      <div style={{position:"relative",zIndex:2,height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 32px"}}>
        {phase==="reading"&&(
          <div style={{textAlign:"center",animation:"fadeIn 1s ease"}}>
            <Luno size={80} coh={coh} char={char} />
            <div style={{marginTop:28,fontSize:16,fontWeight:300,color:"rgba(255,255,255,.75)",lineHeight:1.9}}>Let {isL?"Luno":"Luna"} check in with you.</div>
            <div style={{marginTop:8,fontSize:12,fontWeight:300,color:"rgba(255,255,255,.35)"}}>Reading your system...</div>
            <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:20}}>{[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:isL?"rgba(78,205,196,.5)":"rgba(210,140,160,.5)",animation:`dotPulse 1.5s ease-in-out ${i*.3}s infinite`}} />)}</div>
          </div>
        )}

        {phase==="somatic"&&exercise&&(
          <div style={{textAlign:"center",maxWidth:340,animation:"fadeIn 1s ease"}}>
            <Luno size={70} coh={coh} char={char} />
            <ArrCard style={{marginTop:24,textAlign:"left"}}>
              <div style={{fontSize:10,fontWeight:500,letterSpacing:2,color:isL?"rgba(78,205,196,.6)":"rgba(210,140,160,.6)",textTransform:"uppercase",marginBottom:8}}>{exercise.name}</div>
              <div style={{fontSize:14,fontWeight:300,color:"rgba(255,255,255,.75)",lineHeight:1.8}}>{exercise.instruction}</div>
              <div style={{marginTop:14,height:3,background:"rgba(255,255,255,.08)",borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:2,background:isL?"rgba(78,205,196,.5)":"rgba(210,140,160,.5)",width:`${(timer/120)*100}%`,transition:"width 1s linear"}} />
              </div>
              <div style={{marginTop:6,fontSize:10,color:"rgba(255,255,255,.25)",textAlign:"right"}}>{Math.floor(timer/60)}:{String(timer%60).padStart(2,"0")} / 2:00</div>
            </ArrCard>
            <div style={{marginTop:16,fontSize:12,fontWeight:300,color:"rgba(255,255,255,.4)",lineHeight:1.7,fontStyle:"italic"}}>Your body is carrying something right now. Let's release it together.</div>
            <div onClick={()=>{setArrNs3(Math.min(100,arrNs3+10));setPhase("ready")}} style={{marginTop:20,fontSize:11,color:"rgba(255,255,255,.2)",cursor:"pointer"}}>I'm ready to breathe now</div>
          </div>
        )}

        {phase==="ready"&&(
          <div style={{textAlign:"center",animation:"fadeIn 1s ease"}}>
            <Luno size={85} coh={coh} char={char} />
            <div style={{marginTop:24,fontSize:18,fontWeight:200,color:"rgba(255,255,255,.85)",lineHeight:1.8}}>What is your body telling you right now?</div>
            <div style={{marginTop:8,fontSize:14,fontWeight:300,color:"rgba(255,255,255,.5)",lineHeight:1.8}}>Let {isL?"Luno":"Luna"} land. Check in with what you feel.</div>
            <div onClick={onSession} style={{marginTop:36,padding:"13px 44px",background:isL?"rgba(78,205,196,.06)":"rgba(210,140,160,.06)",border:`1px solid ${isL?"rgba(78,205,196,.2)":"rgba(210,140,160,.2)"}`,borderRadius:26,fontSize:13,fontWeight:400,letterSpacing:2,color:isL?"rgba(92,224,210,.8)":"rgba(220,150,170,.8)",cursor:"pointer"}}>Dive In</div>
            <div onClick={onHome} style={{marginTop:18,fontSize:11,color:"rgba(255,255,255,.18)",cursor:"pointer"}}>not now</div>
          </div>
        )}

        {phase==="improved"&&(
          <div style={{textAlign:"center",animation:"fadeIn 1.5s ease"}}>
            <Luno size={85} coh={Math.min(1,coh+.2)} char={char} />
            <div style={{marginTop:24,fontSize:15,fontWeight:300,color:"rgba(255,255,255,.75)",lineHeight:1.9}}>You're settling. Feel that?<br/>Your system is finding its rhythm.</div>
            <div onClick={onSession} style={{marginTop:32,padding:"13px 44px",background:isL?"rgba(78,205,196,.06)":"rgba(210,140,160,.06)",border:`1px solid ${isL?"rgba(78,205,196,.2)":"rgba(210,140,160,.2)"}`,borderRadius:26,fontSize:13,fontWeight:400,letterSpacing:2,color:isL?"rgba(92,224,210,.8)":"rgba(220,150,170,.8)",cursor:"pointer"}}>Let's Begin</div>
          </div>
        )}

        {phase==="exit_offer"&&(
          <div style={{textAlign:"center",maxWidth:320,animation:"fadeIn 1.5s ease"}}>
            <Luno size={75} coh={coh} char={char} />
            <div style={{marginTop:24,fontSize:15,fontWeight:300,color:"rgba(255,255,255,.7)",lineHeight:1.9}}>Your system needs more time to settle.<br/>That's not a problem. That's information.</div>
            <div style={{marginTop:8,fontSize:12,fontWeight:300,color:"rgba(255,255,255,.4)"}}>You showed up. That counts.</div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:28,width:"100%"}}>
              <div onClick={onSession} style={{padding:"11px 0",textAlign:"center",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:22,fontSize:12,fontWeight:400,letterSpacing:1,color:"rgba(255,255,255,.6)",cursor:"pointer"}}>Try a gentle session anyway</div>
              <div onClick={onHome} style={{padding:"11px 0",textAlign:"center",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:22,fontSize:12,fontWeight:300,letterSpacing:1,color:"rgba(255,255,255,.35)",cursor:"pointer"}}>Check back later</div>
            </div>
          </div>
        )}
      </div>
      <div style={{position:"fixed",bottom:12,left:12,zIndex:200,fontSize:9,color:"rgba(255,255,255,.15)",fontFamily:"Outfit"}}>NS3:{arrNs3} · {phase}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN APP — v3 style clear cards, dark text
// ═══════════════════════════════════════════════════
export default function App(){
  const [tab,setTab]=useState("home");
  const [persona,setPersona]=useState("elder");
  const [char,setChar]=useState("luno");
  const [capState,setCapState]=useState("steady");
  const [coh,setCoh]=useState(.5);
  const [sess]=useState(7);
  const [streak]=useState(4);
  const [screen,setScreen]=useState("home");

  useEffect(()=>{
    const iv=setInterval(()=>{
      setCoh(()=>{
        const base=capState==="full"?.72:capState==="steady"?.48:capState==="drawing_down"?.3:capState==="low"?.18:.08;
        return Math.max(.05,Math.min(.95,base+Math.sin(Date.now()*.0004)*.07+Math.cos(Date.now()*.0007)*.03));
      });
    },1200);
    return()=>clearInterval(iv);
  },[capState]);

  const cap=CAP[capState];const isL=char==="luno";

  // Text colors adapt: dark on sky (top cards), light on water (bottom cards)
  const skyTextPrimary = capState==="depleted"?"rgba(60,50,65,0.75)":"rgba(50,40,30,0.85)";
  const skyTextSecondary = capState==="depleted"?"rgba(80,70,85,0.55)":"rgba(70,60,50,0.6)";
  const waterTextPrimary = "rgba(210,220,235,0.88)";
  const waterTextSecondary = "rgba(160,180,210,0.5)";

  const family=[
    {name:"Marcus",state:"steady",initial:"M",role:"Adult Child"},
    {name:"Aisha",state:"full",initial:"A",role:"Grandchild"},
    {name:"Uncle Ray",state:"low",initial:"R",role:"Extended",absent:true},
  ];

  // Card — v3 style: clear/transparent, no frosted glass
  const Card=({children,style,onClick,zone="water"})=>(
    <div onClick={onClick} style={{
      background: zone==="sky"?"rgba(255,255,255,0.18)":"rgba(14,28,50,0.45)",
      border: zone==="sky"?"1px solid rgba(255,255,255,0.22)":"1px solid rgba(160,180,210,0.08)",
      borderRadius:18, padding:"16px 18px", marginBottom:12,
      cursor:onClick?"pointer":"default", transition:"all 0.3s", ...style,
    }}>{children}</div>
  );

  const renderHome=()=>(
    <div style={{padding:"0 20px 110px",position:"relative",zIndex:2}}>
      {/* Greeting — in sky zone, dark text */}
      <div style={{paddingTop:48,marginBottom:18}}>
        <Card zone="sky" style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.2)"}}>
          <div style={{fontSize:10,fontWeight:300,letterSpacing:2.5,color:skyTextSecondary,textTransform:"uppercase",marginBottom:3}}>
            {persona==="elder"?"Elder":persona==="partner"?"Partner":"Welcome back"}
          </div>
          <div style={{fontSize:23,fontWeight:200,color:skyTextPrimary,letterSpacing:.5}}>
            Good morning, Clay.
          </div>
        </Card>
      </div>

      {/* Capacity — sky/water transition zone */}
      <Card zone="sky" style={{position:"relative",overflow:"hidden",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.18)"}}>
        <div style={{position:"absolute",top:0,left:"10%",right:"10%",height:2,background:`linear-gradient(90deg,transparent,${cap.color}55,transparent)`,borderRadius:2}} />
        <div style={{display:"flex",alignItems:"center",gap:13}}>
          <div style={{width:9,height:9,borderRadius:"50%",background:cap.color,boxShadow:`0 0 10px ${cap.glow}`,flexShrink:0}} />
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:500,color:cap.color,letterSpacing:.8}}>{cap.label}</div>
            <div style={{fontSize:11,fontWeight:300,color:skyTextSecondary,marginTop:2}}>{cap.desc}</div>
          </div>
          <CohRings coh={coh} size={40} char={char} />
        </div>
        <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{fontSize:11,fontWeight:300,color:skyTextSecondary,lineHeight:1.7}}>
            Your Tuesday session deposited energy. Your sleep was restorative.
          </div>
        </div>
      </Card>

      {/* Session card — transitions to water zone */}
      <Card zone="water" onClick={()=>setScreen("arrival")}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <Luno size={50} coh={coh} char={char} />
          <div style={{flex:1}}>
            <div style={{fontSize:9,fontWeight:500,letterSpacing:2,color:waterTextSecondary,textTransform:"uppercase",marginBottom:3}}>Next Session</div>
            <div style={{fontSize:15,fontWeight:300,color:waterTextPrimary}}>Session {sess} — The Body Remembers</div>
            <div style={{fontSize:10,fontWeight:300,color:"rgba(160,180,210,0.35)",marginTop:3}}>Foundation Arc · ~12 min</div>
          </div>
        </div>
        <div style={{
          marginTop:14,padding:"9px 0",textAlign:"center",
          background:isL?"rgba(78,205,196,0.07)":"rgba(210,140,160,0.07)",
          border:`1px solid ${isL?"rgba(78,205,196,0.16)":"rgba(210,140,160,0.16)"}`,
          borderRadius:22,fontSize:12,fontWeight:400,letterSpacing:1.5,
          color:isL?"rgba(92,224,210,0.75)":"rgba(220,150,170,0.75)",
        }}>Dive In</div>
      </Card>

      {/* Streak */}
      <Card zone="water" style={{padding:"12px 18px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:22,fontWeight:200,color:"rgba(230,200,130,0.75)"}}>{streak}</div>
          <div>
            <div style={{fontSize:12,fontWeight:300,color:waterTextPrimary}}>day streak</div>
            <div style={{fontSize:10,color:"rgba(160,180,210,0.28)"}}>Your consistency is building something</div>
          </div>
        </div>
      </Card>

      {/* Family */}
      {(persona==="elder"||persona==="partner")&&(
        <Card zone="water">
          <div style={{fontSize:9,fontWeight:500,letterSpacing:2,color:waterTextSecondary,textTransform:"uppercase",marginBottom:11}}>Family</div>
          <div style={{display:"flex",gap:18,overflowX:"auto",paddingBottom:4}}>
            {family.map((m,i)=>{const mc=CAP[m.state];return(
              <div key={i} style={{textAlign:"center",minWidth:54,opacity:m.absent?.35:1}}>
                <div style={{width:42,height:42,borderRadius:"50%",border:`1.5px solid ${mc.color}${m.absent?"33":"55"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:300,color:mc.color,margin:"0 auto 5px",boxShadow:m.absent?"none":`0 0 8px ${mc.glow}`,background:"rgba(14,28,50,0.3)"}}>{m.initial}</div>
                <div style={{fontSize:10,fontWeight:300,color:"rgba(210,220,235,0.55)"}}>{m.name}</div>
                <div style={{fontSize:8,color:"rgba(160,180,210,0.25)",marginTop:1}}>{m.absent?"Welcomed when ready":mc.label}</div>
              </div>
            )})}
          </div>
          <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid rgba(160,180,210,0.05)",fontSize:11,fontWeight:300,color:"rgba(160,180,210,0.4)",display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#FFF5E0",boxShadow:"0 0 6px rgba(255,245,224,0.45)"}} />
            Marcus's light is warm. He breathed today.
          </div>
        </Card>
      )}

      {/* Art */}
      <Card zone="water" style={{padding:"14px 16px"}}>
        <div style={{fontSize:9,fontWeight:500,letterSpacing:2,color:waterTextSecondary,textTransform:"uppercase",marginBottom:10}}>Recent Art</div>
        <div style={{
          height:80,borderRadius:12,overflow:"hidden",
          background:isL
            ?`linear-gradient(135deg,rgba(8,40,60,.8),rgba(30,100,110,.4),rgba(60,180,170,${.1+coh*.12}),rgba(140,100,130,${.06+coh*.06}),rgba(8,40,60,.8))`
            :`linear-gradient(135deg,rgba(40,15,30,.8),rgba(100,50,70,.35),rgba(200,120,140,${.1+coh*.1}),rgba(80,140,160,${.05+coh*.05}),rgba(40,15,30,.8))`,
          display:"flex",alignItems:"flex-end",justifyContent:"flex-end",padding:10,
        }}>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>Session 6 · Mar 22</div>
        </div>
      </Card>

      {/* Co-breath suggestion */}
      {persona==="elder"&&(
        <Card zone="water" style={{background:"rgba(14,28,50,0.3)",border:"1px solid rgba(160,180,210,0.05)"}}>
          <div style={{fontSize:12,fontWeight:300,color:"rgba(200,215,230,0.5)",lineHeight:1.7,fontStyle:"italic"}}>
            You and Marcus co-regulate best on Sunday mornings. Want to invite him to breathe together?
          </div>
        </Card>
      )}
    </div>
  );

  // ─── ARRIVAL ───
  // ─── ARRIVAL + SESSION handled as standalone components below ───

  if(screen==="arrival") return <ArrivalScreen capState={capState} coh={coh} char={char} sess={sess} onSession={()=>setScreen("session")} onHome={()=>setScreen("home")} />;
  if(screen==="session") return(
    <div style={{position:"fixed",inset:0,zIndex:100,background:isL?"linear-gradient(180deg,rgba(8,25,40,1),rgba(4,15,28,1),rgba(2,8,18,1))":"linear-gradient(180deg,rgba(25,12,20,1),rgba(14,6,12,1),rgba(8,3,8,1))",fontFamily:"'Outfit',-apple-system,sans-serif",color:"#fff",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
      <DeepPlankton coh={coh} char={char} sess={sess} />
      <div style={{position:"relative",zIndex:2,textAlign:"center"}}>
        <Luno size={100} coh={coh} char={char} />
        <div style={{marginTop:28,fontSize:11,letterSpacing:3,color:"rgba(255,255,255,.3)",textTransform:"uppercase"}}>Breathing</div>
        <div style={{marginTop:8,fontSize:16,fontWeight:300,color:"rgba(255,255,255,.6)"}}>You are creating your own light.</div>
        <div onClick={()=>setScreen("home")} style={{marginTop:40,fontSize:11,color:"rgba(255,255,255,.18)",cursor:"pointer"}}>← return to surface</div>
      </div>
    </div>
  );

  const tabs=[{id:"home",icon:"⌂",label:"Home"},{id:"gallery",icon:"◇",label:"Gallery"},{id:"family",icon:"♡",label:"Family"},{id:"profile",icon:"⚈",label:"Profile"}];

  return(
    <div style={{width:"100%",maxWidth:430,margin:"0 auto",height:"100vh",position:"relative",overflow:"hidden",background:"#0A1828",fontFamily:"'Outfit',-apple-system,sans-serif",color:"#fff"}}>
      <SurfaceOcean coh={coh} capState={capState} char={char} sess={sess} />
      <div style={{position:"relative",zIndex:2,height:"100%",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
        {tab==="home"&&renderHome()}
      </div>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"rgba(8,20,35,.88)",backdropFilter:"blur(14px)",borderTop:"1px solid rgba(255,255,255,.05)",display:"flex",zIndex:50,padding:"6px 0 env(safe-area-inset-bottom,6px)"}}>
        {tabs.map(t=>(
          <div key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,textAlign:"center",padding:"7px 0",cursor:"pointer"}}>
            <div style={{fontSize:16,marginBottom:2,color:tab===t.id?(isL?"rgba(92,224,210,.8)":"rgba(220,150,170,.8)"):"rgba(160,180,210,.2)",transition:"color .3s"}}>{t.icon}</div>
            <div style={{fontSize:9,fontWeight:tab===t.id?500:300,letterSpacing:1,color:tab===t.id?(isL?"rgba(92,224,210,.7)":"rgba(220,150,170,.7)"):"rgba(160,180,210,.2)",transition:"color .3s"}}>{t.label}</div>
          </div>
        ))}
      </div>
      {/* Dev */}
      <div style={{position:"fixed",top:4,right:4,zIndex:200,display:"flex",gap:3,flexWrap:"wrap",maxWidth:210}}>
        {["luno","luna"].map(ch=><button key={ch} onClick={()=>setChar(ch)} style={{padding:"3px 10px",fontSize:9,background:char===ch?(ch==="luno"?"rgba(78,205,196,.12)":"rgba(210,140,160,.12)"):"rgba(14,28,50,.7)",border:`1px solid ${char===ch?(ch==="luno"?"rgba(78,205,196,.3)":"rgba(210,140,160,.3)"):"rgba(160,180,210,.1)"}`,borderRadius:10,color:char===ch?(ch==="luno"?"rgba(92,224,210,.85)":"rgba(220,150,170,.85)"):"rgba(160,180,210,.4)",cursor:"pointer",fontFamily:"Outfit"}}>{ch}</button>)}
        {["indv","elder","partner"].map(p=><button key={p} onClick={()=>setPersona(p)} style={{padding:"3px 8px",fontSize:8,background:persona===p?"rgba(160,180,210,.1)":"rgba(14,28,50,.7)",border:`1px solid ${persona===p?"rgba(160,180,210,.2)":"rgba(160,180,210,.08)"}`,borderRadius:8,color:persona===p?"rgba(210,220,235,.7)":"rgba(160,180,210,.35)",cursor:"pointer",fontFamily:"Outfit"}}>{p}</button>)}
        {Object.keys(CAP).map(s=><button key={s} onClick={()=>setCapState(s)} style={{padding:"2px 5px",fontSize:7,background:capState===s?`${CAP[s].color}18`:"rgba(14,28,50,.7)",border:`1px solid ${capState===s?CAP[s].color+"33":"rgba(160,180,210,.06)"}`,borderRadius:6,color:capState===s?CAP[s].color:"rgba(160,180,210,.28)",cursor:"pointer",fontFamily:"Outfit"}}>{s.split("_")[0]}</button>)}
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        @keyframes lP{0%{transform:scale(1)}100%{transform:scale(1.04)}}
        @keyframes scanPulse{0%{transform:translate(-50%,-50%) scale(.8);opacity:.6}50%{transform:translate(-50%,-50%) scale(1.2);opacity:.2}100%{transform:translate(-50%,-50%) scale(.8);opacity:.6}}
        @keyframes dotPulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{display:none}
        body{background:#0A1828;margin:0}
      `}</style>
    </div>
  );
}
