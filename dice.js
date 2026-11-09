/* ============ dados: fórmulas ============ */
const SIDES={d4:4,d6:6,d8:8,d10:10,d12:12,d20:20,d100:100};
const MAX_DICE=12;
function randInt(n){
  try{
    const a=new Uint32Array(1),lim=Math.floor(4294967296/n)*n;
    do{crypto.getRandomValues(a)}while(a[0]>=lim);
    return a[0]%n+1;
  }catch(e){return Math.floor(Math.random()*n)+1}
}
function physCount(terms){return terms.reduce((s,t)=>s+t.n*(t.t==='d100'?2:1),0)}
function parseFormula(str){
  const s=String(str||'').replace(/\s+/g,'').toLowerCase().replace(/d%/g,'d100');
  if(!s)return{terms:[],mod:0};
  const re=/([+-]?)(?:(\d*)d(\d+)|(\d+))/g;
  if(s.replace(re,'')!=='')return{error:'Fórmula inválida. Use algo como 1d20+3 ou 2d6.'};
  const terms=[];let mod=0,m;
  re.lastIndex=0;
  while((m=re.exec(s))){
    const sign=m[1]==='-'?-1:1;
    if(m[3]!==undefined){
      if(sign<0)return{error:'Dados negativos não são aceitos. Só o bônus pode ser negativo.'};
      const n=m[2]===''?1:parseInt(m[2],10),t='d'+m[3];
      if(!SIDES[t])return{error:'O dado '+t+' não existe. Use d4, d6, d8, d10, d12, d20 ou d100.'};
      if(n<1||n>MAX_DICE)return{error:'Use de 1 a '+MAX_DICE+' dados de cada tipo.'};
      const ex=terms.find(x=>x.t===t);
      if(ex)ex.n+=n;else terms.push({t,n});
    }else mod+=sign*parseInt(m[4],10);
    if(m[0]==='')re.lastIndex++;
  }
  if(physCount(terms)>MAX_DICE)return{error:'Use até '+MAX_DICE+' dados por rolagem (o d100 conta como dois).'};
  return{terms,mod};
}
function formatFormula(spec){
  const order=Object.keys(SIDES);
  const parts=spec.terms.slice().sort((a,b)=>order.indexOf(a.t)-order.indexOf(b.t)).map(t=>t.n+t.t);
  let s=parts.join('+');
  if(spec.mod>0)s+=(s?'+':'')+spec.mod;
  else if(spec.mod<0)s+=spec.mod;
  return s;
}
function dieIcon(t){
  const P={
    d4:'<polygon points="12,3 22,20 2,20"',
    d6:'<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"',
    d8:'<polygon points="12,2 22,12 12,22 2,12"',
    d10:'<polygon points="12,2 21,10 12,22 3,10"',
    d12:'<polygon points="12,2 22,9.5 18.5,21 5.5,21 2,9.5"',
    d20:'<polygon points="12,2 21,7 21,17 12,22 3,17 3,7"',
    d100:'<circle cx="12" cy="12" r="9.5"'
  };
  return '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'+P[t]+' fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
}

