/* ============ chamada de voz e vídeo (WebRTC) + trilhas do mestre ============ */
/* Conexão direta entre as pessoas (malha). O Firestore só serve para combinar a conexão. */
const CALL={on:false,joinedAt:0,parts:{},mods:{},pcs:{},tiles:{},early:{},voice:null,micStream:null,camStream:null,videoTrack:null,
  micOn:true,camOn:false,whisper:new Set(),subs:[],hb:0,chain:Promise.resolve()};
const AUD={items:[],loaded:false,cur:null,playing:false,ctx:null,el:null,gain:null,dest:null,track:null,vol:.8,loop:false,url:null};
const ICE=()=>({iceServers:window.SLIME_ICE_SERVERS||[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}]});
const callCol=n=>fb.db.collection('rooms/'+S.code+'/'+n);
const callOK=()=>!S.demo&&!!fb&&!!window.RTCPeerConnection&&!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
const isActive=p=>!!p&&Date.now()-num(p.ts)<75000;
const isMasterId=id=>!!(S.room&&S.room.master===id);
const forcedMuted=()=>!!(CALL.mods[S.uid]&&CALL.mods[S.uid].muted);
const effectiveMic=()=>!!CALL.voice&&CALL.micOn&&!forcedMuted();
const callErr=e=>{console.warn('chamada',e);if(!callErr.w){callErr.w=1;toast('Chamada indisponível: publique as regras novas do Firestore.',6000)}};
const myName=()=>memberName(S.uid)!=='Jogador'?memberName(S.uid):(S.name||'Jogador');

function updateMyCall(patch){
  if(!CALL.on||!fb)return;
  callCol('call').doc(S.uid).set(Object.assign({ts:Date.now()},patch),{merge:true}).catch(callErr);
}

/* ---------- entrar e sair ---------- */
async function joinCall(){
  if(CALL.on)return;
  if(!callOK()){toast(S.demo?'A chamada precisa do Firebase configurado.':'Este navegador não suporta chamada.',4500);return}
  if(!window.isSecureContext){toast('A chamada só funciona em endereço seguro (https).',5000);return}
  CALL.voice=null;
  try{
    CALL.micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    CALL.voice=CALL.micStream.getAudioTracks()[0];
  }catch(e){toast('Sem acesso ao microfone. Você entra só ouvindo.',4500)}
  CALL.on=true;CALL.joinedAt=Date.now();CALL.micOn=true;CALL.camOn=false;CALL.parts={};CALL.mods={};CALL.early={};
  if(S.role==='master')ensureAudio();
  if(CALL.voice)CALL.voice.enabled=effectiveMic();
  try{
    await callCol('call').doc(S.uid).set({name:myName(),role:S.role,cam:false,mic:effectiveMic(),joinedAt:CALL.joinedAt,ts:Date.now(),music:''});
  }catch(e){callErr(e);CALL.on=false;stopLocal();renderCall();return}
  CALL.subs=[
    callCol('call').onSnapshot(s=>{CALL.parts={};s.docs.forEach(d=>CALL.parts[d.id]=d.data());syncPeers();renderCall()},callErr),
    callCol('callmod').onSnapshot(s=>{CALL.mods={};s.docs.forEach(d=>CALL.mods[d.id]=d.data());applyMic();applyRemoteMute();renderCall()},callErr),
    callCol('signals').where('to','==',S.uid).onSnapshot(s=>{
      const add=s.docChanges().filter(c=>c.type==='added').map(c=>c.doc).sort((a,b)=>num(a.data().ts)-num(b.data().ts));
      add.forEach(d=>{CALL.chain=CALL.chain.then(()=>onSignal(d)).catch(e=>console.warn('sinal',e))});
    },callErr)
  ];
  CALL.hb=setInterval(()=>{updateMyCall({});syncPeers();renderCall()},20000);
  if(AUD.playing)onAudState();
  renderCall();
}
function stopLocal(){
  if(CALL.micStream)CALL.micStream.getTracks().forEach(t=>t.stop());
  if(CALL.camStream)CALL.camStream.getTracks().forEach(t=>t.stop());
  CALL.micStream=CALL.camStream=CALL.voice=CALL.videoTrack=null;
}
function leaveCall(){
  if(!CALL.on){closeAudio();return}
  CALL.on=false;clearInterval(CALL.hb);
  CALL.subs.forEach(u=>{try{u()}catch(e){}});CALL.subs=[];
  Object.keys(CALL.pcs).forEach(closePeer);
  stopLocal();closeAudio();
  CALL.whisper.clear();CALL.camOn=false;
  if(fb&&S.code)callCol('call').doc(S.uid).delete().catch(()=>{});
  renderCall();
}
window.addEventListener('pagehide',()=>{if(CALL.on&&fb&&S.code)callCol('call').doc(S.uid).delete().catch(()=>{})});

