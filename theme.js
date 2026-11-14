(()=>{
'use strict';
const media=matchMedia('(prefers-color-scheme:dark)');
const normalize=value=>value==='light'||value==='dark'?value:'system';
let preference='system';
try{preference=normalize(localStorage.getItem('myappsadmin-theme'));}catch{}
window.toggleTheme=()=>{
 preference=document.documentElement.dataset.theme==='dark'?'light':'dark';
 try{localStorage.setItem('myappsadmin-theme',preference);}catch{}
 window.applyTheme();
};
window.applyTheme=()=>{
 const dark=preference==='dark'||preference==='system'&&media.matches;
 document.documentElement.dataset.theme=dark?'dark':'light';
 const meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.content=dark?'#101b16':'#f5f7f3';
 const button=document.getElementById('theme');
 if(button){
  const label=dark?'Activează tema luminoasă':'Activează tema întunecată';
  button.setAttribute('aria-label',label);button.title=label;
  button.onclick=window.toggleTheme;
 }
};
window.applyTheme();
media.addEventListener('change',window.applyTheme);
document.addEventListener('DOMContentLoaded',window.applyTheme,{once:true});
window.addEventListener('storage',event=>{
 if(event.key==='myappsadmin-theme'||event.key===null){preference=normalize(event.newValue);window.applyTheme();}
});
})();
