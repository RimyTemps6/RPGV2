'use strict';
/* ============ utilidades ============ */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const num=(v,d=0)=>{v=Number(v);return Number.isFinite(v)?v:d};
const slug=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'mesa';
const LS={
  get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
};
const COLORS={candy:'#8FD0F8',mint:'#8FE2C2',lilac:'#C6B8F8',butter:'#FFE08F',peach:'#FFC4A3',coral:'#FF9FB3'};
const CNAME={candy:'azul',mint:'menta',lilac:'lilás',butter:'manteiga',peach:'pêssego',coral:'coral'};
const cvar=n=>COLORS[n]?'var(--'+n+')':'var(--candy)';
const ICON={
  x:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  coin:'<svg class="coin" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="10.2" fill="#FFD65C" stroke="#A87208" stroke-width="2"/><circle cx="12" cy="12" r="6.6" fill="#FFE58F" stroke="#D9A21B" stroke-width="1.6"/><path d="M9.2 9.4a3.6 3.6 0 0 1 2.4-1.5M12 10.2v4.8" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".85"/></svg>'
};
function slime(color,size){
  size=size||40;const f=COLORS[color]||COLORS.candy;
  return '<svg class="slime" viewBox="0 0 64 64" width="'+size+'" height="'+size+'" aria-hidden="true">'
   +'<path d="M10 50C3 38 11 17 32 15c20-2 29 20 22 35-4 8-40 10-44 0z" fill="'+f+'" stroke="#12314F" stroke-width="3" stroke-linejoin="round"/>'
   +'<ellipse cx="22" cy="26" rx="5" ry="3" fill="#fff" opacity=".75" transform="rotate(-25 22 26)"/>'
   +'<circle cx="24" cy="38" r="3.6" fill="#12314F"/><circle cx="40" cy="38" r="3.6" fill="#12314F"/>'
   +'<path d="M28 45q4 3 8 0" fill="none" stroke="#12314F" stroke-width="2.6" stroke-linecap="round"/></svg>';
}
let _toastT;
function toast(msg,ms){
  const t=$('#toast');t.textContent=msg;t.classList.add('on');
  clearTimeout(_toastT);_toastT=setTimeout(()=>t.classList.remove('on'),ms||3400);
}
function modal(html,opts){
  opts=opts||{};
  const o=$('#overlay');
  o.innerHTML='<div class="modal'+(opts.wide?' wide':'')+'" role="dialog" aria-modal="true">'+html+'</div>';
  o.hidden=false;
  o.onclick=e=>{if(e.target===o)closeModal()};
  const box=o.firstElementChild;
  if(opts.onMount)opts.onMount(box);
  const f=box.querySelector('input,textarea,select,button');
  if(f)f.focus();
  return box;
}
function closeModal(){const o=$('#overlay');o.hidden=true;o.innerHTML='';o.onclick=null}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#overlay').hidden)closeModal()});
function confirmBox(title,text,okLabel){
  return new Promise(res=>{
    modal('<h2>'+esc(title)+'</h2>'+(text?'<p class="muted">'+esc(text)+'</p>':'')
      +'<div class="modal-act"><button type="button" class="btn ghost" data-c="0">Cancelar</button><button type="button" class="btn" data-c="1">'+esc(okLabel||'Confirmar')+'</button></div>',
      {onMount(box){box.addEventListener('click',e=>{const b=e.target.closest('[data-c]');if(!b)return;closeModal();res(b.dataset.c==='1')})}});
  });
}
function ago(ts){
  const s=Math.max(0,Math.round((Date.now()-ts)/1000));
  if(s<10)return 'agora';
  if(s<60)return 'há '+s+' s';
  if(s<3600)return 'há '+Math.round(s/60)+' min';
  if(s<86400)return 'há '+Math.round(s/3600)+' h';
  return 'há '+Math.round(s/86400)+' d';
}
function setPath(obj,path,val){
  const k=path.split('.');let o=obj;
  for(let i=0;i<k.length-1;i++){o=o[k[i]];if(o==null)return}
  o[k[k.length-1]]=val;
}

