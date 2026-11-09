/* ============ conta Google, amigos, convites e mesas (Firebase) ============ */
Object.assign(S,{user:null,profile:null,friends:[],requests:[],sent:[],invites:[],myRooms:[],prof:{},seg:'criar',booted:false});
const SOC={subs:[]};
let fb=null;
let _authDone;const authDone=new Promise(r=>{_authDone=r});
const cfgOk=()=>{
  const c=window.SLIME_FIREBASE_CONFIG;
  return !!(window.firebase&&c&&c.apiKey&&c.projectId&&String(c.apiKey).indexOf('COLE')<0);
};
const friendCode=()=>{const A='ABCDEFGHJKMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=A[Math.floor(Math.random()*A.length)];return s};

/* ---------- inicialização ---------- */
async function initPlatform(){
  S.readOnly=false;
  if(!cfgOk()){S.demo=true;store=createLocalStore();S.uid='mestre';return}
  firebase.initializeApp(window.SLIME_FIREBASE_CONFIG);
  fb={auth:firebase.auth(),db:firebase.firestore()};
  try{fb.db.settings({ignoreUndefinedProperties:true})}catch(e){}
  store=createFirestoreStore(fb.db);
  fb.auth.onAuthStateChanged(onAuthChange,e=>{console.warn(e);_authDone()});
  await Promise.race([authDone,new Promise(r=>setTimeout(r,9000))]);
}
async function onAuthChange(u){
  stopSocial();
  if(!u){
    Object.assign(S,{user:null,profile:null,uid:null,friends:[],requests:[],sent:[],invites:[],myRooms:[],prof:{}});
    if(S.code)leaveRoom();
    if(S.booted)renderLobby();
    _authDone();return;
  }
  S.user={uid:u.uid,name:u.displayName||String(u.email||'Aventureiro').split('@')[0],photo:u.photoURL||''};
  S.uid=u.uid;
  try{await ensureProfile()}
  catch(e){console.warn(e);toast('Não consegui carregar seu perfil. Publique as regras do Firestore (veja o README).',7000)}
  startSocial();
  if(!$('#m-name').value)$('#m-name').value=S.name||S.user.name;
  if(S.booted)renderLobby();
  _authDone();
}
async function ensureProfile(){
  const path='users/'+S.uid;
  let p=null;try{p=await store.get(path)}catch(e){}
  p=p||{};
  let code=p.friendCode||'';
  for(let i=0;!code&&i<10;i++){
    const c=friendCode();
    try{await store.set('friendCodes/'+c,{uid:S.uid});code=c}
    catch(e){if(!(e&&e.code==='permission-denied'))throw e}
  }
  S.profile={name:p.name||S.user.name,photo:S.user.photo||p.photo||'',friendCode:code};
  S.user.name=S.profile.name;
  await store.set(path,Object.assign({},S.profile,{createdAt:p.createdAt||Date.now()}));
}
function startSocial(){
  const u='users/'+S.uid;
  SOC.subs=[
    store.subCol(u+'/friends',l=>{S.friends=l;loadProfiles(l.map(x=>x.id));softRender()}),
    store.subCol(u+'/requests',l=>{S.requests=l;softRender()}),
    store.subCol(u+'/sent',l=>{S.sent=l;softRender()}),
    store.subCol(u+'/invites',l=>{S.invites=l;softRender()}),
    store.subCol(u+'/rooms',l=>{S.myRooms=l.sort((a,b)=>(b.at||0)-(a.at||0));softRender()})
  ];
}
function stopSocial(){SOC.subs.forEach(f=>{try{f()}catch(e){}});SOC.subs=[]}
function loadProfiles(ids){
  ids.forEach(id=>{
    if(id in S.prof)return;
    S.prof[id]=false;
    store.get('users/'+id).then(p=>{if(p){S.prof[id]=p;softRender()}}).catch(()=>{});
  });
}
let _sr=0;
function softRender(){if(_sr||!S.booted)return;_sr=setTimeout(()=>{_sr=0;renderLobby()},40)}
const pinfo=(id,fb0)=>Object.assign({},fb0||{},S.prof[id]||{});

/* ---------- login ---------- */
function loginMsg(e){
  const c=e&&e.code;
  if(c==='auth/unauthorized-domain')return 'Este endereço ainda não está autorizado no Firebase. Em Authentication > Configurações > Domínios autorizados, adicione o endereço do site.';
  if(c==='auth/operation-not-allowed')return 'O login com Google ainda não está ligado no Firebase. Ligue em Authentication > Método de login.';
  if(c==='auth/network-request-failed')return 'Sem conexão. Tente de novo.';
  return 'Não foi possível entrar'+(c?' ('+c+')':'')+'.';
}
async function loginGoogle(){
  $('#login-err').textContent='';
  const p=new firebase.auth.GoogleAuthProvider();
  p.setCustomParameters({prompt:'select_account'});
  try{await fb.auth.signInWithPopup(p)}
  catch(e){
    const c=e&&e.code;
    if(c==='auth/popup-blocked'||c==='auth/operation-not-supported-in-this-environment'){
      try{await fb.auth.signInWithRedirect(p)}catch(x){$('#login-err').textContent=loginMsg(x)}
    }else if(c!=='auth/popup-closed-by-user'&&c!=='auth/cancelled-popup-request')$('#login-err').textContent=loginMsg(e);
  }
}

/* ---------- visual da tela inicial ---------- */
function photoHTML(url,size,name){
  if(url&&/^https:\/\//.test(url))return '<img class="av" src="'+esc(url)+'" width="'+size+'" height="'+size+'" alt="" referrerpolicy="no-referrer">';
  return '<span class="av ini" style="width:'+size+'px;height:'+size+'px;font-size:'+Math.round(size*.45)+'px" aria-hidden="true">'+esc(String(name||'?').trim().charAt(0).toUpperCase())+'</span>';
}
function showSeg(n){
  if(S.demo&&n==='amigos')n='criar';
  S.seg=n;
  $$('.seg-b').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.seg===n)));
  $('#form-master').hidden=n!=='criar';
  $('#panel-mesas').hidden=n!=='mesas';
  $('#panel-amigos').hidden=n!=='amigos';
}
function setBadge(id,n){const b=$(id);b.hidden=!n;b.textContent=n||''}
function renderLobby(){
  const authed=!!S.user,demo=S.demo;
  $('#boot-msg').hidden=true;
  $('#login').hidden=demo||authed;
  $('#lobby').hidden=!(demo||authed);
  $('#user-box').hidden=!authed;
  $('#seg-amigos').hidden=demo;
  if(authed){$('#u-name').textContent=S.user.name;$('#u-photo').innerHTML=photoHTML(S.user.photo,32,S.user.name)}
  setBadge('#b-mesas',S.invites.length);setBadge('#b-amigos',S.requests.length);
  renderMesasPanel();renderAmigosPanel();
  showSeg(S.seg);
}
function roomList(){return S.demo?LS.get('slime:recent',[]):S.myRooms}
function renderMesasPanel(){
  const el=$('#panel-mesas');if(isEditing(el))return;
  let h='';
  if(!S.demo){
    h+='<h3>Convites recebidos</h3>';
    h+=S.invites.length?S.invites.map(i=>
      '<div class="person"><div class="p-info"><div><strong>'+esc(i.roomTitle||'Mesa')+'</strong><span class="muted">Convite de '+esc(i.fromName||'um amigo')+'</span></div></div>'
      +'<div class="row"><button type="button" class="btn small" data-act="inv-accept" data-code="'+esc(i.id)+'">Entrar</button>'
      +'<button type="button" class="btn small ghost" data-act="inv-decline" data-code="'+esc(i.id)+'">Recusar</button></div></div>').join('')
      :'<p class="muted">Nenhum convite agora. Quando um amigo mestre convidar você, o convite aparece aqui.</p>';
  }
  const rooms=roomList();
  h+='<h3>Minhas mesas</h3>';
  h+=rooms.length?rooms.map(r=>
    '<div class="person"><div class="p-info"><div><strong>'+esc(r.title||'Mesa')+'</strong><span class="muted">'+(r.role==='master'?'Você é o mestre':'Você é jogador')+'</span></div></div>'
    +'<div class="row"><button type="button" class="btn small" data-act="room-open" data-code="'+esc(r.code)+'" data-role="'+esc(r.role)+'">Entrar</button>'
    +(r.role==='master'?'<button type="button" class="btn small ghost bad" data-act="room-del" data-code="'+esc(r.code)+'" data-title="'+esc(r.title||'Mesa')+'">Apagar mesa</button>'
      :'<button type="button" class="btn small ghost" data-act="room-leave" data-code="'+esc(r.code)+'" data-title="'+esc(r.title||'Mesa')+'">Sair da mesa</button>')
    +'</div></div>').join('')
    :'<p class="muted">'+(S.demo?'Nenhuma mesa ainda. Crie uma na aba Criar mesa.':'Você ainda não tem mesas. Crie uma ou aceite um convite.')+'</p>';
  el.innerHTML=h;
}
function renderAmigosPanel(){
  const el=$('#panel-amigos');if(S.demo||!S.user||isEditing(el))return;
  const code=S.profile?S.profile.friendCode:'';
  let h='<h3>Seu código de amigo</h3><div class="code-box"><strong>'+esc(code)+'</strong><button type="button" class="btn small ghost" data-act="fr-copy">Copiar código</button></div>'
   +'<p class="muted">Passe este código para quem você quer ter como amigo. Só amigos podem ser convidados para as mesas.</p>'
   +'<h3>Adicionar amigo</h3><form id="form-friend" autocomplete="off"><label class="sr" for="fr-code" style="position:absolute;left:-9999px">Código do amigo</label>'
   +'<input id="fr-code" maxlength="8" placeholder="Código do amigo"><button class="btn" type="submit">Enviar pedido</button></form>';
  if(S.requests.length)h+='<h3>Pedidos recebidos</h3>'+S.requests.map(r=>
    '<div class="person"><div class="p-info">'+photoHTML(r.fromPhoto,36,r.fromName)+'<div><strong>'+esc(r.fromName||'Alguém')+'</strong><span class="muted">Quer ser seu amigo</span></div></div>'
    +'<div class="row"><button type="button" class="btn small" data-act="fr-accept" data-id="'+esc(r.id)+'">Aceitar</button><button type="button" class="btn small ghost" data-act="fr-decline" data-id="'+esc(r.id)+'">Recusar</button></div></div>').join('');
  if(S.sent.length)h+='<h3>Pedidos enviados</h3>'+S.sent.map(r=>
    '<div class="person"><div class="p-info">'+photoHTML(r.toPhoto,36,r.toName)+'<div><strong>'+esc(r.toName||'Alguém')+'</strong><span class="muted">Aguardando resposta</span></div></div>'
    +'<div class="row"><button type="button" class="btn small ghost" data-act="fr-cancel" data-id="'+esc(r.id)+'">Cancelar</button></div></div>').join('');
  h+='<h3>Meus amigos</h3>';
  h+=S.friends.length?S.friends.map(f=>{const p=pinfo(f.id,f);
    return '<div class="person"><div class="p-info">'+photoHTML(p.photo,36,p.name)+'<div><strong>'+esc(p.name||'Amigo')+'</strong></div></div>'
      +'<div class="row"><button type="button" class="btn small ghost bad" data-act="fr-remove" data-id="'+esc(f.id)+'" data-name="'+esc(p.name||'Amigo')+'">Remover</button></div></div>'}).join('')
    :'<p class="muted">Você ainda não tem amigos. Envie um pedido com o código de alguém.</p>';
  el.innerHTML=h;
}
function initSocialUI(){
  $$('.seg-b').forEach(b=>b.addEventListener('click',()=>showSeg(b.dataset.seg)));
  $('#btn-google').addEventListener('click',loginGoogle);
  $('#panel-amigos').addEventListener('submit',async e=>{
    if(e.target.id!=='form-friend')return;
    e.preventDefault();
    if(await sendRequest($('#fr-code').value))$('#fr-code').value='';
  });
  $('#panel-amigos').addEventListener('input',e=>{if(e.target.id==='fr-code')e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'')});
}

