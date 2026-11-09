/* ============ ouro, barra de boss e mensagens do mestre ============ */

/* ---------- ouro ---------- */
function goldHTML(c,ctl){
  const g=Math.max(0,Math.floor(num(c.gold)));
  return '<div class="gold"><div class="bar-top"><span class="gold-l">'+ICON.coin+'Ouro</span><span class="gold-val">'+g+'</span></div>'
   +(ctl?'<div class="bar-ctl">'+[-10,-1,1,10].map(d=>'<button type="button" class="step" data-act="gold" data-id="'+esc(c.id)+'" data-d="'+d+'" aria-label="'+(d>0?'Receber ':'Gastar ')+Math.abs(d)+' de ouro: '+esc(c.name)+'">'+(d>0?'+'+d:'−'+Math.abs(d))+'</button>').join('')+'</div>':'')
   +'</div>';
}
function goldSheetHTML(d){
  return '<div class="blk"><div class="blk-h"><h3>Ouro</h3></div><div class="gold-edit"><span class="gold-coin">'+ICON.coin.replace('width="22" height="22"','width="40" height="40"')+'</span>'
   +'<div class="mini"><label for="g-cur">Ouro atual</label><input id="g-cur" type="number" min="0" inputmode="numeric" data-num data-f="gold" value="'+Math.max(0,Math.floor(num(d.gold)))+'"></div>'
   +'<div class="bar-ctl">'+[-10,-1,1,10].map(x=>'<button type="button" class="step" data-act="gold-step" data-d="'+x+'" aria-label="'+(x>0?'Receber ':'Gastar ')+Math.abs(x)+' de ouro">'+(x>0?'+'+x:'−'+Math.abs(x))+'</button>').join('')+'</div>'
   +'<div class="gold-act"><input id="gold-in" type="number" min="0" inputmode="numeric" placeholder="Valor" aria-label="Valor de ouro"><button type="button" class="btn small" data-act="gold-add">Receber</button><button type="button" class="btn small ghost" data-act="gold-sub">Gastar</button></div></div></div>';
}
function adjustGold(id,d){
  const i=S.chars.findIndex(x=>x.id===id);if(i<0)return;
  const c=clone(S.chars[i]);c.gold=Math.max(0,Math.floor(num(c.gold))+d);
  S.chars[i]=c;doRepaint();persist('char',id,'bars',300);
}
function sheetGold(fn){mutDraft(d=>{d.gold=Math.max(0,Math.floor(fn(Math.max(0,Math.floor(num(d.gold))))))})}

/* ---------- barra de vida do boss ---------- */
const BOSSFILL={coral:'#E4364D',candy:'#3F9BEA',mint:'#2FB987',lilac:'#8D6AE6',butter:'#EFB02A',peach:'#EE8446'};
function bossList(){
  const act=S.room&&S.room.active;
  return S.foes.filter(f=>foeType(f)==='boss'&&f.bossBar&&(!f.scene||f.scene===act)&&(f.bars||[])[0]);
}
function bossHudHTML(f,master){
  return '<div class="boss-main"><div class="boss-name"><span></span></div>'
   +'<div class="boss-bar"><div class="boss-track"><div class="boss-trail"></div><div class="boss-fill"></div><div class="boss-shine"></div><span class="boss-val"></span></div></div>'
   +(master?'<div class="boss-ctl">'+[-10,-5,-1,1,5,10].map(d=>'<button type="button" class="bc'+(Math.abs(d)===10?' big':'')+'" data-act="bar" data-kind="foe" data-id="'+esc(f.id)+'" data-i="0" data-d="'+d+'" aria-label="'+(d>0?'Curar ':'Causar dano de ')+Math.abs(d)+'">'+(d>0?'+'+d:'−'+Math.abs(d))+'</button>').join('')
     +'<button type="button" class="bc off" data-act="boss-toggle" data-id="'+esc(f.id)+'">Ocultar barra</button></div>':'')
   +'</div><div class="boss-portrait"></div>';
}
function renderBossHud(){
  const host=$('#boss-hud');if(!host)return;
  const master=S.role==='master',list=S.code?bossList():[];
  Array.from(host.children).forEach(el=>{if(!list.some(f=>f.id===el.dataset.id))el.remove()});
  list.forEach(f=>{
    let el=Array.from(host.children).find(x=>x.dataset.id===f.id);
    if(!el){el=document.createElement('div');el.className='boss';el.dataset.id=f.id;el.innerHTML=bossHudHTML(f,master);host.appendChild(el);el._pct=null}
    const b=f.bars[0],p=pct(b),max=Math.max(0,num(b.max)),cur=num(b.cur);
    $('.boss-name span',el).textContent=f.name;
    el.style.setProperty('--bc',BOSSFILL[b.color]||BOSSFILL.coral);
    $('.boss-fill',el).style.width=p+'%';$('.boss-trail',el).style.width=p+'%';
    $('.boss-val',el).textContent=cur+' / '+max;
    el.classList.toggle('low',p>0&&p<=25);el.classList.toggle('dead',p<=0);
    if(el._pct!==null&&p<el._pct){const bar=$('.boss-bar',el);bar.classList.remove('hit');void bar.offsetWidth;bar.classList.add('hit')}
    el._pct=p;
    const im=safeImg(f.img),pt=$('.boss-portrait',el);
    if(pt.dataset.k!==im){pt.dataset.k=im;pt.innerHTML=avatarHTML({img:im,color:'coral'},84)}
  });
}