/* ============ dados: geometria ============ */
function makeD10(){
  const R=1.25,a=R*0.10557;
  const T=new THREE.Vector3(0,R,0),B=new THREE.Vector3(0,-R,0),P=[];
  for(let j=0;j<10;j++){const g=j*Math.PI/5;P.push(new THREE.Vector3(Math.cos(g)*R,j%2===0?a:-a,Math.sin(g)*R))}
  const tris=[];
  for(let i=0;i<5;i++){
    const z0=P[2*i],z1=P[2*i+1],z2=P[(2*i+2)%10],z3=P[(2*i+3)%10];
    tris.push([T,z0,z1],[T,z1,z2],[B,z1,z2],[B,z2,z3]);
  }
  const arr=[];
  tris.forEach(t=>{
    let [p,q,r]=t;
    const n=new THREE.Vector3().subVectors(q,p).cross(new THREE.Vector3().subVectors(r,p));
    const g=new THREE.Vector3().add(p).add(q).add(r);
    if(n.dot(g)<0){const x=q;q=r;r=x}
    arr.push(p.x,p.y,p.z,q.x,q.y,q.z,r.x,r.y,r.z);
  });
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
  geo.computeVertexNormals();
  return geo;
}
const DIE_DEF={
  d4:{sides:4,make:()=>new THREE.TetrahedronGeometry(1.45)},
  d6:{sides:6,make:()=>new THREE.BoxGeometry(1.7,1.7,1.7),ls:1.0},
  d8:{sides:8,make:()=>new THREE.OctahedronGeometry(1.35),ls:0.95},
  d10:{sides:10,make:makeD10,ls:0.8},
  d12:{sides:12,make:()=>new THREE.DodecahedronGeometry(1.3),ls:1.1},
  d20:{sides:20,make:()=>new THREE.IcosahedronGeometry(1.35),ls:0.95}
};
function extractFaces(geo0){
  const geo=geo0.index?geo0.toNonIndexed():geo0;
  const pos=geo.attributes.position,faces=[];
  for(let i=0;i<pos.count;i+=3){
    const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),c=new THREE.Vector3().fromBufferAttribute(pos,i+2);
    const n=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize();
    const d=n.dot(a);
    let f=faces.find(x=>x.n.dot(n)>0.999&&Math.abs(x.d0-d)<0.02);
    if(!f){f={n:n.clone(),d0:d,pts:[]};faces.push(f)}
    f.pts.push(a,b,c);
  }
  faces.forEach(f=>{
    const u=[];
    f.pts.forEach(p=>{if(!u.some(q=>q.distanceTo(p)<1e-3))u.push(p.clone())});
    f.verts=u;
    f.c=u.reduce((s,p)=>s.add(p),new THREE.Vector3()).multiplyScalar(1/u.length);
    if(f.n.dot(f.c)<0)f.n.negate();
    f.d=f.n.dot(f.c);
    f.rf=u.reduce((s,p)=>s+p.distanceTo(f.c),0)/u.length;
  });
  return{faces,geo};
}
function assignValues(faces,N){
  const used=faces.map(()=>false);let k=1;
  for(let i=0;i<faces.length;i++){
    if(used[i])continue;
    let j=-1;
    for(let q=0;q<faces.length;q++)if(q!==i&&!used[q]&&faces[q].n.dot(faces[i].n)<-0.99){j=q;break}
    used[i]=true;faces[i].value=k;
    if(j>=0){used[j]=true;faces[j].value=N+1-k}
    k++;
  }
}
function faceUp(kind,f){
  let up;
  if(kind==='d6'){
    up=Math.abs(f.n.y)>0.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
  }else if(kind==='d10'){
    let best=f.verts[0];
    f.verts.forEach(v=>{if(Math.abs(v.y)>Math.abs(best.y))best=v});
    up=best.clone().sub(f.c);
  }else up=f.verts[0].clone().sub(f.c);
  up.sub(f.n.clone().multiplyScalar(up.dot(f.n)));
  if(up.lengthSq()<1e-6)up.set(0,1,0).sub(f.n.clone().multiplyScalar(f.n.y));
  return up.normalize();
}
function labelText(type,v){
  if(type==='d10')return v===10?'0':String(v);
  if(type==='d10t')return v===10?'00':String(v*10);
  return String(v);
}