/* ============ armazenamento (local ou compartilhado) ============ */
function createLocalStore(){
  let data=LS.get('slime:data',{});
  const subs=new Set();let pt=null;
  const persist=()=>{clearTimeout(pt);pt=setTimeout(()=>LS.set('slime:data',data),150)};
  const listDocs=p=>{
    const pre=p+'/';const out=[];
    for(const k of Object.keys(data)){
      if(k.indexOf(pre)===0){const rest=k.slice(pre.length);if(rest&&rest.indexOf('/')<0)out.push(Object.assign({id:rest},clone(data[k])))}
    }
    return out;
  };
  const sortQ=(arr,o)=>{
    o=o||{};
    if(o.orderBy){const f=o.orderBy,d=o.dir==='desc'?-1:1;arr.sort((a,b)=>(a[f]>b[f]?1:a[f]<b[f]?-1:0)*d)}
    else arr.sort((a,b)=>a.id<b.id?-1:1);
    if(o.limit)arr.splice(o.limit);
    return arr;
  };
  const fire=()=>subs.forEach(s=>s());
  const later=()=>setTimeout(fire,0);
  return{
    mode:'local',
    async get(p){return data[p]?clone(data[p]):null},
    async set(p,d){data[p]=clone(d);persist();later()},
    async update(p,patch){
      if(!data[p])throw{code:'invalid_argument',message:'missing'};
      data[p]=Object.assign({},data[p],clone(patch));persist();later();
    },
    async del(p){delete data[p];persist();later()},
    async delMany(ps){ps.forEach(p=>{delete data[p]});persist();later()},
    async batch(ops){ops.forEach(o=>{if(o.del)delete data[o.p];else data[o.p]=clone(o.d)});persist();later()},
    async list(p,o){return sortQ(listDocs(p),o)},
    subDoc(p,cb){
      let last;
      const s=()=>{const v=data[p]?clone(data[p]):null;const j=JSON.stringify(v);if(j===last)return;last=j;cb(v)};
      subs.add(s);setTimeout(s,0);return()=>subs.delete(s);
    },
    subCol(p,cb,o){
      let last;
      const s=()=>{const v=sortQ(listDocs(p),o);const j=JSON.stringify(v);if(j===last)return;last=j;cb(v)};
      subs.add(s);setTimeout(s,0);return()=>subs.delete(s);
    }
  };
}
function createFirestoreStore(db){
  const mapDocs=s=>s.docs.map(d=>Object.assign({id:d.id},clone(d.data())));
  const query=(p,o)=>{
    o=o||{};let q=db.collection(p);
    if(o.orderBy)q=q.orderBy(o.orderBy,o.dir||'asc');
    if(o.limit)q=q.limit(o.limit);
    return q;
  };
  const onErr=p=>e=>{
    console.warn('slime db',p,e);
    if(e&&e.code==='permission-denied'&&p.indexOf('/messages')>0){
      if(!onErr.warned){onErr.warned=1;toast('Mensagens do mestre desligadas: publique as regras novas do Firestore.',6000)}
      return;
    }
    if(e&&e.code==='permission-denied'&&S.code&&!S.deleting&&p.indexOf('rooms/'+S.code)===0){
      toast('Você não tem mais acesso a esta mesa.',5000);leaveRoom();
    }
  };
  return{
    mode:'online',
    async get(p){const s=await db.doc(p).get();return s.exists?clone(s.data()):null},
    set:(p,d)=>db.doc(p).set(d),
    update:(p,d)=>db.doc(p).update(d),
    del:p=>db.doc(p).delete(),
    async list(p,o){return mapDocs(await query(p,o).get())},
    async delMany(paths){
      for(let i=0;i<paths.length;i+=400){
        const b=db.batch();paths.slice(i,i+400).forEach(x=>b.delete(db.doc(x)));await b.commit();
      }
    },
    async batch(ops){
      const b=db.batch();
      ops.forEach(o=>o.del?b.delete(db.doc(o.p)):b.set(db.doc(o.p),o.d));
      await b.commit();
    },
    subDoc(p,cb){return db.doc(p).onSnapshot(s=>cb(s.exists?clone(s.data()):null),onErr(p))},
    subCol(p,cb,o){return query(p,o).onSnapshot(s=>cb(mapDocs(s)),onErr(p))}
  };
}
let store=null;

/* escrita segura: uma por documento, com aviso de erro */
const _q=new Map();
function enqueue(path,fn){
  const prev=_q.get(path)||Promise.resolve();
  const next=prev.catch(()=>{}).then(fn);
  _q.set(path,next);
  next.then(()=>{},()=>{}).then(()=>{if(_q.get(path)===next)_q.delete(path)});
  return next;
}
function writeErr(e){
  console.warn('slime write',e);
  const c=e&&e.code;
  if(c==='quota_exceeded'||c==='resource-exhausted')toast('O armazenamento desta mesa está cheio. Apague cenas com imagem ou rolagens antigas.',5200);
  else if(c==='permission-denied')toast('Você não tem permissão para essa ação. Confira as regras do Firestore (veja o README).',5600);
  else toast('Não foi possível salvar agora. Tente de novo.',4200);
}
async function W(fn){
  if(S.readOnly){toast('Você só pode ver esta página. Peça ao dono para te convidar como colaborador.',5200);return false}
  try{await fn();return true}catch(e){writeErr(e);return false}
}
const DB={
  set:(p,d)=>W(()=>enqueue(p,()=>store.set(p,clone(d)))),
  update:(p,d)=>W(()=>enqueue(p,()=>store.update(p,clone(d)))),
  del:p=>W(()=>enqueue(p,()=>store.del(p))),
  batch:ops=>W(()=>store.batch(ops))
};
