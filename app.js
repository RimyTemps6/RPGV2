/* ============ estado ============ */
const S={
  uid:null,name:LS.get('slime:name',''),color:LS.get('slime:color','candy'),
  readOnly:false,dl:null,demo:false,deleting:false,
  code:null,role:null,tab:'mesa',
  room:null,members:[],chars:[],scenes:[],foes:[],rolls:[],
  subs:[],seen:new Set(),rollsReady:false,lastRollId:null,
  sheet:null,saveT:0,pend:{},pendMode:{},fichasStale:false,foesStale:false,tokens:[],arm:null,selTok:null,drag:null,sceneOpen:false,mapFull:false,pick:null,msgs:[],preview:null,armQty:3,migrated:{}
};
const foeType=f=>(f&&f.type)||'monster';
let heroTray=null,tableTray=null,heroBusy=false,_rp=0;

const SAMPLE={
  title:'A Caverna do Lodo',
  scenes:[
    {title:'A entrada da caverna',
     text:'Uma boca de pedra se abre na encosta do morro. O chão brilha com uma gosma azulada e o ar cheira a chuva e fruta madura. Pegadas redondas, do tamanho de um prato, levam para dentro.\n\nQuem para para escutar ouve um som baixo de bolhas estourando. O brilho nas paredes parece se mover.',
     notes:'Um teste de Percepção (dificuldade 12) mostra a passagem lateral. Os slimes verdes só atacam quem pisar na gosma brilhante.'},
    {title:'O lago gelatinoso',
     text:'A caverna se abre num salão com um lago de gelatina translúcida. Pontes de pedra ligam as margens, escorregadias e cobertas de limo. No fundo, algo grande se move devagar.',
     notes:'O Slime gigante emerge se alguém tocar a superfície. Quem cair no lago perde 1d6 de vida por turno.'},
    {title:'A câmara do Rei Slime',
     text:'No centro de uma sala redonda, um trono de cristal azul sustenta uma massa coroada de moedas velhas. O Rei Slime observa em silêncio, e as paredes pulsam no mesmo ritmo que ele.',
     notes:'O Rei se divide em dois slimes menores quando perde metade da vida. A coroa vale 200 moedas de ouro.'}
  ],
  foes:[
    {name:'Slime verde',notes:'Ataque: 1d4 de ácido leve.',bars:[{name:'Vida',cur:12,max:12,color:'mint'}]},
    {name:'Slime gigante',notes:'Ataque: 2d6 de esmagamento. Lento.',bars:[{name:'Vida',cur:35,max:35,color:'coral'}]},
    {name:'Rei Slime',type:'boss',notes:'Ataque: 2d8. Divide-se ao chegar à metade da vida.',bars:[{name:'Vida',cur:70,max:70,color:'coral'}]},
    {name:'Velho Pescador',type:'npc',notes:'Conhece a passagem lateral e pede 10 moedas pela informação.',bars:[]}
  ]
};
const SAMPLE_FORMAT='{\n  "slimeRpg": 1,\n  "title": "Nome do cenário",\n  "scenes": [\n    { "title": "Entrada", "text": "O que os jogadores veem.", "notes": "Só para o mestre." }\n  ],\n  "foes": [\n    { "name": "Slime verde", "bars": [{ "name": "Vida", "cur": 12, "max": 12, "color": "mint" }] }\n  ]\n}\n\nCores das barras: candy, mint, lilac, butter, peach, coral.';

function genCode(){
  const A='ABCDEFGHJKMNPQRSTUVWXYZ23456789';let s='';
  for(let i=0;i<6;i++)s+=A[randInt(A.length)-1];
  return s;
}

/* ============ cenários: leitura e escrita ============ */
function safeImg(s){return typeof s==='string'&&/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(s)?s:''}
function sanitizeScenario(o){
  const clip=(s,n)=>String(s==null?'':s).slice(0,n);
  const sc={title:clip(o.title||'Cenário importado',120),scenes:[],foes:[]};
  (Array.isArray(o.scenes)?o.scenes:[]).slice(0,60).forEach(s=>{
    if(!s||typeof s!=='object')return;
    const img=safeImg(s.image);
    sc.scenes.push({title:clip(s.title||'Cena',120),text:clip(s.text,8000),notes:clip(s.notes,4000),image:img&&img.length<=240000?img:''});
  });
  (Array.isArray(o.foes)?o.foes:[]).slice(0,80).forEach(f=>{
    if(!f||typeof f!=='object')return;
    const type=['monster','npc','boss'].indexOf(f.type)>=0?f.type:'monster';
    const def=[{name:'Vida',cur:10,max:10,color:'coral'}];
    const src=Array.isArray(f.bars)?(f.bars.length||type==='npc'?f.bars:def):def;
    const bars=src.slice(0,6).map(b=>{b=b||{};const cur=num(b.cur,10),max=Math.max(0,num(b.max,cur));return{id:uid(),name:clip(b.name||'Vida',24),cur:clamp(cur,0,max),max,color:COLORS[b.color]?b.color:'coral'}});
    sc.foes.push({name:clip(f.name||'Criatura',60),type,notes:clip(f.notes,2000),visible:false,bossBar:false,scene:'',img:(safeImg(f.img).length<=90000?safeImg(f.img):''),bars});
  });
  return sc;
}
function parseScenarioText(text,fname){
  const t=String(text||'').trim();
  if(!t)throw new Error('O arquivo está vazio.');
  const base=(fname||'Cenário').replace(/\.[^.]+$/,'');
  let sc;
  if(t[0]==='{'||t[0]==='['){
    let o;try{o=JSON.parse(t)}catch(e){throw new Error('O JSON tem um erro de formatação. Confira vírgulas e aspas.')}
    if(Array.isArray(o))o={scenes:o};
    if(!o.title)o.title=base;
    sc=sanitizeScenario(o);
  }else{
    const scenes=[];let cur=null;
    t.split(/\r?\n/).forEach(line=>{
      const m=line.match(/^#{1,3}\s+(.*)$/);
      if(m){cur={title:m[1].trim(),text:''};scenes.push(cur)}
      else{if(!cur){cur={title:base,text:''};scenes.push(cur)}cur.text+=line+'\n'}
    });
    scenes.forEach(s=>{s.text=s.text.trim()});
    sc=sanitizeScenario({title:base,scenes});
  }
  if(!sc.scenes.length&&!sc.foes.length)throw new Error('Não encontrei cenas nem criaturas nesse conteúdo.');
  return sc;
}
async function applyScenario(code,sc,openFirst){
  const base='rooms/'+code;let first=null,i=0;
  for(const s of sc.scenes){
    const id=uid();if(!first)first=id;
    if(!(await DB.set(base+'/scenes/'+id,Object.assign({},s,{order:Date.now()+i++}))))return false;
  }
  for(const f of sc.foes){
    if(!(await DB.set(base+'/foes/'+uid(),Object.assign({},f,{order:Date.now()+i++}))))return false;
  }
  if(openFirst&&first)await DB.update(base,{active:first});
  return true;
}
function fileToImage(file,max){
  max=max||1000;
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      const k=Math.min(1,max/Math.max(img.width,img.height));
      const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url);
      let q=0.74,d=c.toDataURL('image/jpeg',q);
      while(d.length>230000&&q>0.4){q-=0.1;d=c.toDataURL('image/jpeg',q)}
      res(d);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('img'))};
    img.src=url;
  });
}