/* ---------- conexões entre pessoas ---------- */
function shouldOffer(id,p){
  if(S.role==='master')return true;
  if(isMasterId(id))return false;
  const mine=CALL.joinedAt,theirs=num(p.joinedAt);
  return mine>theirs||(mine===theirs&&S.uid>id);
}
function syncPeers(){
  if(!CALL.on)return;
  Object.keys(CALL.parts).forEach(id=>{
    if(id===S.uid)return;
    const p=CALL.parts[id],ex=CALL.pcs[id];
    if(!isActive(p)){if(ex)closePeer(id);return}
    if(ex&&ex.joinedAt!==num(p.joinedAt))closePeer(id);
    if(!CALL.pcs[id]&&shouldOffer(id,p))startPeer(id,p);
  });
  Object.keys(CALL.pcs).forEach(id=>{if(!CALL.parts[id])closePeer(id)});
}
function sendSignal(to,type,data){
  callCol('signals').add({from:S.uid,to,type,data,ts:Date.now(),sess:CALL.joinedAt}).catch(callErr);
}
function makePeer(id,joinedAt){
  const pc=new RTCPeerConnection(ICE());
  const peer={id,pc,joinedAt:num(joinedAt),tx:null,hasRemote:false,pend:[],state:'new',retry:0,vEl:null,mEl:null,vStream:null};
  CALL.pcs[id]=peer;
  pc.onicecandidate=e=>{if(e.candidate)sendSignal(id,'ice',JSON.stringify(e.candidate))};
  pc.ontrack=e=>onRemoteTrack(peer,e);
  pc.onconnectionstatechange=()=>{
    peer.state=pc.connectionState;renderTiles();
    if(pc.connectionState==='failed'&&CALL.pcs[id]===peer&&peer.retry<3){
      const p=CALL.parts[id],r=peer.retry+1;closePeer(id);
      setTimeout(()=>{if(CALL.on&&p&&isActive(CALL.parts[id])&&!CALL.pcs[id]&&shouldOffer(id,CALL.parts[id])){startPeer(id,CALL.parts[id]);if(CALL.pcs[id])CALL.pcs[id].retry=r}},1500);
    }
  };
  return peer;
}
async function startPeer(id,p){
  const peer=makePeer(id,p.joinedAt),pc=peer.pc,master=S.role==='master';
  if(master)ensureAudio();
  peer.tx=[
    pc.addTransceiver(CALL.voice||'audio',{direction:'sendrecv'}),
    pc.addTransceiver(master&&AUD.track?AUD.track:'audio',{direction:master?'sendonly':'inactive'}),
    pc.addTransceiver(CALL.videoTrack||'video',{direction:'sendrecv'})
  ];
  applyWhisper();
  try{
    const offer=await pc.createOffer();await pc.setLocalDescription(offer);
    sendSignal(id,'offer',JSON.stringify(pc.localDescription));
  }catch(e){console.warn('offer',e)}
}
async function onSignal(doc){
  const d=doc.data();
  doc.ref.delete().catch(()=>{});
  if(!CALL.on||num(d.ts)<CALL.joinedAt-15000)return;
  const from=d.from;
  if(d.type==='offer'){
    if(CALL.pcs[from])closePeer(from);
    const peer=makePeer(from,d.sess),pc=peer.pc;
    await pc.setRemoteDescription(JSON.parse(d.data));
    const ts=pc.getTransceivers();peer.tx=ts;
    ts[0].direction='sendrecv';await ts[0].sender.replaceTrack(CALL.voice||null);
    if(ts[2]){ts[2].direction='sendrecv';await ts[2].sender.replaceTrack(CALL.videoTrack||null)}
    peer.hasRemote=true;await flushIce(peer,CALL.early[from]);delete CALL.early[from];
    const ans=await pc.createAnswer();await pc.setLocalDescription(ans);
    sendSignal(from,'answer',JSON.stringify(pc.localDescription));
  }else if(d.type==='answer'){
    const peer=CALL.pcs[from];
    if(peer&&peer.pc.signalingState==='have-local-offer'){await peer.pc.setRemoteDescription(JSON.parse(d.data));peer.hasRemote=true;await flushIce(peer)}
  }else if(d.type==='ice'){
    const peer=CALL.pcs[from],c=JSON.parse(d.data);
    if(peer&&peer.hasRemote){try{await peer.pc.addIceCandidate(c)}catch(e){}}
    else if(peer)peer.pend.push(c);
    else(CALL.early[from]=CALL.early[from]||[]).push(c);
  }
}
async function flushIce(peer,extra){
  const l=peer.pend.concat(extra||[]);peer.pend=[];
  for(const c of l){try{await peer.pc.addIceCandidate(c)}catch(e){}}
}
function audioEl(){const a=document.createElement('audio');a.autoplay=true;a.playsInline=true;$('#call-audio').appendChild(a);return a}
function onRemoteTrack(peer,e){
  const idx=peer.pc.getTransceivers().indexOf(e.transceiver),st=new MediaStream([e.track]);
  if(idx===0){peer.vEl=peer.vEl||audioEl();peer.vEl.srcObject=st;peer.vEl.muted=!!(CALL.mods[peer.id]&&CALL.mods[peer.id].muted);peer.vEl.play().catch(()=>{})}
  else if(idx===1){peer.mEl=peer.mEl||audioEl();peer.mEl.srcObject=st;peer.mEl.play().catch(()=>{})}
  else if(idx===2){peer.vStream=st;attachVideos()}
}
function closePeer(id){
  const p=CALL.pcs[id];if(!p)return;
  delete CALL.pcs[id];
  try{p.pc.ontrack=p.pc.onicecandidate=p.pc.onconnectionstatechange=null;p.pc.close()}catch(e){}
  [p.vEl,p.mEl].forEach(a=>{if(a){a.srcObject=null;a.remove()}});
  const t=CALL.tiles[id];if(t)t.v.srcObject=null;
}
function applyRemoteMute(){Object.keys(CALL.pcs).forEach(id=>{const p=CALL.pcs[id];if(p.vEl)p.vEl.muted=!!(CALL.mods[id]&&CALL.mods[id].muted)})}
function applyWhisper(){
  if(S.role!=='master')return;
  Object.keys(CALL.pcs).forEach(id=>{
    const t=CALL.pcs[id].tx&&CALL.pcs[id].tx[0];if(!t)return;
    const ok=!CALL.whisper.size||CALL.whisper.has(id);
    t.sender.replaceTrack(ok?CALL.voice:null).catch(()=>{});
  });
}