/* ---------- amigos ---------- */
async function sendRequest(raw){
  const code=String(raw||'').trim().toUpperCase();
  if(code.length<4){toast('Digite o código do seu amigo.');return false}
  let r=null;try{r=await store.get('friendCodes/'+code)}catch(e){r=null}
  if(!r||!r.uid){toast('Não encontrei esse código de amigo.',4500);return false}
  const to=r.uid;
  if(to===S.uid){toast('Esse é o seu próprio código.');return false}
  if(S.friends.some(f=>f.id===to)){toast('Vocês já são amigos.');return false}
  if(S.sent.some(x=>x.id===to)){toast('Você já enviou um pedido para essa pessoa.');return false}
  if(S.requests.some(x=>x.id===to)){await acceptRequest(to);return true}
  let tp=null;try{tp=await store.get('users/'+to)}catch(e){}
  const now=Date.now();
  if(!(await DB.set('users/'+to+'/requests/'+S.uid,{from:S.uid,fromName:S.user.name,fromPhoto:S.user.photo||'',createdAt:now})))return false;
  await DB.set('users/'+S.uid+'/sent/'+to,{to:to,toName:(tp&&tp.name)||'Amigo',toPhoto:(tp&&tp.photo)||'',createdAt:now});
  toast('Pedido enviado.');
  return true;
}
async function acceptRequest(from){
  const rq=S.requests.find(x=>x.id===from);if(!rq)return;
  const me=S.uid,now=Date.now();
  const ok=await DB.batch([
    {p:'users/'+me+'/friends/'+from,d:{uid:from,name:rq.fromName||'Amigo',photo:rq.fromPhoto||'',since:now}},
    {p:'users/'+from+'/friends/'+me,d:{uid:me,name:S.user.name,photo:S.user.photo||'',since:now}},
    {p:'users/'+me+'/requests/'+from,del:true},
    {p:'users/'+from+'/sent/'+me,del:true}
  ]);
  if(ok)toast('Agora vocês são amigos.');
}
const declineRequest=from=>DB.batch([{p:'users/'+S.uid+'/requests/'+from,del:true},{p:'users/'+from+'/sent/'+S.uid,del:true}]);
const cancelRequest=to=>DB.batch([{p:'users/'+S.uid+'/sent/'+to,del:true},{p:'users/'+to+'/requests/'+S.uid,del:true}]);
const removeFriend=id=>DB.batch([{p:'users/'+S.uid+'/friends/'+id,del:true},{p:'users/'+id+'/friends/'+S.uid,del:true}]);