/* ============ home ============ */
function renderNet(){
  const chip=$('#net-chip');
  chip.className='chip '+(S.demo?'local':'ok');
  chip.textContent=S.demo?'Demonstração':'Online';
  chip.title=S.demo?'Firebase não configurado: a mesa fica salva só neste navegador.':'Conectado ao Firebase.';
}
async function createRoom(){
  const title=$('#m-title').value.trim().slice(0,60),name=$('#m-name').value.trim().slice(0,30);
  if(!title||!name)return;
  let sc=null;const opt=$('#m-scn').value;
  if(opt==='sample')sc=sanitizeScenario(SAMPLE);
  else if(opt==='file'){
    const f=$('#m-file').files[0];
    if(!f){toast('Escolha o arquivo do cenário ou mude a opção.');return}
    try{sc=parseScenarioText(await f.text(),f.name)}catch(err){toast(err.message||'Não consegui ler esse arquivo.',5000);return}
  }
  S.name=name;LS.set('slime:name',name);
  if(S.demo)S.uid='mestre';
  let code='';
  for(let i=0;i<6;i++){
    code=genCode();
    let ex=null;try{ex=await store.get('rooms/'+code)}catch(e){}
    if(!ex)break;
  }
  const room={title,master:S.uid,masterName:name,createdAt:Date.now(),active:null};
  if(!(await DB.set('rooms/'+code,room)))return;
  await DB.set('rooms/'+code+'/members/'+S.uid,{name,role:'master',joinedAt:Date.now()});
  if(sc){toast('Importando cenário...');await applyScenario(code,sc,true)}
  remember(code,'master',title);
  enterRoom(code,'master');
}

/* ============ entrar e sair da mesa ============ */
function leaveSubs(){S.subs.forEach(u=>{try{u()}catch(e){}});S.subs=[]}
function keepPending(kind,list){
  const cur=kind==='char'?S.chars:kind==='tok'?S.tokens:S.foes;
  return list.map(x=>S.pend[kind+':'+x.id]?(cur.find(y=>y.id===x.id)||x):x);
}
function enterRoom(code,role){
  leaveSubs();
  Object.keys(S.pend).forEach(k=>clearTimeout(S.pend[k]));S.pend={};S.pendMode={};
  Object.assign(S,{code,role,tab:'mesa',room:null,members:[],chars:[],scenes:[],foes:[],rolls:[],tokens:[],arm:null,selTok:null,drag:null,sheet:null,seen:new Set(),rollsReady:false,lastRollId:null,msgs:[],preview:null,migrated:{},seenSelf:false});
  const base='rooms/'+code;
  S.subs=[
    store.subDoc(base,r=>{
      if(S.deleting)return;
      if(!r&&S.room){toast('Esta mesa foi encerrada.');leaveRoom();return}
      if(r&&r.closed&&S.role!=='master'){toast('O mestre encerrou esta mesa.',5000);leaveRoom();return}
      S.room=r;repaint();
    }),
    store.subCol(base+'/members',l=>{S.members=l;checkKicked(l);repaint()}),
    store.subCol(base+'/chars',l=>{S.chars=keepPending('char',l);repaint()},{orderBy:'createdAt'}),
    store.subCol(base+'/scenes',l=>{S.scenes=l;repaint()},{orderBy:'order'}),
    store.subCol(base+'/foes',l=>{S.foes=keepPending('foe',l);migrateTokens();repaint()},{orderBy:'order'}),
    store.subCol(base+'/tokens',l=>{S.tokens=keepPending('tok',l);migrateTokens();repaint()}),
    store.subCol(base+'/messages',onMsgs,{orderBy:'ts',dir:'desc',limit:30}),
    store.subCol(base+'/rolls',onRolls,{orderBy:'ts',dir:'desc',limit:40})
  ];
  $('#home').hidden=true;$('#table').hidden=false;
  window.scrollTo(0,0);
  renderTabs();renderDiceColors();renderDieRow();
  $('#roll-result').innerHTML='<span class="muted">Escolha os dados e role. Todos na mesa veem o resultado.</span>';
  setTab('mesa');
}
function leaveRoom(){
  if(typeof leaveCall==='function')leaveCall();
  flushSheet();leaveSubs();
  Object.keys(S.pend).forEach(k=>clearTimeout(S.pend[k]));S.pend={};
  S.deleting=false;S.code=null;S.role=null;S.sheet=null;S.mapFull=false;S.msgs=[];S.preview=null;hideOverlays();document.body.classList.remove('mapfull');
  $('#table').hidden=true;$('#home').hidden=false;
  renderRecents();window.scrollTo(0,0);
}

/* ============ repintar ============ */
function repaint(){
  if(_rp)return;
  _rp=requestAnimationFrame(()=>{_rp=0;doRepaint()});
  setTimeout(()=>{if(_rp){cancelAnimationFrame(_rp);_rp=0;doRepaint()}},400);
}
function doRepaint(){
  if(!S.code)return;
  renderHeader();renderBossHud();renderMsgOverlay();
  if(S.tab==='mesa'){renderScene();renderParty();renderMsgCard();renderMesaFoes();renderLog()}
  else if(S.tab==='fichas')renderFichas();
  else if(S.tab==='cenarios')renderScenesTab();
  else if(S.tab==='criaturas')renderFoesTab();
  else if(S.tab==='chamada')renderCall();
}
function isEditing(el){
  const a=document.activeElement;
  return !!(a&&el.contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}
function renderHeader(){
  $('#t-title').textContent=S.room?S.room.title:'';
  $('#t-code').textContent='Mesa '+S.code;
  $('#t-role').textContent=S.role==='master'?'Mestre':'Jogador';
  const n=$('#t-net');n.className='chip '+(S.demo?'local':'ok');n.textContent=S.demo?'Demonstração':'Online';
  const b=$('#banner');
  if(S.demo){b.hidden=false;b.textContent='Modo demonstração: a mesa fica salva só neste navegador. Configure o Firebase (veja o README) para jogar com amigos.'}
  else b.hidden=true;
  $('#btn-invite').hidden=!(S.role==='master'&&!S.demo);
  $('#btn-del-room').hidden=S.role!=='master';
}
function renderTabs(){
  const items=[['mesa','Mesa'],['fichas','Fichas']];
  if(S.role==='master')items.push(['cenarios','Cenários'],['criaturas','Criaturas']);
  items.push(['chamada','Chamada']);
  $('#tabs').classList.toggle('many',items.length>4);
  $('#tabs').innerHTML=items.map(it=>'<button type="button" class="tab" role="tab" data-tab="'+it[0]+'" aria-selected="'+(S.tab===it[0])+'">'+it[1]+'</button>').join('');
}
function setTab(t){
  if(t==='cenarios'||t==='criaturas'){if(S.role!=='master')t='mesa'}
  flushSheet();S.tab=t;
  $$('#tabs .tab').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===t)));
  ['mesa','fichas','cenarios','criaturas','chamada'].forEach(k=>{$('#p-'+k).hidden=k!==t});
  if(t==='mesa'&&tableTray)tableTray.setVisible(true);
  doRepaint();
}

/* ============ barras ============ */
const pct=b=>{const m=Math.max(0,num(b.max));return m>0?clamp(num(b.cur)/m*100,0,100):0};
function barHTML(b,o){
  o=o||{};const max=Math.max(0,num(b.max)),cur=num(b.cur);
  return '<div class="bar"><div class="bar-top"><span>'+esc(b.name||'Barra')+'</span><span class="bar-val">'+cur+' / '+max+'</span></div>'
   +'<div class="tube" style="--c:'+cvar(b.color)+'" role="progressbar" aria-label="'+esc(b.name)+'" aria-valuemin="0" aria-valuemax="'+max+'" aria-valuenow="'+cur+'"><i style="width:'+pct(b)+'%"></i></div>'
   +(o.ctl?'<div class="bar-ctl">'+[-5,-1,1,5].map(d=>'<button type="button" class="step" data-act="bar" data-kind="'+o.kind+'" data-id="'+esc(o.id)+'" data-i="'+o.i+'" data-d="'+d+'" aria-label="'+(d>0?'Aumentar':'Diminuir')+' '+esc(b.name)+' em '+Math.abs(d)+'">'+(d>0?'+'+d:'−'+Math.abs(d))+'</button>').join('')+'</div>':'')
   +'</div>';
}
function persist(kind,id,mode,delay){
  const key=kind+':'+id;
  clearTimeout(S.pend[key]);
  if(mode==='all')S.pendMode[key]='all';
  S.pend[key]=setTimeout(()=>{
    delete S.pend[key];const m=S.pendMode[key]||'bars';delete S.pendMode[key];
    const list=kind==='foe'?S.foes:kind==='tok'?S.tokens:S.chars,it=list.find(x=>x.id===id);
    if(!it||!S.code)return;
    const path='rooms/'+S.code+'/'+(kind==='foe'?'foes':kind==='tok'?'tokens':'chars')+'/'+id;
    if(m==='all'){const d=clone(it);delete d.id;DB.set(path,d)}
    else if(kind==='char')DB.update(path,{bars:it.bars||[],gold:Math.max(0,Math.floor(num(it.gold)))});
    else DB.update(path,{bars:it.bars||[]});
  },delay||300);
}
function adjustBar(kind,id,i,d){
  const list=kind==='foe'?S.foes:kind==='tok'?S.tokens:S.chars,idx=list.findIndex(x=>x.id===id);
  if(idx<0)return;
  const it=clone(list[idx]),b=it.bars&&it.bars[i];
  if(!b)return;
  b.cur=clamp(num(b.cur)+d,0,Math.max(0,num(b.max)));
  list[idx]=it;
  doRepaint();persist(kind,id,'bars',300);
}
const canEdit=c=>S.role==='master'||c.owner===S.uid;