/* ---------- mensagens do mestre na tela dos jogadores ---------- */
const memberName=id=>{const m=S.members.find(x=>x.id===id);return m?m.name:'Jogador'};
const msgTargets=m=>m.toAll?S.members.filter(x=>x.role==='player').map(x=>x.id):(Array.isArray(m.to)?m.to:[]);
function pendingMsgs(){
  if(!S.code||S.role==='master')return[];
  const me=S.members.find(m=>m.id===S.uid);if(!me)return[];
  const since=num(me.joinedAt,0)-60000;
  return S.msgs.filter(m=>{
    if(m.ack&&m.ack[S.uid])return false;
    if(m.toAll)return num(m.ts)>=since;
    return Array.isArray(m.to)&&m.to.indexOf(S.uid)>=0;
  }).sort((a,b)=>num(a.ts)-num(b.ts));
}
function onMsgs(l){S.msgs=l;renderMsgOverlay();if(S.tab==='mesa')renderMsgCard()}
function hideOverlays(){
  const b=$('#boss-hud'),m=$('#msg-overlay');
  if(b)b.innerHTML='';
  if(m){m.hidden=true;m.innerHTML='';m.dataset.id=''}
  document.body.classList.remove('msg-on');
}
function renderMsgOverlay(){
  const host=$('#msg-overlay');if(!host)return;
  let cur=null,total=0;
  if(S.preview){cur={id:'__prev',text:S.preview.text,prev:true};total=1}
  else if(S.code){const p=pendingMsgs();total=p.length;cur=p[0]||null}
  if(!cur){
    if(!host.hidden){host.hidden=true;host.innerHTML=''}
    host.dataset.id='';document.body.classList.remove('msg-on');return;
  }
  const count=cur.prev?'Prévia: é assim que os jogadores vão ver.':(total>1?'Mensagem 1 de '+total:'');
  if(host.dataset.id===cur.id&&!host.hidden){const c=$('.msg-count',host);if(c)c.textContent=count;return}
  host.dataset.id=cur.id;host.hidden=false;document.body.classList.add('msg-on');
  const who=S.room&&S.room.masterName?' · '+esc(S.room.masterName):'';
  host.innerHTML='<div class="msg-card" role="alertdialog" aria-modal="true" aria-labelledby="msg-h">'
   +'<div class="msg-from" id="msg-h"><i></i>Mensagem do mestre'+who+'<i></i></div>'
   +'<div class="msg-text">'+paras(cur.text)+'</div>'
   +'<div class="msg-foot"><span class="msg-count">'+esc(count)+'</span><button type="button" class="btn" id="msg-next" data-act="msg-next">'+(cur.prev?'Fechar prévia':'Próximo')+'</button></div></div>';
  const b=$('#msg-next',host);if(b)b.focus();
}
document.addEventListener('keydown',e=>{
  const h=$('#msg-overlay');
  if(e.key==='Tab'&&h&&!h.hidden){e.preventDefault();const b=$('#msg-next');if(b)b.focus()}
},true);

