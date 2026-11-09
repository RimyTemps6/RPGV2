/* ============ imagens redondas (personagens e criaturas) ============ */
function fileToSquare(file,size){
  size=size||192;
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      const s=Math.min(img.width,img.height),sx=(img.width-s)/2,sy=(img.height-s)/2;
      const c=document.createElement('canvas');c.width=c.height=size;
      const x=c.getContext('2d');x.drawImage(img,sx,sy,s,s,0,0,size,size);
      URL.revokeObjectURL(url);
      let d=c.toDataURL('image/webp',.85);
      if(d.indexOf('data:image/webp')!==0||d.length>70000){
        x.globalCompositeOperation='destination-over';x.fillStyle='#fff';x.fillRect(0,0,size,size);
        let q=.85;d=c.toDataURL('image/jpeg',q);
        while(d.length>70000&&q>.4){q-=.1;d=c.toDataURL('image/jpeg',q)}
      }
      res(d);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('img'))};
    img.src=url;
  });
}
function avatarHTML(o,size){
  const im=safeImg(o&&o.img);
  return im?'<img class="av" src="'+esc(im)+'" width="'+size+'" height="'+size+'" alt="" draggable="false">':slime((o&&o.color)||'lilac',size);
}
function portraitHTML(d){
  const id=esc(S.sheet?S.sheet.id:'');
  return '<div class="portrait">'+avatarHTML(d,76)
   +'<button type="button" class="btn small ghost" data-act="pick-img" data-kind="char" data-id="'+id+'">Importar imagem</button>'
   +(d.img?'<button type="button" class="btn small ghost" data-act="img-clear" data-kind="char" data-id="'+id+'">Tirar imagem</button>':'')+'</div>';
}
function foeImgHTML(f){
  const id=esc(f.id);
  return '<div class="foe-img">'+avatarHTML({img:f.img,color:'lilac'},foeType(f)==='boss'?72:52)+'<div class="row">'
   +'<button type="button" class="btn small ghost" data-act="pick-img" data-kind="foe" data-id="'+id+'">Importar imagem</button>'
   +(f.img?'<button type="button" class="btn small ghost" data-act="img-clear" data-kind="foe" data-id="'+id+'">Tirar</button>':'')
   +'<button type="button" class="btn small" data-act="foe-arm" data-id="'+id+'">Colocar no mapa</button><button type="button" class="btn small ghost" data-act="foe-dup" data-id="'+id+'">Duplicar</button><button type="button" class="btn small ghost bad" data-act="foe-del" data-id="'+id+'">Apagar</button></div></div>';
}
function applyImg(kind,id,data){
  if(kind==='char'){
    if(S.sheet&&S.sheet.id===id)mutDraft(d=>{d.img=data});
    else if(S.chars.find(c=>c.id===id))DB.update('rooms/'+S.code+'/chars/'+id,{img:data});
  }else{
    const f=S.foes.find(x=>x.id===id);if(!f)return;
    f.img=data;persist('foe',id,'all',100);
    if(S.tab==='criaturas')renderFoesTab(true);
  }
  repaint();
}
$('#img-pick').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f||!S.pick)return;
  try{applyImg(S.pick.kind,S.pick.id,await fileToSquare(f,192));toast('Imagem importada.')}
  catch(err){toast('Não consegui ler essa imagem.')}
});