/* ============ dados: bandeja 3D ============ */
class DiceTray{
  constructor(el){
    this.el=el;this.ok=false;this.dice=[];this.idleObj=null;this.visible=true;this.raf=0;this.last=0;
    this.grid={cols:1,rows:1};this._tex={};this._lm={};this._pl={};this._mats={};
    this.reduced=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
    if(typeof THREE==='undefined')return this._fallbackInit();
    try{this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true})}catch(e){return this._fallbackInit()}
    this.ok=true;
    const r=this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    r.domElement.setAttribute('aria-hidden','true');
    el.appendChild(r.domElement);
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(32,1,0.1,120);
    this.scene.add(new THREE.HemisphereLight(0xffffff,0xbfe3fb,0.78));
    const dl=new THREE.DirectionalLight(0xffffff,0.62);dl.position.set(4,10,6);this.scene.add(dl);
    this.dgroup=new THREE.Group();this.scene.add(this.dgroup);
    this._edgeMat=new THREE.LineBasicMaterial({color:0xeaf6ff,transparent:true,opacity:0.9});
    this._shadowGeo=new THREE.PlaneGeometry(3.6,3.6);
    this._shadowTex=this._makeShadowTex();
    this._q=new THREE.Quaternion();
    this._loop=this._loop.bind(this);
    if(window.ResizeObserver)new ResizeObserver(()=>this.resize()).observe(el);
    if(window.IntersectionObserver)new IntersectionObserver(es=>{this.setVisible(es.some(e=>e.isIntersecting))}).observe(el);
    this.resize();
  }
  _fallbackInit(){
    this.fb=document.createElement('div');this.fb.className='stage-fb';
    this.fb.innerHTML='<span>Não foi possível abrir os dados 3D neste aparelho. A mesa continua funcionando com os resultados em texto.</span>';
    this.el.appendChild(this.fb);
  }
  _makeShadowTex(){
    const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
    const gr=g.createRadialGradient(64,64,6,64,64,62);
    gr.addColorStop(0,'rgba(18,49,79,.5)');gr.addColorStop(1,'rgba(18,49,79,0)');
    g.fillStyle=gr;g.fillRect(0,0,128,128);
    return new THREE.CanvasTexture(c);
  }
  setVisible(v){
    this.visible=v;
    if(v){this.resize();this._kick()}
  }
  resize(){
    if(!this.ok)return;
    const b=this.el.getBoundingClientRect(),w=Math.floor(b.width),h=Math.floor(b.height);
    if(w<8||h<8)return;
    this.renderer.setSize(w,h,false);
    this.camera.aspect=w/h;
    this._fit();
    this.renderer.render(this.scene,this.camera);
  }
  _fit(){
    const cols=this.grid.cols,rows=this.grid.rows;
    const halfW=cols*1.55+0.7,halfH=rows*1.55+0.7;
    const t=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));
    const el=1.05,s=Math.sin(el),c=Math.cos(el);
    const D=Math.max((halfH*s+1.7)/t,halfW/(t*this.camera.aspect))*1.06+1;
    this.camera.position.set(0,D*s,D*c);
    this.camera.lookAt(0,0,0);
    this.camera.updateProjectionMatrix();
  }
  _mat(name){
    if(!this._mats[name])this._mats[name]=new THREE.MeshPhysicalMaterial({
      color:new THREE.Color(COLORS[name]||COLORS.candy),roughness:0.35,metalness:0,clearcoat:0.7,clearcoatRoughness:0.25,flatShading:true
    });
    return this._mats[name];
  }
  _texFor(text){
    if(this._tex[text])return this._tex[text];
    const c=document.createElement('canvas');c.width=c.height=128;
    const g=c.getContext('2d');
    const size=text.length>=2?62:84;
    g.fillStyle='#12314F';g.textAlign='center';g.textBaseline='middle';
    g.font='800 '+size+'px Figtree,"Segoe UI",Arial,sans-serif';
    g.fillText(text,64,66);
    if(/^(6|9|60|90)$/.test(text)){const w=g.measureText(text).width;g.fillRect(64-w/2,66+size*0.43,w,6)}
    const t=new THREE.CanvasTexture(c);t.anisotropy=4;
    return(this._tex[text]=t);
  }
  _labelMat(text){
    if(!this._lm[text])this._lm[text]=new THREE.MeshBasicMaterial({map:this._texFor(text),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
    return this._lm[text];
  }
  _plane(size){
    const k=size.toFixed(2);
    if(!this._pl[k])this._pl[k]=new THREE.PlaneGeometry(size,size);
    return this._pl[k];
  }
  _addLabel(group,text,pos,n,up,size){
    const x=new THREE.Vector3().crossVectors(up,n);
    const m=new THREE.Mesh(this._plane(size),this._labelMat(text));
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,up,n));
    m.position.copy(pos).addScaledVector(n,0.012);
    group.add(m);
  }
  _makeDie(type,colorName){
    const key=type==='d10t'?'d10':type,def=DIE_DEF[key];
    const info=extractFaces(def.make()),faces=info.faces,group=new THREE.Group();
    group.add(new THREE.Mesh(info.geo,this._mat(colorName)));
    const eg=new THREE.EdgesGeometry(info.geo,12);
    group.add(new THREE.LineSegments(eg,this._edgeMat));
    const die={group,faces,kind:key,geo:info.geo,eg,verts:null,rest:0};
    if(key==='d4'){
      const u=[];
      faces.forEach(f=>f.verts.forEach(p=>{if(!u.some(q=>q.distanceTo(p)<1e-3))u.push(p.clone())}));
      die.verts=u;
      faces.forEach(f=>f.verts.forEach(vv=>{
        const idx=u.findIndex(q=>q.distanceTo(vv)<1e-3);
        const dir=vv.clone().sub(f.c);
        const up=dir.clone().sub(f.n.clone().multiplyScalar(dir.dot(f.n))).normalize();
        const pos=f.c.clone().add(dir.multiplyScalar(0.58));
        this._addLabel(group,String(idx+1),pos,f.n,up,f.rf*0.42);
      }));
    }else{
      assignValues(faces,def.sides);
      faces.forEach(f=>{
        f.up=faceUp(key,f);
        this._addLabel(group,labelText(type,f.value),f.c,f.n,f.up,f.rf*def.ls);
      });
    }
    die.rest=faces.reduce((s,f)=>s+f.d,0)/faces.length;
    const sh=new THREE.Mesh(this._shadowGeo,new THREE.MeshBasicMaterial({map:this._shadowTex,transparent:true,opacity:0.5,depthWrite:false}));
    sh.rotation.x=-Math.PI/2;sh.position.y=0.02;
    die.shadow=sh;
    return die;
  }
  _targetQuat(die,v){
    const UP=new THREE.Vector3(0,1,0);
    const q=new THREE.Quaternion();
    if(die.kind==='d4'){
      const vv=die.verts[clamp(v-1,0,3)].clone().normalize();
      q.setFromUnitVectors(vv,UP);
      return new THREE.Quaternion().setFromAxisAngle(UP,Math.random()*Math.PI*2).multiply(q);
    }
    const f=die.faces.find(x=>x.value===v)||die.faces[0];
    const xf=new THREE.Vector3().crossVectors(f.up,f.n);
    const F=new THREE.Matrix4().makeBasis(xf,f.up,f.n);
    const Wm=new THREE.Matrix4().makeBasis(new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,-1),new THREE.Vector3(0,1,0));
    q.setFromRotationMatrix(new THREE.Matrix4().multiplyMatrices(Wm,F.clone().transpose()));
    return new THREE.Quaternion().setFromAxisAngle(UP,(Math.random()-0.5)*0.5).multiply(q);
  }
  _clear(){
    this.dice.forEach(a=>{this.dgroup.remove(a.die.group);this.dgroup.remove(a.die.shadow);a.die.geo.dispose();a.die.eg.dispose();a.die.shadow.material.dispose()});
    if(this.idleObj){const d=this.idleObj;this.dgroup.remove(d.group);this.dgroup.remove(d.shadow);d.geo.dispose();d.eg.dispose();d.shadow.material.dispose();this.idleObj=null}
    this.dice=[];
  }
  _slot(i,n){
    const rows=this.grid.rows,cols=this.grid.cols;
    const r=Math.floor(i/cols),c=i%cols,cnt=Math.min(cols,n-r*cols);
    return{x:(c-(cnt-1)/2)*3.1,z:(r-(rows-1)/2)*3.1};
  }
  /* dice: [{t,v}] — retorna a duração aproximada (ms) */
  play(dice,colorName){
    const list=[];
    dice.forEach(d=>{
      if(d.t==='d100'){const v=d.v%100,t=Math.floor(v/10),u=v%10;list.push({t:'d10t',v:t===0?10:t},{t:'d10',v:u===0?10:u})}
      else list.push({t:d.t,v:d.v});
    });
    if(!this.ok){
      if(this.fb)this.fb.innerHTML='<div class="pips">'+dice.map(d=>'<span class="pip">'+d.t+'<b>'+d.v+'</b></span>').join('')+'</div>';
      return 300;
    }
    this._clear();
    const n=Math.min(list.length,MAX_DICE+2);
    const rows=n<=4?1:n<=10?2:3;
    this.grid={cols:Math.ceil(n/rows),rows};
    this._fit();
    const now=performance.now();let end=now;
    list.slice(0,n).forEach((d,i)=>{
      const die=this._makeDie(d.t,colorName),slot=this._slot(i,n);
      const dur=this.reduced?1:1500+Math.random()*500,t0=now+(this.reduced?0:i*70);
      const ax=new THREE.Vector3(Math.random()-0.5,Math.random()-0.5,Math.random()-0.5);
      if(ax.lengthSq()<1e-4)ax.set(1,0.3,0.2);
      const a={
        die,slot,t0,dur,rest:die.rest,A:this.reduced?0:3.2+Math.random()*1.4,
        start:{x:slot.x+(Math.random()-0.5)*6,z:slot.z-9-Math.random()*3},
        axis:ax.normalize(),th0:this.reduced?0:(4+Math.random()*4)*Math.PI*(Math.random()<0.5?-1:1),
        qT:this._targetQuat(die,d.v)
      };
      if(this.reduced)a.start={x:slot.x,z:slot.z};
      die.group.visible=false;die.shadow.visible=false;
      this.dgroup.add(die.group);this.dgroup.add(die.shadow);
      this.dice.push(a);
      end=Math.max(end,t0+dur);
    });
    this.anim=true;this._kick();
    return Math.round(end-now);
  }
  idle(type,colorName){
    if(!this.ok)return;
    this._clear();
    this.grid={cols:1,rows:1};this._fit();
    const die=this._makeDie(type,colorName);
    die.group.rotation.set(0.55,0.4,0.1);
    die.group.position.set(0,die.rest+0.7,0);
    this.dgroup.add(die.group);this.dgroup.add(die.shadow);
    this.idleObj=die;this.anim=false;
    this.renderer.render(this.scene,this.camera);
    if(!this.reduced)this._kick();
  }
  _kick(){if(this.ok&&this.visible&&!this.raf)this.raf=requestAnimationFrame(this._loop)}
  _loop(now){
    this.raf=0;
    if(!this.visible)return;
    const dt=this.last?Math.min(0.05,(now-this.last)/1000):0.016;this.last=now;
    let active=false;
    for(const a of this.dice){
      let t=(now-a.t0)/a.dur;
      if(t<0){active=true;continue}
      a.die.group.visible=true;a.die.shadow.visible=true;
      if(t>=1)t=1;else active=true;
      const e=1-Math.pow(1-t,3);
      const x=a.start.x+(a.slot.x-a.start.x)*e,z=a.start.z+(a.slot.z-a.start.z)*e;
      const h=a.A*Math.pow(1-t,2)*Math.abs(Math.cos(Math.PI*2.5*t));
      a.die.group.position.set(x,a.rest+h,z);
      this._q.setFromAxisAngle(a.axis,a.th0*(1-e));
      a.die.group.quaternion.copy(this._q).multiply(a.qT);
      a.die.shadow.position.set(x,0.02,z);
      const k=1+h*0.1;a.die.shadow.scale.set(k,k,k);
      a.die.shadow.material.opacity=0.5/(1+h*0.45);
    }
    if(this.idleObj){
      const d=this.idleObj;
      d.group.rotation.y+=dt*0.7;d.group.rotation.x+=dt*0.25;
      const y=d.rest+0.7+Math.sin(now/650)*0.16;
      d.group.position.y=y;
      d.shadow.position.set(0,0.02,0);
      const k=1+(y-d.rest)*0.05;d.shadow.scale.set(k,k,k);
      active=true;
    }
    this.renderer.render(this.scene,this.camera);
    if(active)this.raf=requestAnimationFrame(this._loop);else this.last=0;
  }
}