/* ============ aba Mesa ============ */
function paras(t){return String(t||'').split(/\n{2,}/).filter(x=>x.trim()).map(p=>'<p>'+esc(p).replace(/\n/g,'<br>')+'</p>').join('')}
function renderParty(){
  const el=$('#m-party');
  let h='<div class="card-h"><h2>Grupo</h2></div>';
  if(!S.chars.length)h+='<p class="empty">Ninguém criou ficha ainda. Abra a aba Fichas para criar a sua.</p>';
  else h+=S.chars.map(c=>{
    const ed=canEdit(c);
    return '<div class="mate"><div class="mate-h">'+avatarHTML(c,38)+'<div class="mate-t"><button type="button" class="link" data-act="open-char" data-id="'+esc(c.id)+'"'+(ed?'':' disabled')+'>'+esc(c.name)+'</button><span class="muted">Nível '+num(c.level,1)+(c.cls?', '+esc(c.cls):'')+(S.role==='master'&&c.ownerName?', de '+esc(c.ownerName):'')+'</span></div></div>'
      +(c.bars||[]).map((b,i)=>barHTML(b,{ctl:ed,kind:'char',id:c.id,i})).join('')+goldHTML(c,ed)+'</div>';
  }).join('');
  if(S.members.length)h+='<div class="who">'+S.members.map(m=>'<span class="chip">'+esc(m.name)+(m.role==='master'?' (mestre)':'')+(S.role==='master'&&m.role==='player'?'<button type="button" class="chip-x" data-act="kick" data-id="'+esc(m.id)+'" aria-label="Expulsar '+esc(m.name)+'">'+ICON.x+'</button>':'')+'</span>').join('')+'</div>';
  el.innerHTML=h;
}
function mesaFoeEntries(){
  const master=S.role==='master',act=S.room&&S.room.active,out=[];
  S.tokens.filter(t=>t.kind==='foe'&&t.inst&&t.scene===act).forEach(t=>{
    const e=tokEntity(t);if(e&&(master||e.visible))out.push({kind:'tok',id:t.id,e,type:'monster'});
  });
  out.sort((x,y)=>String(x.e.name).localeCompare(String(y.e.name),'pt-BR',{numeric:true}));
  S.foes.forEach(f=>{const ty=foeType(f);if(ty==='monster')return;if(master||f.visible)out.push({kind:'foe',id:f.id,e:f,type:ty})});
  return out;
}
function renderMesaFoes(){
  const el=$('#m-foes'),master=S.role==='master';
  const list=mesaFoeEntries();
  if(!list.length){el.hidden=true;return}
  el.hidden=false;
  el.innerHTML='<div class="card-h"><h2>Na cena</h2></div>'+list.map(o=>{
    const f=o.e,tag=o.type==='boss'?'<span class="tag">Boss</span>':o.type==='npc'?'<span class="tag">NPC</span>':'';
    const bossBtn=master&&o.type==='boss'?'<button type="button" class="btn small'+(f.bossBar?'':' ghost')+'" data-act="boss-toggle" data-id="'+esc(f.id)+'" aria-pressed="'+!!f.bossBar+'">Barra na tela: '+(f.bossBar?'ligada':'desligada')+'</button>':'';
    const del=master?(o.kind==='tok'?'<button type="button" class="btn small ghost bad" data-act="tok-del" data-id="'+esc(o.id)+'">Remover</button>':'<button type="button" class="btn small ghost bad" data-act="foe-del" data-id="'+esc(f.id)+'">Apagar</button>'):'';
    return '<div class="mate"><div class="mate-h">'+avatarHTML({img:f.img,color:'lilac'},34)+'<div class="mate-t"><strong>'+esc(f.name)+tag+(master&&!f.visible?'<span class="tag">Oculta</span>':'')+'</strong></div>'+del+'</div>'
    +bossBtn
    +(f.bars||[]).map((b,i)=>barHTML(b,{ctl:master,kind:o.kind,id:o.id,i})).join('')+'</div>';
  }).join('');
}
function pipsHTML(r){
  return r.dice.map(d=>'<span class="pip">'+d.t+'<b>'+d.v+'</b></span>').join('')+(r.mod?'<span class="pip">'+(r.mod>0?'+':'−')+'<b>'+Math.abs(r.mod)+'</b></span>':'');
}
function renderLog(){
  const el=$('#m-log');
  let h='<div class="card-h"><h2>Registro de rolagens</h2>'+(S.role==='master'&&S.rolls.length?'<button type="button" class="btn ghost small" data-act="clear-log">Limpar</button>':'')+'</div>';
  if(!S.rolls.length)h+='<p class="empty">As rolagens da mesa aparecem aqui.</p>';
  else h+=S.rolls.map(r=>'<div class="roll"><div class="roll-t" style="--c:'+cvar(r.color)+'">'+esc(r.total)+'</div><div class="roll-i"><span><strong>'+esc(r.name)+'</strong> '+(r.label?esc(r.label):esc(r.formula))+'</span><div class="pips">'+pipsHTML(r)+'</div><small>'+esc(r.formula)+', '+ago(r.ts)+'</small></div></div>').join('');
  el.innerHTML=h;
}