/* ---------- microfone e câmera ---------- */
function applyMic(){
  if(CALL.voice)CALL.voice.enabled=effectiveMic();
  updateMyCall({mic:effectiveMic()});
}
async function toggleMic(){
  if(!CALL.on)return;
  if(forcedMuted()){toast('O mestre silenciou seu microfone.');return}
  if(!CALL.voice){
    try{
      CALL.micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      CALL.voice=CALL.micStream.getAudioTracks()[0];CALL.micOn=true;
      Object.keys(CALL.pcs).forEach(id=>{const t=CALL.pcs[id].tx&&CALL.pcs[id].tx[0];if(t)t.sender.replaceTrack(CALL.voice).catch(()=>{})});
      applyWhisper();
    }catch(e){toast('Sem acesso ao microfone. Libere a permissão no navegador.',4500);return}
  }else CALL.micOn=!CALL.micOn;
  applyMic();renderCall();
}
async function toggleCam(){
  if(!CALL.on)return;
  if(CALL.camOn){
    CALL.camStream.getTracks().forEach(t=>t.stop());CALL.camStream=CALL.videoTrack=null;CALL.camOn=false;
  }else{
    try{
      CALL.camStream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'}});
      CALL.videoTrack=CALL.camStream.getVideoTracks()[0];CALL.camOn=true;
    }catch(e){toast('Não consegui abrir a câmera. Libere a permissão no navegador.',4500);return}
  }
  Object.keys(CALL.pcs).forEach(id=>{const t=CALL.pcs[id].tx&&CALL.pcs[id].tx[2];if(t)t.sender.replaceTrack(CALL.videoTrack||null).catch(()=>{})});
  updateMyCall({cam:CALL.camOn});renderCall();attachVideos();
}

