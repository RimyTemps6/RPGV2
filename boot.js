(async function boot(){
  $('#btn-create').disabled=true;
  initHome();
  await initPlatform();
  S.booted=true;
  renderNet();renderLobby();
  initHero();initTable();
  $('#btn-create').disabled=false;
})();