/* ============ dados na mesa ============ */
function renderDiceColors(){
  $('#dice-colors').innerHTML=Object.keys(COLORS).map(c=>'<button type="button" class="sw'+(S.color===c?' on':'')+'" style="--c:'+COLORS[c]+'" data-act="dice-color" data-c="'+c+'" aria-label="Dados na cor '+CNAME[c]+'" aria-pressed="'+(S.color===c)+'"></button>').join('');
}
function renderDieRow(){
  const p=parseFormula($('#f-formula').value),spec=p.error?{terms:[],mod:0}:p;
  $('#die-row').innerHTML=Object.keys(SIDES).map(t=>{
    const n=(spec.terms.find(x=>x.t===t)||{n:0}).n;
    return '<div class="die'+(n?' on':'')+'"><button type="button" class="die-b" data-die="'+t+'" aria-label="Adicionar um '+t+'">'+dieIcon(t)+'<span>'+t+'</span>'+(n?'<b class="die-n">'+n+'</b>':'')+'</button>'+(n?'<button type="button" class="die-m" data-die-minus="'+t+'" aria-label="Remover um '+t+'">−</button>':'')+'</div>';
  }).join('')+'<div class="mod-ctl"><button type="button" class="step" data-mod="-1" aria-label="Bônus menos 1">−1</button><button type="button" class="step" data-mod="1" aria-label="Bônus mais 1">+1</button></div>';
}
function editFormula(fn){
  const p=parseFormula($('#f-formula').value),spec=p.error?{terms:[],mod:0}:p;
  fn(spec);
  if(physCount(spec.terms)>MAX_DICE){toast('Use até '+MAX_DICE+' dados por rolagem.');return}
  $('#f-formula').value=formatFormula(spec);
  renderDieRow();
}
function resultHTML(r){
  return '<div class="res"><div class="res-total">'+esc(r.total)+'</div><div class="res-info"><span><strong>'+esc(r.name)+'</strong> rolou '+(r.label?esc(r.label):esc(r.formula))+'</span><div class="pips">'+pipsHTML(r)+'</div></div></div>';
}
function playRoll(r){
  S.lastRollId=r.id;S.seen.add(r.id);
  $('#roll-result').innerHTML='<span class="rolling">Rolando...</span>';
  const ms=tableTray?tableTray.play(r.dice,r.color):300;
  setTimeout(()=>{if(S.lastRollId===r.id)$('#roll-result').innerHTML=resultHTML(r)},ms+150);
}
function doRoll(spec,label){
  const dice=[];
  spec.terms.forEach(t=>{for(let i=0;i<t.n;i++)dice.push({t:t.t,v:randInt(SIDES[t.t])})});
  const sum=dice.reduce((s,d)=>s+d.v,0);
  const r={id:uid(),by:S.uid,name:S.name||'Jogador',color:S.color,label:label||'',formula:formatFormula(spec),dice,mod:spec.mod,total:sum+spec.mod,ts:Date.now()};
  playRoll(r);
  if(S.code){DB.set('rooms/'+S.code+'/rolls/'+r.id,r);maybePrune()}
  return r;
}
async function maybePrune(){
  if(Math.random()>0.12||S.readOnly||!S.code)return;
  try{
    const all=await store.list('rooms/'+S.code+'/rolls',{orderBy:'ts',dir:'desc',limit:200});
    for(const r of all.slice(60))await store.del('rooms/'+S.code+'/rolls/'+r.id);
  }catch(e){}
}
function rollFromForm(){
  const p=parseFormula($('#f-formula').value);
  const box=$('#roll-result');
  if(p.error){box.innerHTML='<span class="err">'+esc(p.error)+'</span>';return}
  if(!p.terms.length){box.innerHTML='<span class="err">Adicione pelo menos um dado.</span>';return}
  doRoll(p,$('#f-label').value.trim());
}
function rollFromSheet(spec,label){
  setTab('mesa');
  $('#f-formula').value=formatFormula(spec);$('#f-label').value=label;renderDieRow();
  setTimeout(()=>doRoll(spec,label),80);
}
function onRolls(list){
  const first=!S.rollsReady;
  list.forEach(r=>{
    if(S.seen.has(r.id))return;
    S.seen.add(r.id);
    if(first||r.by===S.uid||Math.abs(Date.now()-r.ts)>20000)return;
    if(S.tab==='mesa')playRoll(r);
    else toast(r.name+' rolou '+r.formula+': '+r.total);
  });
  S.rolls=list;S.rollsReady=true;repaint();
}