/* ============ mapa com fichas redondas ============ */
const activeScene=()=>S.scenes.find(s=>s.id===(S.room&&S.room.active));
function tokEntity(t){
  if(t.kind==='char')return S.chars.find(c=>c.id===t.ref);
  const f=S.foes.find(x=>x.id===t.ref);if(!f)return null;
  if(!t.inst)return f;
  const cnt=S.tokens.filter(x=>x.inst&&x.ref===t.ref&&x.scene===t.scene).length;
  return{id:t.id,isTok:true,foeId:f.id,type:foeType(f),name:f.name+(cnt>1?' '+num(t.n,1):''),img:f.img,notes:f.notes,bars:t.bars||[],visible:!!t.vis};
}
/* monstros antigos (uma ficha por criatura) viram cópias independentes */
function migrateTokens(){
  if(S.role!=='master')return;
  S.tokens.forEach(t=>{
    if(t.kind!=='foe'||t.inst||S.migrated[t.id])return;
    const f=S.foes.find(x=>x.id===t.ref);if(!f||foeType(f)!=='monster')return;
    S.migrated[t.id]=1;
    const patch={inst:true,n:1,vis:!!f.visible,bars:clone(f.bars||[])};
    Object.assign(t,patch);DB.update(tokPath(t.id),patch);
  });
}
const tokCanMove=(t,e)=>S.role==='master'||(t.kind==='char'&&!!e&&e.owner===S.uid);
function placeables(){
  const ch=(S.role==='master'?S.chars:S.chars.filter(c=>c.owner===S.uid)).map(e=>({kind:'char',e}));
  return S.role==='master'?ch.concat(S.foes.map(e=>({kind:'foe',e}))):ch;
}
function tokensHTML(sc){
  return S.tokens.filter(t=>t.scene===sc.id).map(t=>{
    const e=tokEntity(t);if(!e)return '';
    if(t.kind==='foe'&&!e.visible&&S.role!=='master')return '';
    const mv=tokCanMove(t,e),b=(e.bars||[])[0],ty=t.kind==='foe'?foeType(e):'char';
    return '<div class="tok k-'+t.kind+' t-'+ty+(mv?' mv':'')+(S.selTok===t.id?' sel':'')+(t.kind==='foe'&&!e.visible?' hid':'')+(b&&num(b.cur)<=0?' dead':'')+'" data-tok="'+esc(t.id)+'" style="left:'+(num(t.x,.5)*100)+'%;top:'+(num(t.y,.5)*100)+'%" role="button" tabindex="0" aria-label="'+esc(e.name)+(mv?'. Arraste para mover.':'')+'">'
      +'<span class="tok-c">'+avatarHTML(e,56)+'</span>'
      +'<span class="tok-meta">'+(b?'<span class="tok-hp"><i style="width:'+pct(b)+'%;background:'+cvar(b.color)+'"></i></span>':'')+'<span class="tok-n">'+esc(e.name)+'</span></span></div>';
  }).join('');
}
function mapBarHTML(sc){
  const list=placeables(),master=S.role==='master';
  const st=S.selTok&&S.tokens.find(t=>t.id===S.selTok&&t.scene===sc.id),se=st&&tokEntity(st);
  let top,extra='';
  if(S.arm){
    const a=S.arm.kind==='char'?S.chars.find(c=>c.id===S.arm.id):S.foes.find(f=>f.id===S.arm.id);
    const multi=S.arm.kind==='foe'&&a&&foeType(a)==='monster';
    top='<span>Toque no mapa para colocar <b>'+esc(a?a.name:'')+'</b>'+(multi?'. Cada toque coloca uma cópia nova':'')+'.</span>'
     +(multi?'<span class="row qty"><button type="button" class="step" data-act="qty" data-d="-1" aria-label="Menos uma cópia">−</button><b>'+S.armQty+'</b><button type="button" class="step" data-act="qty" data-d="1" aria-label="Mais uma cópia">+</button><button type="button" class="btn small" data-act="arm-many">Colocar '+S.armQty+' de uma vez</button></span>':'')
     +'<button type="button" class="btn small ghost" data-act="arm-cancel">'+(multi?'Pronto':'Cancelar')+'</button>';
  }else if(st&&se){
    const ty=st.kind==='foe'?foeType(se):'char';
    top='<span><b>'+esc(se.name)+'</b>'+(ty==='boss'?'<span class="tag">Boss</span>':ty==='npc'?'<span class="tag">NPC</span>':'')+'</span><span class="row">'
     +(tokCanMove(st,se)?'<button type="button" class="btn small ghost" data-act="tok-rm">Tirar do mapa</button>':'')
     +(master&&st.kind==='foe'&&!st.inst?'<button type="button" class="btn small ghost bad" data-act="foe-del" data-id="'+esc(se.id)+'">Apagar criatura</button>':'')
     +(master&&st.kind==='foe'?'<button type="button" class="btn small ghost" data-act="tok-vis">'+(se.visible?'Ocultar dos jogadores':'Revelar aos jogadores')+'</button>':'')
     +(master&&ty==='boss'?'<button type="button" class="btn small'+(se.bossBar?'':' ghost')+'" data-act="boss-toggle" data-id="'+esc(se.id)+'">Barra na tela: '+(se.bossBar?'ligada':'desligada')+'</button>':'')
     +(st.kind==='char'&&canEdit(se)?'<button type="button" class="btn small ghost" data-act="open-char" data-id="'+esc(se.id)+'">Abrir ficha</button>':'')+'</span>';
    if(st.kind==='foe'&&(se.bars||[]).length)extra='<div class="mb-bars">'+se.bars.map((bb,i)=>barHTML(bb,{ctl:master,kind:st.inst?'tok':'foe',id:st.inst?st.id:se.id,i})).join('')+'</div>';
  }else{
    const hidden=master&&S.tokens.some(t=>{if(t.scene!==sc.id||t.kind!=='foe')return false;const e=tokEntity(t);return e&&!e.visible});
    top='<span class="muted">'+(list.length?'Escolha um nome e toque no mapa para colocar. Arraste a ficha para mover.':'Crie uma ficha na aba Fichas para colocar seu personagem no mapa.')+'</span>'
     +(hidden?'<button type="button" class="btn small ghost" data-act="tok-vis-all">Revelar todas as criaturas</button>':'');
  }
  const chips=list.length?'<div class="chips-scroll" role="group" aria-label="Colocar no mapa">'+list.map(o=>{
    const cnt=S.tokens.filter(t=>t.scene===sc.id&&t.kind===o.kind&&t.ref===o.e.id).length,on=cnt>0,ar=S.arm&&S.arm.kind===o.kind&&S.arm.id===o.e.id;
    const ty=o.kind==='foe'?foeType(o.e):'char';
    return '<button type="button" class="chip-p'+(on?' on':'')+(ar?' armed':'')+'" data-act="arm" data-kind="'+o.kind+'" data-id="'+esc(o.e.id)+'" aria-pressed="'+!!ar+'">'+avatarHTML(o.e.img?o.e:{color:o.kind==='foe'?'lilac':o.e.color},26)+esc(o.e.name)
      +(ty==='monster'&&cnt?'<span class="chip-n">×'+cnt+'</span>':'')+(ty==='npc'||ty==='boss'?'<small class="chip-t">'+(ty==='boss'?'Boss':'NPC')+'</small>':'')+'</button>';
  }).join('')+'</div>':'';
  return '<div class="mb-top">'+top+'</div>'+extra+chips;
}
function renderScene(){
  if(S.drag)return;
  const a=document.activeElement;if(a&&a.id==='sel-scene')return;
  const el=$('#m-scene'),master=S.role==='master';
  const sc=activeScene(),img=sc?safeImg(sc.image):'';
  const key=[S.role,S.mapFull,sc&&sc.id,sc&&sc.title,sc&&sc.text,sc&&sc.notes,img.length,S.scenes.map(s=>s.id+s.title).join(',')].join('|');
  if(el.dataset.k!==key){
    el.dataset.k=key;
    let h='<div class="card-h"><h2>Cena</h2>';
    if(master)h+='<select id="sel-scene" aria-label="Cena aberta na mesa"><option value="">Nenhuma cena aberta</option>'+S.scenes.map(s=>'<option value="'+esc(s.id)+'"'+(sc&&sc.id===s.id?' selected':'')+'>'+esc(s.title)+'</option>').join('')+'</select>';
    if(sc)h+='<button type="button" class="btn small ghost" data-act="map-full">'+(S.mapFull?'Fechar mapa':'Ver mapa inteiro')+'</button>';
    h+='</div>';
    if(sc){
      h+='<div class="map-box"><div class="map-wrap'+(img?'':' blank')+'" id="map-wrap">'
        +(img?'<img class="map-img" src="'+esc(img)+'" alt="Mapa da cena '+esc(sc.title)+'" draggable="false">':'')
        +'<div class="tok-layer" id="tok-layer"></div></div></div><div id="map-bar"></div>'
        +'<details class="scene-txt" id="scene-txt"'+(S.sceneOpen?' open':'')+'><summary>'+esc(sc.title)+'</summary><div class="scene-body">'+paras(sc.text)
        +(master&&sc.notes?'<div class="gm-note"><b>Anotações do mestre.</b> '+esc(sc.notes).replace(/\n/g,'<br>')+'</div>':'')+'</div></details>';
    }else h+=master?'<p class="empty">Nenhuma cena aberta. Escolha uma acima ou crie cenas na aba Cenários.</p>':'<p class="empty">O mestre ainda não abriu uma cena.</p>';
    el.innerHTML=h;
  }
  el.classList.toggle('full',!!(S.mapFull&&sc));document.body.classList.toggle('mapfull',!!(S.mapFull&&sc));
  if(sc){
    const fa=document.activeElement,fid=fa&&fa.dataset&&fa.dataset.tok;
    $('#tok-layer').innerHTML=tokensHTML(sc);
    if(fid){const n=$('#tok-layer [data-tok="'+fid+'"]');if(n)n.focus()}
    $('#map-bar').innerHTML=mapBarHTML(sc);
    $('#map-wrap').classList.toggle('armed',!!S.arm);
  }
}
document.addEventListener('toggle',e=>{if(e.target&&e.target.id==='scene-txt')S.sceneOpen=e.target.open},true);