function renderMsgCard(){
  const el=$('#m-msg');if(!el)return;
  if(S.role!=='master'){el.hidden=true;return}
  el.hidden=false;
  let h='<div class="card-h"><h2>Mensagem na tela</h2><div class="row">'+(S.msgs.length?'<button type="button" class="btn small ghost" data-act="msg-clear">Limpar</button>':'')+'<button type="button" class="btn small" data-act="msg-new">Nova mensagem</button></div></div>';
  if(!S.msgs.length)h+='<p class="empty">Escreva um texto que cobre a tela inteira de todos os jogadores, ou só de um, até a pessoa clicar em Próximo.</p>';
  else h+=S.msgs.slice(0,6).map(m=>{
    const tg=msgTargets(m),pend=tg.filter(id=>!(m.ack&&m.ack[id])),read=tg.length-pend.length;
    const who=m.toAll?'Todos os jogadores':((m.toNames&&m.toNames.length)?m.toNames.join(', '):tg.map(memberName).join(', '));
    const st=!tg.length?'Ninguém para receber ainda':!pend.length?'✓ Todos já clicaram em Próximo':'Leram '+read+' de '+tg.length+'. Faltam: '+pend.map(memberName).join(', ');
    return '<div class="msgrow"><div class="msgrow-t"><strong>Para: '+esc(who)+'</strong><span class="muted">'+esc(String(m.text||'').replace(/\s+/g,' ').slice(0,90))+'</span><span class="st">'+esc(st)+'</span></div>'
      +'<button type="button" class="x" data-act="msg-del" data-id="'+esc(m.id)+'" aria-label="Apagar mensagem e tirar da tela dos jogadores">'+ICON.x+'</button></div>';
  }).join('');
  el.innerHTML=h;
}
function msgModal(){
  const players=S.members.filter(m=>m.role==='player');
  modal('<h2>Mensagem na tela dos jogadores</h2><p class="muted">O texto cobre a tela inteira de quem receber e só some quando a pessoa clicar em Próximo.</p>'
   +'<fieldset class="msg-to"><legend class="lab">Para quem</legend>'
   +'<label class="check"><input type="checkbox" id="mt-all" checked> Todos os jogadores</label>'
   +players.map(p=>'<label class="check"><input type="checkbox" class="mt-p" value="'+esc(p.id)+'" disabled> '+esc(p.name)+'</label>').join('')
   +(players.length?'':'<p class="muted">Ninguém entrou na mesa ainda. Convide seus amigos para receberem mensagens.</p>')
   +'</fieldset><div class="field"><label for="mt-x">Mensagem</label><textarea id="mt-x" rows="5" maxlength="1200" placeholder="Ex.: Vocês ouvem um rugido vindo do fundo da caverna..."></textarea></div>'
   +'<div class="modal-act"><button type="button" class="btn ghost" data-close>Cancelar</button><button type="button" class="btn ghost" id="mt-prev">Pré-visualizar</button><button type="button" class="btn" id="mt-ok">Enviar</button></div>',
   {onMount(box){
     const all=$('#mt-all',box),ps=$$('.mt-p',box);
     all.addEventListener('change',()=>ps.forEach(p=>{p.disabled=all.checked;if(all.checked)p.checked=false}));
     $('#mt-x',box).focus();
     $('#mt-prev',box).addEventListener('click',()=>{
       const t=$('#mt-x',box).value.trim();if(!t){toast('Escreva a mensagem primeiro.');return}
       S.preview={text:t};renderMsgOverlay();
     });
     $('#mt-ok',box).addEventListener('click',async()=>{
       const text=$('#mt-x',box).value.trim();
       if(!text){toast('Escreva a mensagem.');return}
       const toAll=all.checked,ids=ps.filter(p=>p.checked).map(p=>p.value);
       if(!toAll&&!ids.length){toast('Escolha para quem enviar.');return}
       if(toAll&&!players.length){toast('Ainda não há jogadores na mesa.');return}
       closeModal();
       const ok=await DB.set('rooms/'+S.code+'/messages/'+uid(),{text,toAll,to:toAll?[]:ids,toNames:toAll?[]:ids.map(memberName),from:S.uid,ts:Date.now(),ack:{}});
       if(ok)toast('Mensagem enviada. Fica na tela até clicarem em Próximo.',4200);
     });
   }});
}