/* ============ aba Fichas ============ */
const modOf=v=>Math.floor((num(v,10)-10)/2);
const fmtMod=m=>m>=0?'+'+m:'−'+Math.abs(m);
function newChar(name){
  return{owner:S.uid,ownerName:S.name,name:name||'Novo aventureiro',cls:'',race:'',level:1,xp:0,points:0,gold:0,color:S.color,
    attrs:['Força','Destreza','Constituição','Inteligência','Sabedoria','Carisma'].map(n=>({id:uid(),name:n,val:10})),
    bars:[{id:uid(),name:'Vida',cur:10,max:10,color:'coral'}],skills:[],inv:'',notes:'',createdAt:Date.now(),updatedAt:Date.now()};
}
const visibleChars=()=>S.role==='master'?S.chars:S.chars.filter(c=>c.owner===S.uid);
function openSheet(id){
  flushSheet();
  const c=S.chars.find(x=>x.id===id);if(!c)return;
  const d=clone(c);delete d.id;
  S.sheet={id,draft:d,dirty:false,base:JSON.stringify(d)};
  if(S.tab!=='fichas')setTab('fichas');else renderFichas(true);
}
function scheduleSave(){clearTimeout(S.saveT);S.saveT=setTimeout(flushSheet,700)}
async function flushSheet(){
  clearTimeout(S.saveT);
  const sh=S.sheet;if(!sh||!sh.dirty||!S.code)return;
  sh.dirty=false;sh.draft.updatedAt=Date.now();
  const d=clone(sh.draft);
  const i=S.chars.findIndex(c=>c.id===sh.id);if(i>=0)S.chars[i]=Object.assign({id:sh.id},d);
  sh.base=JSON.stringify(d);
  const ok=await DB.set('rooms/'+S.code+'/chars/'+sh.id,d);
  if(!ok)sh.dirty=true;
}
function mutDraft(fn){
  if(!S.sheet)return;
  fn(S.sheet.draft);S.sheet.dirty=true;
  renderFichas(true);scheduleSave();
}
function sheetHTML(d){
  const need=100*Math.max(1,num(d.level,1)),xp=Math.max(0,num(d.xp));
  const sw=(attr,i,cur)=>Object.keys(COLORS).map(c=>'<button type="button" class="sw'+(cur===c?' on':'')+'" style="--c:'+COLORS[c]+'" data-act="'+attr+'"'+(i!==null?' data-i="'+i+'"':'')+' data-c="'+c+'" aria-label="Cor '+CNAME[c]+'" aria-pressed="'+(cur===c)+'"></button>').join('');
  const barOpts=(sel)=>'<option value="">Nada</option>'+d.bars.map(b=>'<option value="'+esc(b.id)+'"'+(sel===b.id?' selected':'')+'>'+esc(b.name)+'</option>').join('');
  let h='<div class="blk"><div class="sheet-head">'+portraitHTML(d)+'<div class="who-n"><input class="name-in" data-f="name" value="'+esc(d.name)+'" maxlength="40" aria-label="Nome do personagem" placeholder="Nome do personagem">'
   +'<div class="grid2"><div class="field"><label for="f-cls">Classe ou profissão</label><input id="f-cls" data-f="cls" value="'+esc(d.cls)+'" maxlength="30"></div><div class="field"><label for="f-race">Raça ou origem</label><input id="f-race" data-f="race" value="'+esc(d.race)+'" maxlength="30"></div></div>'
   +'<div class="sw-row" role="group" aria-label="Cor do slime">'+sw('color',null,d.color)+'</div></div></div></div>';
  h+='<div class="blk"><div class="blk-h"><h3>Nível e experiência</h3></div><div class="lvl"><div class="lvl-n"><span class="muted">Nível</span><strong>'+num(d.level,1)+'</strong></div><div>'
   +'<div class="bar-top"><span>Experiência</span><span class="bar-val">'+xp+' / '+need+'</span></div><div class="tube" style="--c:var(--butter)"><i style="width:'+clamp(xp/need*100,0,100)+'%"></i></div>'
   +'<div class="lvl-act"><input id="xp-in" type="number" min="0" inputmode="numeric" placeholder="XP" aria-label="Quantidade de XP"><button type="button" class="btn small" data-act="xp-add">Dar XP</button><button type="button" class="btn small ghost" data-act="lvl-up">Subir de nível</button><button type="button" class="btn small ghost" data-act="lvl-down">Descer de nível</button></div>'
   +'<p class="muted">Pontos de atributo para gastar: <strong>'+num(d.points)+'</strong>. Cada nível dá 2 pontos.</p></div></div></div>';
  h+='<div class="blk"><div class="blk-h"><h3>Atributos</h3><button type="button" class="btn small ghost" data-act="attr-add">Novo atributo</button></div><div class="attrs">'
   +d.attrs.map((a,i)=>'<div class="attr"><button type="button" class="x" data-act="attr-rm" data-i="'+i+'" aria-label="Remover '+esc(a.name)+'">'+ICON.x+'</button><input class="attr-name" data-f="attrs.'+i+'.name" value="'+esc(a.name)+'" maxlength="20" aria-label="Nome do atributo"><input class="attr-val" type="number" inputmode="numeric" data-num data-f="attrs.'+i+'.val" value="'+num(a.val,10)+'" aria-label="Valor de '+esc(a.name)+'"><div class="attr-foot"><span class="mod" data-mod="'+i+'" title="Modificador">'+fmtMod(modOf(a.val))+'</span>'+(d.points>0?'<button type="button" class="step" data-act="attr-plus" data-i="'+i+'" aria-label="Gastar um ponto em '+esc(a.name)+'">+1</button>':'')+'<button type="button" class="step" data-act="attr-roll" data-i="'+i+'">Testar</button></div></div>').join('')
   +'</div></div>';
  h+='<div class="blk"><div class="blk-h"><h3>Barras de vida e energia</h3><div class="row"><select id="bar-preset" aria-label="Tipo de barra" style="width:auto"><option>Vida</option><option>Mana</option><option>Energia</option><option>Escudo</option><option>Fome</option><option>Personalizada</option></select><button type="button" class="btn small ghost" data-act="bar-add">Nova barra</button></div></div>'
   +d.bars.map((b,i)=>'<div class="bedit"><div class="bedit-row"><div class="mini"><label for="bn'+i+'">Nome</label><input id="bn'+i+'" data-f="bars.'+i+'.name" value="'+esc(b.name)+'" maxlength="24"></div><div class="mini"><label for="bc'+i+'">Atual</label><input id="bc'+i+'" type="number" inputmode="numeric" data-num data-f="bars.'+i+'.cur" value="'+num(b.cur)+'"></div><div class="mini"><label for="bm'+i+'">Máximo</label><input id="bm'+i+'" type="number" inputmode="numeric" data-num data-f="bars.'+i+'.max" value="'+num(b.max)+'"></div><button type="button" class="x" data-act="bar-rm" data-i="'+i+'" aria-label="Remover a barra '+esc(b.name)+'">'+ICON.x+'</button></div>'
     +'<div class="tube" data-tube="'+i+'" style="--c:'+cvar(b.color)+'"><i style="width:'+pct(b)+'%"></i></div><div class="sw-row" role="group" aria-label="Cor da barra">'+sw('bar-color',i,b.color)+'</div></div>').join('')
   +(d.bars.length?'':'<p class="empty">Nenhuma barra. Adicione Vida, Mana ou o que sua aventura pedir.</p>')+'</div>';
  h+=goldSheetHTML(d);
  h+='<div class="blk"><div class="blk-h"><h3>Habilidades</h3><button type="button" class="btn small ghost" data-act="skill-add">Nova habilidade</button></div>'
   +d.skills.map((s,i)=>'<div class="skill"><div class="skill-top"><input class="skill-name" data-f="skills.'+i+'.name" value="'+esc(s.name)+'" maxlength="40" placeholder="Nome da habilidade" aria-label="Nome da habilidade"><button type="button" class="x" data-act="skill-rm" data-i="'+i+'" aria-label="Remover '+esc(s.name||'habilidade')+'">'+ICON.x+'</button></div>'
     +'<div class="skill-row"><div class="mini"><label for="sd'+i+'">Dados</label><input id="sd'+i+'" data-f="skills.'+i+'.dice" value="'+esc(s.dice)+'" maxlength="30" placeholder="Ex.: 2d6+3" spellcheck="false"></div><div class="mini"><label for="sb'+i+'">Gasta de</label><select id="sb'+i+'" data-f="skills.'+i+'.costBar">'+barOpts(s.costBar)+'</select></div><div class="mini"><label for="sc'+i+'">Custo</label><input id="sc'+i+'" type="number" inputmode="numeric" data-num data-f="skills.'+i+'.cost" value="'+num(s.cost)+'"></div></div>'
     +'<textarea data-f="skills.'+i+'.desc" rows="2" maxlength="600" placeholder="O que a habilidade faz" aria-label="Descrição da habilidade">'+esc(s.desc)+'</textarea><button type="button" class="btn small" data-act="skill-use" data-i="'+i+'">Usar habilidade</button></div>').join('')
   +(d.skills.length?'':'<p class="empty">Nenhuma habilidade ainda. Cada uma pode rolar dados e gastar energia sozinha.</p>')+'</div>';
  h+='<div class="blk"><h3>Equipamento e inventário</h3><textarea data-f="inv" rows="4" maxlength="3000" aria-label="Equipamento e inventário" placeholder="Armas, poções, moedas, itens de missão">'+esc(d.inv)+'</textarea></div>';
  h+='<div class="blk"><h3>Anotações e história</h3><textarea data-f="notes" rows="4" maxlength="4000" aria-label="Anotações e história" placeholder="Passado do personagem, objetivos, contatos">'+esc(d.notes)+'</textarea></div>';
  h+='<div class="foot-del"><button type="button" class="btn ghost small bad" data-act="char-del">Apagar esta ficha</button></div>';
  return h;
}
function renderFichas(force){
  if(S.tab!=='fichas')return;
  const el=$('#p-fichas');
  if(!force&&isEditing(el)){S.fichasStale=true;return}
  S.fichasStale=false;
  const list=visibleChars(),master=S.role==='master';
  if(S.sheet&&!list.find(c=>c.id===S.sheet.id))S.sheet=null;
  if(!S.sheet&&list.length){const d=clone(list[0]);delete d.id;S.sheet={id:list[0].id,draft:d,dirty:false,base:JSON.stringify(d)}}
  else if(S.sheet&&!S.sheet.dirty){
    const c=S.chars.find(x=>x.id===S.sheet.id);
    if(c){const d=clone(c);delete d.id;const j=JSON.stringify(d);if(j!==S.sheet.base){S.sheet.draft=d;S.sheet.base=j}}
  }
  const items=list.map(c=>'<button type="button" class="pitem" data-act="char-open" data-id="'+esc(c.id)+'" aria-current="'+(S.sheet&&S.sheet.id===c.id)+'">'+avatarHTML(c,32)+'<span><b data-list-name="'+esc(c.id)+'">'+esc(c.name)+'</b><small class="muted">Nível '+num(c.level,1)+(master&&c.ownerName?', de '+esc(c.ownerName):'')+'</small></span></button>').join('');
  el.innerHTML='<div class="sheet-grid"><div class="card"><div class="card-h"><h2>'+(master?'Fichas da mesa':'Suas fichas')+'</h2></div><div class="plist">'+(items||'<p class="empty">'+(master?'Nenhum jogador criou ficha ainda.':'Você ainda não tem ficha.')+'</p>')+'</div><div style="margin-top:14px"><button type="button" class="btn small" data-act="char-new">Nova ficha</button></div></div>'
    +'<div class="card" id="sheet-pane">'+(S.sheet?sheetHTML(S.sheet.draft):'<p class="empty">Crie uma ficha para começar. Você pode ter quantas precisar.</p>')+'</div></div>';
}
async function newCharAction(){
  const c=newChar();const id=uid();
  S.chars.push(Object.assign({id},c));
  flushSheet();
  const d=clone(c);
  S.sheet={id,draft:d,dirty:false,base:JSON.stringify(d)};
  renderFichas(true);
  DB.set('rooms/'+S.code+'/chars/'+id,c);
}
function useSkill(i){
  const d=S.sheet.draft,s=d.skills[i];if(!s)return;
  let spec=null;
  if(s.dice&&s.dice.trim()){
    spec=parseFormula(s.dice);
    if(spec.error){toast(spec.error,4500);return}
    if(!spec.terms.length)spec=null;
  }
  const cost=Math.max(0,num(s.cost));
  if(s.costBar&&cost>0){
    const b=d.bars.find(x=>x.id===s.costBar);
    if(b){
      if(num(b.cur)<cost){toast(b.name+' insuficiente: faltam '+(cost-num(b.cur))+'.',3800);return}
      b.cur=num(b.cur)-cost;S.sheet.dirty=true;scheduleSave();
    }
  }
  if(spec)rollFromSheet(spec,(s.name||'Habilidade')+' ('+d.name+')');
  else{toast((s.name||'Habilidade')+' usada.');renderFichas(true)}
}