const tokPath=id=>'rooms/'+S.code+'/tokens/'+id;
async function addInstances(f,sc,pts){
  let n=Math.max(0,...S.tokens.filter(t=>t.inst&&t.ref===f.id&&t.scene===sc.id).map(t=>num(t.n,0)));
  const docs=pts.map(p=>{n++;return{id:uid(),d:{scene:sc.id,kind:'foe',ref:f.id,inst:true,n,vis:!!f.visible,x:p[0],y:p[1],
    bars:(f.bars||[]).map(b=>{const m=Math.max(0,num(b.max));return{id:uid(),name:b.name,cur:m,max:m,color:b.color}})}}});
  docs.forEach(o=>S.tokens.push(Object.assign({id:o.id},clone(o.d))));
  renderScene();
  if(docs.length===1)return DB.set(tokPath(docs[0].id),docs[0].d);
  return DB.batch(docs.map(o=>({p:tokPath(o.id),d:o.d})));
}
async function placeToken(x,y){
  const sc=activeScene();if(!sc||!S.arm)return;
  const k=S.arm;
  x=clamp(x,.04,.96);y=clamp(y,.04,.96);
  const fo=k.kind==='foe'?S.foes.find(z=>z.id===k.id):null;
  /* monstros: cada toque cria uma cópia nova e o modo de colocar continua ligado */
  if(fo&&foeType(fo)==='monster'){await addInstances(fo,sc,[[x,y]]);return}
  S.arm=null;
  const ex=S.tokens.find(t=>t.scene===sc.id&&t.kind===k.kind&&t.ref===k.id);
  renderScene();
  if(ex)await DB.update(tokPath(ex.id),{x,y});
  else await DB.set(tokPath(uid()),{scene:sc.id,kind:k.kind,ref:k.id,x,y});
}
Object.assign(ACT,{
  'pick-img'(b){S.pick={kind:b.dataset.kind,id:b.dataset.id};const i=$('#img-pick');i.value='';i.click()},
  'img-clear'(b){applyImg(b.dataset.kind,b.dataset.id,'')},
  arm(b){
    const same=S.arm&&S.arm.kind===b.dataset.kind&&S.arm.id===b.dataset.id;
    S.arm=same?null:{kind:b.dataset.kind,id:b.dataset.id};S.selTok=null;renderScene();
  },
  'arm-cancel'(){S.arm=null;renderScene()},
  'tok-rm'(){if(!S.selTok)return;const id=S.selTok;S.selTok=null;S.tokens=S.tokens.filter(t=>t.id!==id);renderScene();DB.del(tokPath(id))},
  'tok-vis'(){
    const t=S.tokens.find(x=>x.id===S.selTok),e=t&&tokEntity(t);if(!e)return;
    if(t.inst){t.vis=!t.vis;renderScene();DB.update(tokPath(t.id),{vis:t.vis})}
    else{e.visible=!e.visible;renderScene();persist('foe',e.id,'all',100)}
  },
  'foe-dup'(b){
    const f=S.foes.find(x=>x.id===b.dataset.id);if(!f)return;
    const d=clone(f);delete d.id;d.name=f.name+' 2';d.order=Date.now();d.bars=(d.bars||[]).map(x=>Object.assign(x,{id:uid()}));
    DB.set('rooms/'+S.code+'/foes/'+uid(),d).then(ok=>{if(ok)toast('Criatura duplicada.')});
  }
});

