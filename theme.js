/* ============ tema: claro, escuro, cor e brilho ============ */
const THEME_DEF={dark:false,hue:203,bright:100};
const HUES=[['Azul',203],['Menta',160],['Lilás',258],['Pêssego',22],['Rosa',340],['Manteiga',46]];
let THEME=Object.assign({},THEME_DEF,LS.get('slime:theme',null)||{});
if(!LS.get('slime:theme',null)&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)THEME.dark=true;
function themeTokens(h,dark){
  const H=x=>'hsl('+h+','+x+')';
  return dark?{
    '--bg':H('45%,9%'),'--surface':H('40%,14%'),'--wash':H('40%,19%'),'--tint':H('40%,12%'),'--pastel':H('38%,22%'),'--line':H('35%,28%'),
    '--candy':H('75%,68%'),'--candy-hi':H('80%,76%'),'--candy-lo':H('70%,55%'),'--ink':H('70%,94%'),'--ink-2':H('30%,72%'),'--link':H('85%,76%'),
    '--sel':H('45%,30%'),'--on-candy':H('70%,14%'),'--glow-a':H('50%,16%'),'--glow-b':H('45%,12%'),
    '--stage-a':H('35%,24%'),'--stage-b':H('38%,17%'),'--stage-c':H('40%,12%'),'--bad':'#FF8CA3'
  }:{
    '--bg':H('100%,96.5%'),'--surface':'#FFFFFF','--wash':H('85%,92%'),'--tint':H('100%,97.5%'),'--pastel':H('80%,90%'),'--line':H('70%,89%'),
    '--candy':H('85%,77%'),'--candy-hi':H('90%,86%'),'--candy-lo':H('80%,62%'),'--ink':H('63%,19%'),'--ink-2':H('32%,43%'),'--link':H('75%,35%'),
    '--sel':H('90%,86%'),'--on-candy':H('63%,19%'),'--glow-a':H('95%,91%'),'--glow-b':H('100%,94.5%'),
    '--stage-a':'#FFFFFF','--stage-b':H('100%,95%'),'--stage-c':H('85%,89%')
  };
}
function applyTheme(save){
  const r=document.documentElement,d=THEME.dark;
  const t=themeTokens(THEME.hue,d),keys=Object.keys(themeTokens(203,true));
  if(!d&&THEME.hue===203)keys.forEach(k=>r.style.removeProperty(k));
  else keys.forEach(k=>{if(t[k])r.style.setProperty(k,t[k]);else r.style.removeProperty(k)});
  r.style.colorScheme=d?'dark':'light';
  const dim=$('#dim'),b=clamp(num(THEME.bright,100),60,120);
  if(dim){dim.style.background=b>100?'#fff':'#000';dim.style.opacity=String(b>100?(b-100)/100:(100-b)/100)}
  $$('.tsw').forEach(s=>s.setAttribute('aria-checked',String(d)));
  if(save)LS.set('slime:theme',THEME);
}
function switchHTML(){
  return '<button type="button" class="tsw" role="switch" aria-checked="'+THEME.dark+'" aria-label="Modo escuro" data-act="theme-toggle">'
   +'<svg class="day" viewBox="0 0 76 38" preserveAspectRatio="none" aria-hidden="true"><rect width="76" height="38" fill="#86CDF7"/><rect y="16" width="76" height="22" fill="#B7E3FB"/>'
   +'<ellipse cx="52" cy="11" rx="9" ry="4" fill="#fff"/><ellipse cx="59" cy="13" rx="8" ry="3.6" fill="#fff"/><ellipse cx="60" cy="25" rx="6" ry="2.6" fill="#fff" opacity=".8"/>'
   +'<path d="M0 38V29Q16 21 32 28T76 26V38Z" fill="#7ED8B0"/><path d="M0 38V33Q20 28 40 33T76 32V38Z" fill="#5CC698"/></svg>'
   +'<svg class="night" viewBox="0 0 76 38" preserveAspectRatio="none" aria-hidden="true"><rect width="76" height="38" fill="#14224F"/><rect y="18" width="76" height="20" fill="#223468"/>'
   +'<circle cx="12" cy="9" r="1.1" fill="#fff"/><circle cx="22" cy="19" r=".9" fill="#fff"/><circle cx="30" cy="7" r="1.3" fill="#fff"/><circle cx="41" cy="15" r=".8" fill="#fff"/><circle cx="19" cy="28" r=".7" fill="#fff"/><circle cx="46" cy="6" r=".9" fill="#fff"/>'
   +'<path d="M0 38V30Q14 24 30 30T76 28V38Z" fill="#101B42"/><path d="M0 38V34Q22 30 44 34T76 33V38Z" fill="#0B1334"/></svg>'
   +'<span class="tsw-knob"><svg class="sun" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="10" fill="#FFD65C" stroke="#F4B93A" stroke-width="1.6"/><g stroke="#F4B93A" stroke-width="1.6" stroke-linecap="round"><path d="M15 1.5v2.6M15 25.9v2.6M1.5 15h2.6M25.9 15h2.6M5.4 5.4l1.8 1.8M22.8 22.8l1.8 1.8M24.6 5.4l-1.8 1.8M7.2 22.8l-1.8 1.8"/></g></svg>'
   +'<svg class="moon" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="14" fill="#EEF0FB"/><circle cx="10" cy="11" r="3.2" fill="#CDD2EA"/><circle cx="19.5" cy="19" r="4" fill="#CDD2EA"/><circle cx="20" cy="8.5" r="1.8" fill="#CDD2EA"/></svg></span></button>';
}
function mountThemeCtl(){
  $$('.topbar').forEach(bar=>{
    if(bar.querySelector('.theme-ctl'))return;
    const d=document.createElement('div');d.className='theme-ctl';
    d.innerHTML=switchHTML()+'<button type="button" class="btn small ghost" data-act="theme-open">Personalizar</button>';
    bar.appendChild(d);
  });
  applyTheme(false);
}
function themeModal(){
  const sw=HUES.map(h=>'<button type="button" class="sw'+(THEME.hue===h[1]?' on':'')+'" style="--c:hsl('+h[1]+',85%,77%)" data-act="theme-hue" data-h="'+h[1]+'" aria-label="Cor '+h[0]+'" aria-pressed="'+(THEME.hue===h[1])+'"></button>').join('');
  modal('<h2>Personalizar tema</h2>'
   +'<div class="set-row"><span><strong>Modo escuro</strong><br><span class="muted">Fundo escuro para jogar à noite.</span></span>'+switchHTML()+'</div>'
   +'<div class="field"><label>Cor do tema</label><div class="theme-pal" role="group" aria-label="Cores prontas">'+sw+'</div></div>'
   +'<div class="field"><label for="hue-r">Ajuste fino da cor</label><input id="hue-r" class="hue" type="range" min="0" max="360" value="'+THEME.hue+'"></div>'
   +'<div class="field"><label for="bri-r">Brilho: <span id="bri-v">'+THEME.bright+'%</span></label><input id="bri-r" class="bri" type="range" min="60" max="120" value="'+THEME.bright+'"></div>'
   +'<div class="modal-act"><button type="button" class="btn ghost" data-act="theme-reset">Restaurar padrão</button><button type="button" class="btn" data-close>Pronto</button></div>',
   {onMount(box){
     $('#hue-r',box).addEventListener('input',e=>{THEME.hue=+e.target.value;applyTheme(true);$$('.theme-pal .sw',box).forEach(b=>{const on=+b.dataset.h===THEME.hue;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on))})});
     $('#bri-r',box).addEventListener('input',e=>{THEME.bright=+e.target.value;$('#bri-v',box).textContent=THEME.bright+'%';applyTheme(true)});
   }});
}
Object.assign(ACT,{
  'theme-toggle'(){THEME.dark=!THEME.dark;applyTheme(true)},
  'theme-open'(){themeModal()},
  'theme-hue'(b){THEME.hue=+b.dataset.h;applyTheme(true);const r=$('#hue-r');if(r)r.value=THEME.hue;$$('.theme-pal .sw').forEach(x=>{const on=+x.dataset.h===THEME.hue;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on))})},
  'theme-reset'(){THEME=Object.assign({},THEME_DEF);applyTheme(true);closeModal();themeModal()}
});
mountThemeCtl();