/* ============ aba Cenários ============ */
function renderScenesTab(){
  const el=$('#p-cenarios');
  const a=document.activeElement;if(a&&el.contains(a)&&a.tagName==='SELECT')return;
  const act=S.room&&S.room.active;
  el.innerHTML='<div class="card"><div class="card-h"><h2>Cenários</h2><div class="row"><button type="button" class="btn small" data-act="scene-new">Nova cena</button><button type="button" class="btn small ghost" data-act="import">Importar</button><button type="button" class="btn small ghost" data-act="export">Exportar</button></div></div>'
   +(S.scenes.length?S.scenes.map(s=>{
      const img=safeImg(s.image),isA=act===s.id;
      return '<div class="srow">'+(img?'<img src="'+esc(img)+'" alt="">':'<div class="sph">'+slime('candy',36)+'</div>')+'<div class="srow-t"><strong>'+esc(s.title)+'</strong><span class="muted">'+esc((s.text||'').replace(/\s+/g,' ').slice(0,110)||'Sem descrição')+'</span></div><div class="row"><button type="button" class="btn small'+(isA?'':' ghost')+'" data-act="scene-open" data-id="'+esc(s.id)+'">'+(isA?'Na mesa agora':'Abrir na mesa')+'</button><button type="button" class="btn small ghost" data-act="scene-edit" data-id="'+esc(s.id)+'">Editar</button><button type="button" class="btn small ghost bad" data-act="scene-del" data-id="'+esc(s.id)+'">Remover</button></div></div>';
    }).join(''):'<p class="empty">Nenhuma cena ainda. Crie uma, importe um arquivo ou comece pelo cenário de exemplo na tela inicial.</p>')+'</div>';
}
function editScene(id){
  const s=id?S.scenes.find(x=>x.id===id):{title:'',text:'',notes:'',image:''};
  if(!s)return;
  let img=safeImg(s.image);
  modal('<h2>'+(id?'Editar cena':'Nova cena')+'</h2>'
   +'<div class="field"><label for="sc-t">Título</label><input id="sc-t" maxlength="120" value="'+esc(s.title)+'"></div>'
   +'<div class="field"><label for="sc-x">Descrição para os jogadores</label><textarea id="sc-x" rows="6" maxlength="8000">'+esc(s.text)+'</textarea></div>'
   +'<div class="field"><label for="sc-n">Anotações do mestre (aparecem só na tela do mestre)</label><textarea id="sc-n" rows="3" maxlength="4000">'+esc(s.notes||'')+'</textarea></div>'
   +'<div class="field"><label for="sc-i">Imagem ou mapa (opcional)</label><input id="sc-i" type="file" accept="image/*"><div id="sc-p"></div></div>'
   +'<div class="modal-act"><button type="button" class="btn ghost" data-close>Cancelar</button><button type="button" class="btn" id="sc-ok">Salvar cena</button></div>',
   {wide:true,onMount(box){
     const prev=$('#sc-p',box);
     const show=()=>{prev.innerHTML=img?'<div class="row" style="margin-top:8px"><img class="prev" src="'+esc(img)+'" alt="Prévia da imagem"><button type="button" class="btn ghost small" id="sc-rm">Remover imagem</button></div>':''};
     show();
     box.addEventListener('click',e=>{if(e.target.id==='sc-rm'){img='';show()}});
     $('#sc-i',box).addEventListener('change',async e=>{
       const f=e.target.files[0];if(!f)return;
       try{img=await fileToImage(f);show()}catch(err){toast('Não consegui ler essa imagem.')}
     });
     $('#sc-ok',box).addEventListener('click',async()=>{
       const data={title:$('#sc-t',box).value.trim()||'Cena',text:$('#sc-x',box).value,notes:$('#sc-n',box).value,image:img,order:s.order||Date.now()};
       closeModal();
       await DB.set('rooms/'+S.code+'/scenes/'+(id||uid()),data);
     });
   }});
}
function importModal(){
  modal('<h2>Importar cenário</h2><p class="muted">Escolha um arquivo ou cole o texto. As cenas e criaturas são somadas às que já existem na mesa.</p>'
   +'<div class="field"><label for="im-f">Arquivo (.json, .txt ou .md)</label><input id="im-f" type="file" accept=".json,.txt,.md,application/json,text/plain,text/markdown"></div>'
   +'<div class="field"><label for="im-t">Ou cole o texto aqui</label><textarea id="im-t" rows="5" placeholder="# Nome da cena\nDescrição que os jogadores leem."></textarea></div>'
   +'<details><summary>Como montar o arquivo</summary><p class="muted" style="margin:8px 0">Em texto simples, cada linha que começa com # inicia uma nova cena. Em JSON, siga este modelo:</p><pre>'+esc(SAMPLE_FORMAT)+'</pre></details>'
   +'<div class="modal-act"><button type="button" class="btn ghost" data-close>Cancelar</button><button type="button" class="btn" id="im-ok">Importar</button></div>',
   {wide:true,onMount(box){
     $('#im-ok',box).addEventListener('click',async()=>{
       const f=$('#im-f',box).files[0],t=$('#im-t',box).value;
       let sc;
       try{
         if(f)sc=parseScenarioText(await f.text(),f.name);
         else if(t.trim())sc=parseScenarioText(t,'Texto colado');
         else{toast('Escolha um arquivo ou cole um texto.');return}
       }catch(err){toast(err.message||'Não consegui ler esse conteúdo.',5000);return}
       closeModal();
       toast('Importando...');
       if(await applyScenario(S.code,sc,false))toast(sc.scenes.length+' cena(s) e '+sc.foes.length+' criatura(s) importadas.',4200);
     });
   }});
}
async function exportScenario(){
  const obj={slimeRpg:1,title:S.room?S.room.title:'Cenário',
    scenes:S.scenes.map(s=>({title:s.title,text:s.text,notes:s.notes||'',image:safeImg(s.image)})),
    foes:S.foes.map(f=>({name:f.name,type:foeType(f),notes:f.notes||'',img:safeImg(f.img),bars:(f.bars||[]).map(b=>({name:b.name,cur:b.cur,max:b.max,color:b.color}))}))};
  const json=JSON.stringify(obj,null,2);
  if(S.dl){
    try{await S.dl.save({filename:slug(obj.title)+'.json',data:json});toast('Cenário exportado.');return}
    catch(e){if(e&&e.code==='declined')return}
  }
  modal('<h2>Exportar cenário</h2><p class="muted">Copie o texto abaixo e salve em um arquivo .json. Para importar depois, cole na janela de importação.</p><textarea id="ex-t" rows="10" readonly></textarea><div class="modal-act"><button type="button" class="btn" data-close>Fechar</button></div>',
    {wide:true,onMount(box){const t=$('#ex-t',box);t.value=json;t.addEventListener('focus',()=>t.select())}});
}