/* clique no mapa: colocar ou limpar seleção */
$('#m-scene').addEventListener('click',e=>{
  const w=e.target.closest('#map-wrap');if(!w||e.target.closest('.tok'))return;
  if(S.arm){const r=w.getBoundingClientRect();placeToken((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height)}
  else if(S.selTok){S.selTok=null;renderScene()}
});
/* arrastar fichas redondas (só a ficha bloqueia a rolagem da página) */
$('#m-scene').addEventListener('pointerdown',e=>{
  const tk=e.target.closest('.tok');if(!tk||(e.pointerType==='mouse'&&e.button!==0))return;
  const t=S.tokens.find(x=>x.id===tk.dataset.tok),wrap=$('#map-wrap');if(!t||!wrap)return;
  const ent=tokEntity(t);if(!ent)return;
  const select=()=>{S.selTok=S.selTok===t.id?null:t.id;S.arm=null;renderScene()};
  if(!tokCanMove(t,ent)){select();return}
  e.preventDefault();
  try{tk.setPointerCapture(e.pointerId)}catch(_){}
  const r=wrap.getBoundingClientRect(),sx=e.clientX,sy=e.clientY,lift=e.pointerType==='touch'?30:0;
  let moved=false,x=num(t.x,.5),y=num(t.y,.5),last=0;
  const path=tokPath(t.id);
  const move=ev=>{
    if(!moved&&Math.hypot(ev.clientX-sx,ev.clientY-sy)<6)return;
    if(!moved){moved=true;S.drag=t.id;tk.classList.add('drag')}
    x=clamp((ev.clientX-r.left)/r.width,.03,.97);y=clamp((ev.clientY-lift-r.top)/r.height,.03,.97);
    tk.style.left=x*100+'%';tk.style.top=y*100+'%';
    const n=Date.now();if(n-last>280){last=n;DB.update(path,{x,y})}
  };
  const up=()=>{
    tk.removeEventListener('pointermove',move);tk.removeEventListener('pointerup',up);tk.removeEventListener('pointercancel',up);
    S.drag=null;
    if(moved){t.x=x;t.y=y;DB.update(path,{x,y});renderScene()}else select();
  };
  tk.addEventListener('pointermove',move);tk.addEventListener('pointerup',up);tk.addEventListener('pointercancel',up);
});
/* mover pelo teclado */
$('#m-scene').addEventListener('keydown',e=>{
  const tk=e.target.closest&&e.target.closest('.tok');if(!tk)return;
  const t=S.tokens.find(x=>x.id===tk.dataset.tok);if(!t)return;
  if(e.key==='Enter'||e.key===' '){e.preventDefault();S.selTok=S.selTok===t.id?null:t.id;renderScene();return}
  const d={ArrowLeft:[-.02,0],ArrowRight:[.02,0],ArrowUp:[0,-.02],ArrowDown:[0,.02]}[e.key];
  if(!d||!tokCanMove(t,tokEntity(t)))return;
  e.preventDefault();
  t.x=clamp(num(t.x,.5)+d[0],.03,.97);t.y=clamp(num(t.y,.5)+d[1],.03,.97);
  tk.style.left=t.x*100+'%';tk.style.top=t.y*100+'%';
  DB.update(tokPath(t.id),{x:t.x,y:t.y});
});

/* mapa inteiro e apagar criatura com limpeza das fichas no mapa */
ACT['map-full']=()=>{S.mapFull=!S.mapFull;if(S.mapFull){const m=$('#m-scene');if(m)m.scrollTop=0}renderScene()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.mapFull&&$('#overlay').hidden){S.mapFull=false;renderScene()}});
{const _fd=ACT['foe-del'];
 ACT['foe-del']=async function(b,e){
  const id=b.dataset.id;await _fd(b,e);
  if(!S.foes.find(f=>f.id===id)){
    S.tokens.filter(t=>t.kind==='foe'&&t.ref===id).forEach(t=>DB.del(tokPath(t.id)));
    S.tokens=S.tokens.filter(t=>!(t.kind==='foe'&&t.ref===id));S.selTok=null;repaint();
  }
 };}