/* ---------- mesas e convites ---------- */
function remember(code,role,title){
  if(S.demo||!S.user){
    const r=LS.get('slime:recent',[]).filter(x=>x.code!==code);
    r.unshift({code,role,title,at:Date.now()});LS.set('slime:recent',r.slice(0,8));
    return;
  }
  DB.set('users/'+S.uid+'/rooms/'+code,{code,title:title||'Mesa',role,at:Date.now()});
}
async function forgetRoom(code){
  if(S.demo||!S.user){LS.set('slime:recent',LS.get('slime:recent',[]).filter(x=>x.code!==code));if(S.booted)renderLobby();return}
  try{await store.del('users/'+S.uid+'/rooms/'+code)}catch(e){}
}
function renderRecents(){if(S.booted)renderLobby()}
async function openRoom(code){
  let room=null;
  try{room=await store.get('rooms/'+code)}catch(e){room=null}
  if(!room||room.closed){toast('Essa mesa não existe mais ou você não tem acesso a ela.',5000);await forgetRoom(code);return}
  S.name=S.name||(S.user&&S.user.name)||'';
  enterRoom(code,(S.demo||room.master===S.uid)?'master':'player');
}
async function acceptInvite(code){
  const inv=S.invites.find(i=>i.id===code);if(!inv)return;
  try{await store.set('rooms/'+code+'/members/'+S.uid,{name:S.user.name,role:'player',joinedAt:Date.now()})}
  catch(e){
    console.warn(e);
    toast('Não consegui entrar. A mesa pode ter sido apagada.',5000);
    try{await store.del('users/'+S.uid+'/invites/'+code)}catch(_){}
    return;
  }
  await DB.set('users/'+S.uid+'/rooms/'+code,{code,title:inv.roomTitle||'Mesa',role:'player',at:Date.now()});
  await DB.del('users/'+S.uid+'/invites/'+code);
  S.name=S.user.name;
  enterRoom(code,'player');
}
async function leaveForever(code,title){
  if(!(await confirmBox('Sair da mesa "'+title+'"?','Suas fichas nessa mesa continuam lá. Para voltar, o mestre precisa convidar você de novo.','Sair da mesa')))return;
  await DB.del('rooms/'+code+'/members/'+S.uid);
  await forgetRoom(code);
  toast('Você saiu da mesa.');
}
async function deleteRoom(code,title){
  if(!(await confirmBox('Apagar a mesa "'+title+'"?','Fichas, cenários, criaturas, mapa e rolagens somem para todos. Não dá para desfazer.','Apagar mesa')))return;
  const base='rooms/'+code;
  S.deleting=true;toast('Apagando a mesa...',9000);
  try{
    await store.update(base,{closed:true});
    for(const col of ['rolls','tokens','chars','foes','scenes']){
      const l=await store.list(base+'/'+col);
      await store.delMany(l.map(x=>base+'/'+col+'/'+x.id));
    }
    if(!S.demo){
      const inv=await store.list(base+'/invited');
      for(const i of inv){try{await store.del('users/'+i.id+'/invites/'+code)}catch(e){}}
      await store.delMany(inv.map(i=>base+'/invited/'+i.id));
    }
    const mem=await store.list(base+'/members');
    await store.delMany(mem.filter(m=>m.id!==S.uid).map(m=>base+'/members/'+m.id));
    await store.del(base);
    await store.del(base+'/members/'+S.uid);
    await forgetRoom(code);
  }catch(e){console.warn(e);S.deleting=false;writeErr(e);return}
  S.deleting=false;
  if(S.code===code)leaveRoom();
  toast('Mesa apagada.');
}
async function inviteModal(){
  if(S.role!=='master'||S.demo)return;
  let invited=[];try{invited=await store.list('rooms/'+S.code+'/invited')}catch(e){}
  const inRoom=new Set(S.members.map(m=>m.id)),inv=new Set(invited.map(i=>i.id));
  const rows=S.friends.map(f=>{
    const p=pinfo(f.id,f);let act;
    if(inRoom.has(f.id))act='<span class="chip">Na mesa</span>';
    else if(inv.has(f.id))act='<span class="chip">Convite enviado</span><button type="button" class="btn small ghost" data-act="inv-cancel" data-id="'+esc(f.id)+'">Cancelar</button>';
    else act='<button type="button" class="btn small" data-act="inv-send" data-id="'+esc(f.id)+'">Convidar</button>';
    return '<div class="person"><div class="p-info">'+photoHTML(p.photo,36,p.name)+'<div><strong>'+esc(p.name||'Amigo')+'</strong></div></div><div class="row">'+act+'</div></div>';
  }).join('');
  modal('<h2>Convidar amigos</h2><p class="muted">Só quem é seu amigo pode ser convidado. O convite aparece na tela inicial dele.</p>'
    +(rows||'<p class="empty">Você ainda não tem amigos. Adicione na tela inicial, aba Amigos.</p>')
    +'<div class="modal-act"><button type="button" class="btn" data-close>Pronto</button></div>');
}
async function inviteFriend(fid){
  const now=Date.now();
  if(!(await DB.set('rooms/'+S.code+'/invited/'+fid,{at:now})))return;
  const ok=await DB.set('users/'+fid+'/invites/'+S.code,{room:S.code,roomTitle:S.room.title,from:S.uid,fromName:S.user.name,createdAt:now});
  if(ok)toast('Convite enviado.');
  inviteModal();
}
async function cancelInvite(fid){
  await DB.del('users/'+fid+'/invites/'+S.code);
  await DB.del('rooms/'+S.code+'/invited/'+fid);
  inviteModal();
}