/* ============ aba Criaturas ============ */
const FOE_PRESETS={
  'Slime verde':[12,'mint'],'Goblin':[8,'mint'],'Esqueleto':[14,'butter'],'Lobo sombrio':[22,'lilac'],'Ogro':[40,'coral'],'Dragão jovem':[120,'coral']
};
const FOE_SECTIONS=[
  ['monster','Monstros','Nenhum monstro ainda. Adicione um modelo e coloque quantas cópias quiser no mapa.'],
  ['npc','NPCs','Nenhum NPC ainda. Crie personagens do mundo com imagem, anotações e, se quiser, barras.'],
  ['boss','Bosses','Nenhum boss ainda. Cada boss tem um botão para ligar ou desligar a barra de vida dele na tela de todos.']
];
function foeCardHTML(f){
  const ty=foeType(f);
  const sceneOpts='<option value="">Qualquer cena</option>'+S.scenes.map(s=>'<option value="'+esc(s.id)+'"'+(f.scene===s.id?' selected':'')+'>'+esc(s.title)+'</option>').join('');
  const visLabel=ty==='monster'?'Novas cópias entram visíveis aos jogadores':'Mostrar aos jogadores';
  return '<article class="foe t-'+ty+'">'+foeImgHTML(f)+'<div class="foe-top"><input data-ff="name" data-id="'+esc(f.id)+'" value="'+esc(f.name)+'" maxlength="60" aria-label="Nome"><button type="button" class="x" data-act="foe-del" data-id="'+esc(f.id)+'" aria-label="Remover '+esc(f.name)+'">'+ICON.x+'</button></div>'
   +(ty==='boss'?'<div class="boss-opt"><button type="button" class="btn small'+(f.bossBar?'':' ghost')+'" data-act="boss-toggle" data-id="'+esc(f.id)+'" aria-pressed="'+!!f.bossBar+'">Barra de vida na tela de todos: '+(f.bossBar?'ligada':'desligada')+'</button>'
      +'<div class="mini"><label for="bs-'+esc(f.id)+'">A barra aparece na cena</label><select id="bs-'+esc(f.id)+'" data-ff="scene" data-id="'+esc(f.id)+'">'+sceneOpts+'</select></div></div>':'')
   +(f.bars||[]).map((b,i)=>'<div class="foe-b">'+barHTML(b,{ctl:true,kind:'foe',id:f.id,i})+'<div class="foe-bed"><input data-fb="name" data-id="'+esc(f.id)+'" data-i="'+i+'" value="'+esc(b.name)+'" maxlength="24" aria-label="Nome da barra"><input type="number" inputmode="numeric" data-fb="max" data-id="'+esc(f.id)+'" data-i="'+i+'" value="'+num(b.max)+'" aria-label="Máximo de '+esc(b.name)+'"><button type="button" class="x" data-act="foe-bar-rm" data-id="'+esc(f.id)+'" data-i="'+i+'" aria-label="Remover a barra '+esc(b.name)+'">'+ICON.x+'</button></div></div>').join('')
   +'<div><button type="button" class="btn ghost small" data-act="foe-bar-add" data-id="'+esc(f.id)+'">Nova barra</button></div>'
   +'<textarea data-ff="notes" data-id="'+esc(f.id)+'" rows="2" maxlength="2000" placeholder="'+(ty==='npc'?'Personalidade, falas, segredos':'Ataques, fraquezas, tesouro')+'" aria-label="Notas">'+esc(f.notes||'')+'</textarea>'
   +'<label class="check"><input type="checkbox" data-ff="visible" data-id="'+esc(f.id)+'"'+(f.visible?' checked':'')+'> '+visLabel+'</label></article>';
}
function renderFoesTab(force){
  const el=$('#p-criaturas');
  if(!force&&isEditing(el)){S.foesStale=true;return}
  S.foesStale=false;
  let h='<div class="stack"><div class="card"><div class="card-h"><h2>Criaturas, NPCs e Bosses</h2></div><div class="foe-add">'
   +'<div class="row"><select id="foe-preset" aria-label="Modelo de monstro" style="width:auto"><option value="">Monstro em branco</option>'+Object.keys(FOE_PRESETS).map(k=>'<option>'+esc(k)+'</option>').join('')+'</select><button type="button" class="btn small" data-act="foe-add" data-type="monster">Adicionar monstro</button></div>'
   +'<div class="row"><button type="button" class="btn small" data-act="foe-add" data-type="npc">Adicionar NPC</button><button type="button" class="btn small" data-act="foe-add" data-type="boss">Adicionar Boss</button></div></div></div>';
  FOE_SECTIONS.forEach(sec=>{
    const l=S.foes.filter(f=>foeType(f)===sec[0]);
    h+='<div class="card"><div class="card-h"><h2>'+sec[1]+'</h2><span class="muted">'+l.length+'</span></div>'
     +(l.length?'<div class="foe-grid">'+l.map(foeCardHTML).join('')+'</div>':'<p class="empty">'+sec[2]+'</p>')+'</div>';
  });
  el.innerHTML=h+'</div>';
}

/* ============ ações (cliques) ============ */
const ACT={
  leave(){leaveRoom()},
  'dice-color'(b){S.color=b.dataset.c;LS.set('slime:color',S.color);renderDiceColors()},
  bar(b){adjustBar(b.dataset.kind,b.dataset.id,+b.dataset.i,+b.dataset.d)},
  'open-char'(b){openSheet(b.dataset.id)},
  'char-open'(b){openSheet(b.dataset.id)},
  'char-new'(){newCharAction()},
  async 'char-del'(){
    if(!S.sheet)return;
    const id=S.sheet.id,nm=S.sheet.draft.name;
    if(!(await confirmBox('Apagar esta ficha?','A ficha de '+nm+' sai da mesa. Isso não pode ser desfeito.','Apagar ficha')))return;
    clearTimeout(S.saveT);S.sheet=null;S.chars=S.chars.filter(c=>c.id!==id);
    renderFichas(true);
    DB.del('rooms/'+S.code+'/chars/'+id);
  },
  color(b){mutDraft(d=>{d.color=b.dataset.c})},
  'xp-add'(){
    const v=Math.max(0,Math.floor(num($('#xp-in').value)));
    if(!v){toast('Digite quanto XP dar.');return}
    let ups=0;
    mutDraft(d=>{d.xp=num(d.xp)+v;while(d.xp>=100*d.level){d.xp-=100*d.level;d.level++;d.points=num(d.points)+2;ups++}});
    if(ups)toast(S.sheet.draft.name+' subiu para o nível '+S.sheet.draft.level+'. Ganhou '+ups*2+' pontos de atributo.',4600);
  },
  'lvl-up'(){mutDraft(d=>{d.level=num(d.level,1)+1;d.points=num(d.points)+2;d.xp=0});toast('Nível '+S.sheet.draft.level+'. Ganhou 2 pontos de atributo.')},
  'lvl-down'(){mutDraft(d=>{d.level=Math.max(1,num(d.level,1)-1);d.xp=Math.min(num(d.xp),100*d.level-1)})},
  'attr-add'(){mutDraft(d=>d.attrs.push({id:uid(),name:'Atributo',val:10}))},
  'attr-rm'(b){mutDraft(d=>d.attrs.splice(+b.dataset.i,1))},
  'attr-plus'(b){mutDraft(d=>{if(d.points>0){d.points--;d.attrs[+b.dataset.i].val=num(d.attrs[+b.dataset.i].val,10)+1}})},
  'attr-roll'(b){const a=S.sheet.draft.attrs[+b.dataset.i];if(a)rollFromSheet({terms:[{t:'d20',n:1}],mod:modOf(a.val)},'Teste de '+a.name+' ('+S.sheet.draft.name+')')},
  'bar-add'(){
    const p=$('#bar-preset').value,C={Vida:'coral',Mana:'lilac',Energia:'butter',Escudo:'candy',Fome:'peach'};
    mutDraft(d=>d.bars.push({id:uid(),name:p==='Personalizada'?'Nova barra':p,cur:10,max:10,color:C[p]||'mint'}));
  },
  'bar-rm'(b){mutDraft(d=>d.bars.splice(+b.dataset.i,1))},
  'bar-color'(b){mutDraft(d=>{d.bars[+b.dataset.i].color=b.dataset.c})},
  'skill-add'(){mutDraft(d=>d.skills.push({id:uid(),name:'',dice:'',costBar:'',cost:0,desc:''}))},
  'skill-rm'(b){mutDraft(d=>d.skills.splice(+b.dataset.i,1))},
  'skill-use'(b){useSkill(+b.dataset.i)},
  'scene-new'(){editScene(null)},
  'scene-edit'(b){editScene(b.dataset.id)},
  'scene-open'(b){DB.update('rooms/'+S.code,{active:b.dataset.id}).then(ok=>{if(ok)toast('Cena aberta na mesa.')})},
  async 'scene-del'(b){
    const s=S.scenes.find(x=>x.id===b.dataset.id);if(!s)return;
    if(!(await confirmBox('Remover esta cena?','"'+s.title+'" será apagada da mesa.','Remover')))return;
    await DB.del('rooms/'+S.code+'/scenes/'+s.id);
    if(S.room&&S.room.active===s.id)DB.update('rooms/'+S.code,{active:null});
  },
  import(){importModal()},
  export(){exportScenario()},
  'foe-add'(b){
    const type=b.dataset.type||'monster';
    const p=type==='monster'?$('#foe-preset').value:'',pr=FOE_PRESETS[p];
    const f={type,name:type==='npc'?'Novo NPC':type==='boss'?'Novo Boss':(p||'Nova criatura'),notes:'',visible:false,order:Date.now(),bossBar:false,scene:'',
      bars:type==='npc'?[]:[{id:uid(),name:'Vida',cur:type==='boss'?200:(pr?pr[0]:10),max:type==='boss'?200:(pr?pr[0]:10),color:pr?pr[1]:'coral'}]};
    DB.set('rooms/'+S.code+'/foes/'+uid(),f).then(ok=>{if(ok)toast(type==='npc'?'NPC criado.':type==='boss'?'Boss criado. Importe a imagem dele e ligue a barra quando a luta começar.':'Monstro criado.',3800)});
  },
  async 'foe-del'(b){
    const f=S.foes.find(x=>x.id===b.dataset.id);if(!f)return;
    if(!(await confirmBox('Remover esta criatura?','"'+f.name+'" sai da mesa.','Remover')))return;
    S.foes=S.foes.filter(x=>x.id!==f.id);renderFoesTab(true);
    DB.del('rooms/'+S.code+'/foes/'+f.id);
  },
  'foe-bar-add'(b){const f=S.foes.find(x=>x.id===b.dataset.id);if(!f)return;f.bars=(f.bars||[]).concat([{id:uid(),name:'Escudo',cur:10,max:10,color:'candy'}]);renderFoesTab(true);persist('foe',f.id,'all',150)},
  'foe-bar-rm'(b){const f=S.foes.find(x=>x.id===b.dataset.id);if(!f)return;f.bars.splice(+b.dataset.i,1);renderFoesTab(true);persist('foe',f.id,'all',150)},
  async 'clear-log'(){
    if(!(await confirmBox('Limpar o registro?','As rolagens salvas nesta mesa serão apagadas para todos.','Limpar')))return;
    try{const all=await store.list('rooms/'+S.code+'/rolls',{orderBy:'ts',dir:'desc',limit:200});for(const r of all)await DB.del('rooms/'+S.code+'/rolls/'+r.id)}catch(e){writeErr(e)}
  }
};
document.addEventListener('click',e=>{
  const c=e.target.closest('[data-close]');if(c&&!$('#overlay').hidden){closeModal();return}
  const t=e.target.closest('[data-tab]');
  if(t&&t.closest('#tabs')){setTab(t.dataset.tab);return}
  const d=e.target.closest('[data-die]');
  if(d){editFormula(sp=>{const x=sp.terms.find(y=>y.t===d.dataset.die);if(x)x.n++;else sp.terms.push({t:d.dataset.die,n:1})});return}
  const dm=e.target.closest('[data-die-minus]');
  if(dm){editFormula(sp=>{const x=sp.terms.find(y=>y.t===dm.dataset.dieMinus);if(x){x.n--;if(x.n<=0)sp.terms=sp.terms.filter(y=>y!==x)}});return}
  const m=e.target.closest('#die-row [data-mod]');
  if(m){editFormula(sp=>{sp.mod+=+m.dataset.mod});return}
  const b=e.target.closest('[data-act]');
  if(b&&ACT[b.dataset.act])ACT[b.dataset.act](b,e);
});