/* ---------- trilhas sonoras do mestre ---------- */
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('slime-audio',1);r.onupgradeneeded=()=>r.result.createObjectStore('files',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function audStore(mode){const db=await idb();return db.transaction('files',mode).objectStore('files')}
const reqP=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function audLoad(){
  if(AUD.loaded)return;AUD.loaded=true;
  try{const all=await reqP((await audStore('readonly')).getAll());AUD.items=all.map(x=>({id:x.id,name:x.name,size:x.size,ts:x.ts})).sort((a,b)=>a.ts-b.ts)}
  catch(e){AUD.items=[];toast('Este navegador não deixa guardar áudios (modo privado?).',5000)}
  renderAudList();
}
function ensureAudio(){
  if(AUD.ctx)return;
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  AUD.ctx=new C();
  const el=AUD.el=document.createElement('video');el.playsInline=true;el.loop=AUD.loop;el.style.display='none';document.body.appendChild(el);
  const src=AUD.ctx.createMediaElementSource(el);
  AUD.gain=AUD.ctx.createGain();AUD.gain.gain.value=AUD.vol;
  AUD.dest=AUD.ctx.createMediaStreamDestination();
  src.connect(AUD.gain);AUD.gain.connect(AUD.dest);AUD.gain.connect(AUD.ctx.destination);
  AUD.track=AUD.dest.stream.getAudioTracks()[0];
  ['play','pause','ended'].forEach(ev=>el.addEventListener(ev,onAudState));
  el.addEventListener('error',()=>toast('Não consegui tocar esse arquivo.',4000));
}
function closeAudio(){
  if(AUD.el){try{AUD.el.pause()}catch(e){}AUD.el.remove()}
  if(AUD.ctx){try{AUD.ctx.close()}catch(e){}}
  if(AUD.url){URL.revokeObjectURL(AUD.url);AUD.url=null}
  Object.assign(AUD,{ctx:null,el:null,gain:null,dest:null,track:null,cur:null,playing:false});
  renderAudList();
}
function onAudState(){
  AUD.playing=!!AUD.el&&!AUD.el.paused&&!AUD.el.ended;
  const it=AUD.items.find(x=>x.id===AUD.cur);
  updateMyCall({music:AUD.playing&&it?it.name:''});
  renderAudList();
}
async function audToggle(id){
  ensureAudio();if(!AUD.ctx){toast('Este navegador não toca áudio assim.');return}
  try{await AUD.ctx.resume()}catch(e){}
  if(AUD.cur===id){if(AUD.el.paused)AUD.el.play().catch(()=>{});else AUD.el.pause();return}
  let rec;try{rec=await reqP((await audStore('readonly')).get(id))}catch(e){}
  if(!rec){toast('Arquivo não encontrado.');return}
  if(AUD.url)URL.revokeObjectURL(AUD.url);
  AUD.url=URL.createObjectURL(rec.blob);AUD.el.src=AUD.url;AUD.cur=id;
  AUD.el.play().catch(()=>toast('Não consegui tocar esse arquivo.',4000));
  onAudState();
  if(!CALL.on)toast('Só você ouve por enquanto. Entre na chamada para os jogadores ouvirem.',4500);
}
async function audImport(files){
  const ok=/\.(mp3|mp4|m4a|wav|ogg|oga|aac|webm|opus|flac)$/i;let n=0;
  for(const f of Array.from(files)){
    if(!(/^(audio|video)\//.test(f.type)||ok.test(f.name))){toast('"'+f.name+'" não parece um áudio.');continue}
    if(f.size>120*1024*1024){toast('"'+f.name+'" passa de 120 MB.');continue}
    const rec={id:uid(),name:f.name.replace(/\.[^.]+$/,'').slice(0,60),size:f.size,ts:Date.now()+n,type:f.type,blob:f};
    try{await reqP((await audStore('readwrite')).put(rec));AUD.items.push({id:rec.id,name:rec.name,size:rec.size,ts:rec.ts});n++}
    catch(e){toast('Não consegui guardar "'+f.name+'".',4500)}
  }
  renderAudList();if(n)toast(n+' áudio(s) importado(s).');
}
async function audDelete(id){
  const it=AUD.items.find(x=>x.id===id);if(!it)return;
  if(!(await confirmBox('Apagar esta trilha?','"'+it.name+'" sai da sua lista neste aparelho.','Apagar')))return;
  if(AUD.cur===id){try{AUD.el.pause();AUD.el.removeAttribute('src');AUD.el.load()}catch(e){}AUD.cur=null;AUD.playing=false;onAudState()}
  try{await reqP((await audStore('readwrite')).delete(id))}catch(e){}
  AUD.items=AUD.items.filter(x=>x.id!==id);renderAudList();
}
const ICON_PLAY='<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>';
const ICON_PAUSE='<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" fill="currentColor"/></svg>';
function renderAudList(){
  const el=$('#aud-list');if(!el)return;
  if(!AUD.items.length){el.innerHTML='<p class="empty">Nenhuma trilha ainda. Importe arquivos mp3 ou mp4 do seu aparelho.</p>';return}
  el.innerHTML=AUD.items.map(it=>{
    const on=AUD.cur===it.id&&AUD.playing;
    return '<div class="aud'+(AUD.cur===it.id?' cur':'')+'"><button type="button" class="btn small'+(on?'':' ghost')+'" data-act="aud-play" data-id="'+esc(it.id)+'" aria-label="'+(on?'Pausar ':'Tocar ')+esc(it.name)+'">'+(on?ICON_PAUSE+'Pausar':ICON_PLAY+'Tocar')+'</button>'
     +'<div class="aud-t"><strong>'+esc(it.name)+'</strong><span class="muted">'+(it.size/1048576).toFixed(1)+' MB'+(on?' · tocando':'')+'</span></div>'
     +'<button type="button" class="x" data-act="aud-del" data-id="'+esc(it.id)+'" aria-label="Apagar '+esc(it.name)+'">'+ICON.x+'</button></div>';
  }).join('');
}

/* ---------- tela da chamada ---------- */
function activeIds(){
  if(!CALL.on)return[];
  const ids=[S.uid];
  Object.keys(CALL.parts).forEach(id=>{if(id!==S.uid&&isActive(CALL.parts[id]))ids.push(id)});
  return ids;
}
function renderTiles(){
  const grid=$('#call-grid');if(!grid)return;
  const ids=activeIds();
  Object.keys(CALL.tiles).forEach(id=>{if(ids.indexOf(id)<0){CALL.tiles[id].el.remove();delete CALL.tiles[id]}});
  ids.forEach(id=>{
    let t=CALL.tiles[id];
    if(!t){
      const el=document.createElement('div');el.className='tile';el.dataset.uid=id;
      el.innerHTML='<video playsinline autoplay muted></video><div class="tile-ph"></div><div class="tile-bar"><span class="tile-n"></span><span class="tile-i"></span></div>';
      grid.appendChild(el);t=CALL.tiles[id]={el,v:$('video',el),ph:$('.tile-ph',el),n:$('.tile-n',el),i:$('.tile-i',el)};
    }
    const me=id===S.uid,p=CALL.parts[id]||{},nm=(me?myName():(p.name||memberName(id)));
    const cam=me?CALL.camOn:!!p.cam,mod=CALL.mods[id]&&CALL.mods[id].muted;
    const mic=me?effectiveMic():(p.mic!==false&&!mod);
    t.n.textContent=nm+(me?' (você)':'')+(isMasterId(id)?' · mestre':'');
    t.ph.textContent=String(nm).trim().charAt(0).toUpperCase()||'?';
    t.el.classList.toggle('cam',cam);t.el.classList.toggle('me',me);
    t.el.classList.toggle('whisper',CALL.whisper.has(id));
    const pr=CALL.pcs[id],conn=!me&&pr&&pr.state!=='connected';
    t.i.innerHTML=(conn?'<span class="tb c">Conectando</span>':'')+(mod?'<span class="tb">Silenciado</span>':(!mic?'<span class="tb">Mudo</span>':''))+(CALL.whisper.has(id)?'<span class="tb w">Só ele ouve</span>':'');
  });
  attachVideos();
}
function attachVideos(){
  Object.keys(CALL.tiles).forEach(id=>{
    const t=CALL.tiles[id],src=id===S.uid?CALL.camStream:(CALL.pcs[id]&&CALL.pcs[id].vStream);
    if(t.v.srcObject!==(src||null))t.v.srcObject=src||null;
    if(src)t.v.play().catch(()=>{});
  });
}
function renderCallCtl(){
  const el=$('#call-ctl');if(!el)return;
  if(!callOK()){el.innerHTML='<p class="muted">'+(S.demo?'A chamada precisa do Firebase configurado (modo demonstração não tem).':'Este navegador não suporta chamada de voz e vídeo.')+'</p>';return}
  if(!CALL.on){el.innerHTML='<button type="button" class="btn" data-act="call-join">Entrar na chamada</button>';return}
  const mic=effectiveMic();
  el.innerHTML='<div class="row"><button type="button" class="btn small'+(mic?'':' ghost')+'" data-act="call-mic" aria-pressed="'+mic+'">Microfone: '+(forcedMuted()?'silenciado pelo mestre':mic?'ligado':'desligado')+'</button>'
   +'<button type="button" class="btn small'+(CALL.camOn?'':' ghost')+'" data-act="call-cam" aria-pressed="'+CALL.camOn+'">Câmera: '+(CALL.camOn?'ligada':'desligada')+'</button>'
   +'<button type="button" class="btn small ghost bad" data-act="call-leave">Sair da chamada</button></div>';
}
function renderPeople(){
  const el=$('#ppl-list');if(!el)return;
  const pl=S.members.filter(m=>m.role==='player');
  if(!pl.length){el.innerHTML='<p class="empty">Nenhum jogador na mesa ainda.</p>';return}
  el.innerHTML=pl.map(m=>{
    const inCall=CALL.on&&isActive(CALL.parts[m.id]),mod=CALL.mods[m.id]&&CALL.mods[m.id].muted,wh=CALL.whisper.has(m.id);
    return '<div class="person"><div class="p-info">'+photoHTML('',34,m.name)+'<div><strong>'+esc(m.name)+'</strong><span class="muted">'+(inCall?'Na chamada':'Fora da chamada')+(mod?' · silenciado':'')+'</span></div></div><div class="row">'
     +'<button type="button" class="btn small'+(mod?'':' ghost')+'" data-act="pmute" data-id="'+esc(m.id)+'" aria-pressed="'+!!mod+'">'+(mod?'Liberar microfone':'Silenciar')+'</button>'
     +(inCall?'<button type="button" class="btn small'+(wh?'':' ghost')+'" data-act="whisper" data-id="'+esc(m.id)+'" aria-pressed="'+wh+'">'+(wh?'Só ele(a) te ouve':'Falar só com ele(a)')+'</button>':'')
     +'<button type="button" class="btn small ghost bad" data-act="kick" data-id="'+esc(m.id)+'">Expulsar</button></div></div>';
  }).join('');
}
function renderCall(){
  const tb=$('#tabs [data-tab=chamada]');if(tb)tb.classList.toggle('live',CALL.on);
  if(!$('#call-grid'))return;
  const master=S.role==='master';
  $('#call-gm').hidden=!master;$('#call-people').hidden=!master;
  renderCallCtl();renderTiles();
  const n=activeIds().length;
  const music=Object.keys(CALL.parts).filter(id=>isMasterId(id)&&isActive(CALL.parts[id])&&CALL.parts[id].music).map(id=>CALL.parts[id].music)[0];
  $('#call-count').textContent=CALL.on?n+' na chamada':'';
  let note='';
  if(CALL.on){
    if(forcedMuted())note='O mestre silenciou seu microfone.';
    else if(master&&CALL.whisper.size)note='Você está falando só com: '+Array.from(CALL.whisper).map(memberName).join(', ')+'.';
    if(music&&!master)note+=(note?' ':'')+'♪ Trilha tocando: '+music;
  }else note='Entre para falar com a mesa. O navegador vai pedir permissão de microfone e câmera.';
  $('#call-note').textContent=note;
  const all=$('#whisper-all');if(all)all.hidden=!(master&&CALL.whisper.size);
  if(master){audLoad();renderAudList();renderPeople()}
}
function checkKicked(l){
  if(S.role==='master'||S.demo)return;
  if(l.some(m=>m.id===S.uid)){S.seenSelf=true;return}
  if(S.seenSelf&&!S.deleting){toast('O mestre removeu você desta mesa.',6000);leaveRoom()}
}

Object.assign(ACT,{
  'call-join'(){joinCall()},
  'call-leave'(){leaveCall()},
  'call-mic'(){toggleMic()},
  'call-cam'(){toggleCam()},
  pmute(b){
    const id=b.dataset.id,cur=!!(CALL.mods[id]&&CALL.mods[id].muted);
    DB.set('rooms/'+S.code+'/callmod/'+id,{muted:!cur,by:S.uid,ts:Date.now()}).then(ok=>{if(ok)toast(memberName(id)+(cur?' pode falar de novo.':' foi silenciado(a).'))});
  },
  whisper(b){
    const id=b.dataset.id;
    if(CALL.whisper.has(id))CALL.whisper.delete(id);else CALL.whisper.add(id);
    applyWhisper();renderCall();
    toast(CALL.whisper.size?'Só quem está marcado ouve você agora.':'Todos ouvem você de novo.');
  },
  'whisper-all'(){CALL.whisper.clear();applyWhisper();renderCall();toast('Todos ouvem você de novo.')},
  async kick(b){
    const id=b.dataset.id,nm=memberName(id);
    if(!(await confirmBox('Expulsar '+nm+'?','A pessoa sai da mesa agora e só volta se você convidar de novo.','Expulsar')))return;
    const base='rooms/'+S.code+'/';
    if(!(await DB.del(base+'members/'+id)))return;
    for(const p of [base+'call/'+id,base+'callmod/'+id,base+'invited/'+id,'users/'+id+'/invites/'+S.code]){try{await store.del(p)}catch(e){}}
    CALL.whisper.delete(id);closePeer(id);toast(nm+' foi expulso(a) da mesa.',4200);
  },
  'aud-import'(){const i=$('#aud-pick');i.value='';i.click()},
  'aud-play'(b){audToggle(b.dataset.id)},
  'aud-del'(b){audDelete(b.dataset.id)}
});
$('#aud-pick').addEventListener('change',e=>{if(e.target.files.length)audImport(e.target.files)});
$('#aud-vol').addEventListener('input',e=>{AUD.vol=e.target.value/100;if(AUD.gain)AUD.gain.gain.value=AUD.vol});
$('#aud-loop').addEventListener('change',e=>{AUD.loop=e.target.checked;if(AUD.el)AUD.el.loop=AUD.loop});