Object.assign(ACT,{
  logout(){if(fb)fb.auth.signOut()},
  'fr-copy'(){
    const c=S.profile&&S.profile.friendCode;if(!c)return;
    (navigator.clipboard?navigator.clipboard.writeText(c):Promise.reject()).then(()=>toast('Código copiado.')).catch(()=>toast('Seu código: '+c,6000));
  },
  'fr-accept'(b){acceptRequest(b.dataset.id)},
  'fr-decline'(b){declineRequest(b.dataset.id)},
  'fr-cancel'(b){cancelRequest(b.dataset.id)},
  async 'fr-remove'(b){
    if(await confirmBox('Remover '+b.dataset.name+' dos amigos?','Essa pessoa não poderá mais ser convidada para as suas mesas. Quem já está em uma mesa continua nela.','Remover'))removeFriend(b.dataset.id);
  },
  'inv-accept'(b){acceptInvite(b.dataset.code)},
  'inv-decline'(b){DB.del('users/'+S.uid+'/invites/'+b.dataset.code)},
  'room-open'(b){openRoom(b.dataset.code)},
  'room-del'(b){deleteRoom(b.dataset.code,b.dataset.title)},
  'room-leave'(b){leaveForever(b.dataset.code,b.dataset.title)},
  'room-invite'(){inviteModal()},
  'room-delete'(){deleteRoom(S.code,S.room?S.room.title:'Mesa')},
  'inv-send'(b){inviteFriend(b.dataset.id)},
  'inv-cancel'(b){cancelInvite(b.dataset.id)}
});