/* ============ campos digitados ============ */
function onSheetInput(t){
  if(!S.sheet)return;
  const p=t.dataset.f;let v=t.value;
  if(t.hasAttribute('data-num'))v=v===''?0:num(v);
  setPath(S.sheet.draft,p,v);S.sheet.dirty=true;
  const pane=$('#p-fichas');let m;
  if((m=p.match(/^attrs\.(\d+)\.val$/))){const el=pane.querySelector('[data-mod="'+m[1]+'"]');if(el)el.textContent=fmtMod(modOf(v))}
  else if((m=p.match(/^bars\.(\d+)\.(cur|max)$/))){const b=S.sheet.draft.bars[+m[1]],i=pane.querySelector('[data-tube="'+m[1]+'"] i');if(b&&i)i.style.width=pct(b)+'%'}
  else if(p==='name'){const el=pane.querySelector('[data-list-name="'+S.sheet.id+'"]');if(el)el.textContent=v||'Sem nome'}
  scheduleSave();
}
$('#p-fichas').addEventListener('input',e=>{if(e.target.dataset.f)onSheetInput(e.target)});
$('#p-fichas').addEventListener('focusout',()=>setTimeout(()=>{if(S.fichasStale&&!isEditing($('#p-fichas'))){S.fichasStale=false;renderFichas()}},60));
$('#p-criaturas').addEventListener('input',e=>{
  const t=e.target,f=S.foes.find(x=>x.id===t.dataset.id);if(!f)return;
  if(t.dataset.ff){f[t.dataset.ff]=t.type==='checkbox'?t.checked:t.value;persist('foe',f.id,'all',t.type==='checkbox'?150:700)}
  else if(t.dataset.fb){
    const b=(f.bars||[])[+t.dataset.i];if(!b)return;
    if(t.dataset.fb==='max'){b.max=Math.max(0,num(t.value));b.cur=Math.min(num(b.cur),b.max)}else b.name=t.value;
    persist('foe',f.id,'all',700);
  }
});
$('#p-criaturas').addEventListener('change',e=>{if(e.target.dataset.fb==='max')renderFoesTab(true)});
$('#p-criaturas').addEventListener('focusout',()=>setTimeout(()=>{if(S.foesStale&&!isEditing($('#p-criaturas'))){S.foesStale=false;renderFoesTab()}},60));
document.addEventListener('change',e=>{
  if(e.target.id==='sel-scene')DB.update('rooms/'+S.code,{active:e.target.value||null});
});

/* ============ montagem da tela ============ */
function initHero(){
  heroTray=new DiceTray($('#hero-stage'));
  heroTray.idle('d20',S.color);
  const stage=$('#hero-stage'),cap=$('#hero-cap');
  const roll=()=>{
    if(heroBusy)return;heroBusy=true;
    const v=randInt(20);cap.textContent='Rolando...';
    const ms=heroTray.play([{t:'d20',v}],S.color);
    setTimeout(()=>{heroBusy=false;cap.textContent='Você tirou '+v+' no d20. Toque de novo para rolar.'},ms+150);
  };
  stage.addEventListener('click',roll);
  stage.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();roll()}});
}
function initTable(){
  tableTray=new DiceTray($('#stage'));
  $('#btn-roll').addEventListener('click',rollFromForm);
  $('#f-formula').addEventListener('input',renderDieRow);
  $('#f-formula').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();rollFromForm()}});
  $('#f-label').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();rollFromForm()}});
  $('#t-code').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(S.code);toast('Código copiado.')}
    catch(e){modal('<h2>Código da mesa</h2><p class="muted">Selecione e copie o código abaixo.</p><input id="cc" readonly value="'+esc(S.code)+'" style="font-weight:800;letter-spacing:.14em;text-align:center"><div class="modal-act"><button type="button" class="btn" data-close>Fechar</button></div>',{onMount(box){const i=$('#cc',box);i.addEventListener('focus',()=>i.select());setTimeout(()=>i.select(),50)}})}
  });
}
function initHome(){
  $('#brand-home').innerHTML=slime('candy',42)+'<span>Slime RPG</span>';
  $('#brand-table').innerHTML=slime('candy',34)+'<span>Slime RPG</span>';
  $('#m-scn').addEventListener('change',e=>{$('#m-file-wrap').hidden=e.target.value!=='file'});
  $('#m-name').value=S.name||'';
  $('#form-master').addEventListener('submit',async e=>{
    e.preventDefault();const b=$('#btn-create');b.disabled=true;
    try{await createRoom()}finally{b.disabled=false}
  });
  initSocialUI();
}