Object.assign(ACT,{
  gold(b){adjustGold(b.dataset.id,+b.dataset.d)},
  'gold-step'(b){sheetGold(g=>g+(+b.dataset.d))},
  'gold-add'(){
    const v=Math.floor(num($('#gold-in').value));
    if(v<=0){toast('Digite quanto ouro receber.');return}
    sheetGold(g=>g+v);toast('+'+v+' de ouro.');
  },
  'gold-sub'(){
    const v=Math.floor(num($('#gold-in').value));
    if(v<=0){toast('Digite quanto ouro gastar.');return}
    if(v>Math.max(0,Math.floor(num(S.sheet.draft.gold)))){toast('Ouro insuficiente.');return}
    sheetGold(g=>g-v);toast('−'+v+' de ouro.');
  },
  'boss-toggle'(b){
    const f=S.foes.find(x=>x.id===b.dataset.id);if(!f)return;
    f.bossBar=!f.bossBar;
    toast(f.bossBar?'Barra do boss ligada. Todos veem na tela.':'Barra do boss desligada.');
    doRepaint();if(S.tab==='criaturas')renderFoesTab(true);
    persist('foe',f.id,'all',100);
  },
  'foe-arm'(b){
    if(!(S.room&&S.room.active)){toast('Abra uma cena na mesa primeiro (aba Cenários).',4200);return}
    S.arm={kind:'foe',id:b.dataset.id};S.selTok=null;setTab('mesa');
  },
  qty(b){S.armQty=clamp(S.armQty+(+b.dataset.d),1,12);renderScene()},
  async 'arm-many'(){
    const sc=activeScene(),f=S.arm&&S.arm.kind==='foe'&&S.foes.find(x=>x.id===S.arm.id);
    if(!sc||!f)return;
    const n=S.armQty,cols=Math.min(n,5),pts=[];
    for(let i=0;i<n;i++)pts.push([clamp(.5+((i%5)-(cols-1)/2)*.15,.06,.94),clamp(.3+Math.floor(i/5)*.2,.06,.94)]);
    await addInstances(f,sc,pts);
    toast(n+' cópias colocadas. Arraste cada uma para o lugar certo.',3800);
  },
  'tok-del'(b){
    const id=b.dataset.id;S.tokens=S.tokens.filter(t=>t.id!==id);if(S.selTok===id)S.selTok=null;
    repaint();DB.del(tokPath(id));
  },
  'tok-vis-all'(){
    const sc=activeScene();if(!sc)return;
    S.tokens.filter(t=>t.scene===sc.id&&t.kind==='foe').forEach(t=>{
      const e=tokEntity(t);if(!e||e.visible)return;
      if(t.inst){t.vis=true;DB.update(tokPath(t.id),{vis:true})}
      else{e.visible=true;persist('foe',e.id,'all',100)}
    });
    renderScene();toast('Criaturas reveladas aos jogadores.');
  },
  'msg-new'(){msgModal()},
  'msg-next'(){
    if(S.preview){S.preview=null;renderMsgOverlay();return}
    const p=pendingMsgs()[0];if(!p)return;
    const ts=Date.now();p.ack=Object.assign({},p.ack,{[S.uid]:ts});
    renderMsgOverlay();
    DB.update('rooms/'+S.code+'/messages/'+p.id,{['ack.'+S.uid]:ts});
  },
  'msg-del'(b){
    const id=b.dataset.id;S.msgs=S.msgs.filter(m=>m.id!==id);renderMsgCard();
    DB.del('rooms/'+S.code+'/messages/'+id);
  },
  async 'msg-clear'(){
    if(!(await confirmBox('Limpar as mensagens?','Todas as mensagens saem da tela dos jogadores e do seu histórico.','Limpar')))return;
    try{const all=await store.list('rooms/'+S.code+'/messages',{orderBy:'ts',dir:'desc',limit:200});for(const m of all)await DB.del('rooms/'+S.code+'/messages/'+m.id)}catch(e){writeErr(e)}
  }
});
