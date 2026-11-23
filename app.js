'use strict';
const MAIN='https://radskybbymadavveatzn.supabase.co',PET='https://radskybbymadavveatzn.supabase.co';
const MAIN_KEY='sb_publishable_VJh0qSiBA0OIcG7YqnLyjA_-YwiTlMT',PET_KEY='sb_publishable_VJh0qSiBA0OIcG7YqnLyjA_-YwiTlMT';
const sb=supabase.createClient(MAIN,MAIN_KEY,{auth:{storageKey:'myappsadmin-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={mylist:'MyList',mycar:'MyCar',mypet:'MyPet',anonymous:'Anonimous'};
const emptyData=()=>({families:[],accounts:[],invitations:[],profiles:[],requests:[]});
const LIVE_ENABLED=true;const MYPET_ENABLED=true;
let session=null,current='mylist',tab='families',data=emptyData(),epoch=0,loading=false,mutating=false,confirmation=null,requestController=null;
const tabsFor=app=>app==='mylist'?[['families','Familii'],['invitations','Invitații'],['accounts','Conturi active']]:app==='mycar'?[['accounts','Conturi'],['invitations','Invitații'],['requests','Cereri de acces']]:[['accounts','Conturi'],['invitations','Invitații']];
const date=s=>s?new Date(s).toLocaleDateString('ro-RO',{day:'2-digit',month:'short',year:'numeric'}):'—';
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('toast').hidden=true,5000)}
function reset(){epoch++;requestController?.abort();requestController=null;loading=false;data=emptyData();confirmation=null;$('confirmDialog').close();$('rows').replaceChildren();$('metrics').replaceChildren();$('dashboard').hidden=true;$('appContent').hidden=true;$('logout').hidden=true;$('login').hidden=false;$('loginStatus').textContent='';}
async function api(app,action,payload={},signal){
 if(app==='mypet'&&!MYPET_ENABLED)throw Error('Conectarea MyPet nu este încă activată. MyList și MyCar sunt disponibile.');
 const active=session;if(!active)throw Error('Conectează-te din nou.');
 const pet=app==='mypet',barber=app==='anonymous';
 const response=await fetch((barber?'https://caajrctjlxehhofuwhag.supabase.co':pet?PET:MAIN)+'/functions/v1/'+(barber?'anonymous-admin':'myapps-admin'),{method:'POST',headers:{apikey:barber?'sb_publishable_9MJ6QZaJ13nfuwYJyLZSmA_WAh0Rret':pet?PET_KEY:MAIN_KEY,Authorization:'Bearer '+active.access_token,'Content-Type':'application/json'},body:JSON.stringify({app,action,...payload}),signal:signal||AbortSignal.timeout(35000)});
 let result;try{result=await response.json()}catch{throw Error('Serviciul nu a răspuns. Reîncearcă.');}
 if(!response.ok||result.error)throw Error(result.error||'Operația nu a reușit.');return result;
}
async function refresh({silent=false}={}){
 if(!session||loading||mutating)return;
 const selected=current,uid=session.user.id,ticket=++epoch;
 requestController?.abort();const controller=new AbortController();requestController=controller;loading=true;
 const timeout=setTimeout(()=>controller.abort(),35000);
 if(!silent){$('loadStatus').className='load-status';$('loadStatus').textContent='Se încarcă '+names[selected]+'…';$('appContent').hidden=true;}
 $('retry').hidden=true;
 try{
  const result=await api(selected,'overview',{},controller.signal);
  if(ticket!==epoch||current!==selected||session?.user.id!==uid)return;
  data={...emptyData(),...result};$('login').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;$('accountEmail').textContent=session.user.email;
  $('appContent').hidden=false;$('loadStatus').textContent='';render();$('lastUpdated').textContent='Actualizat la '+new Date().toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'});
 }catch(error){
  if(ticket!==epoch||current!==selected||session?.user.id!==uid)return;
  data=emptyData();$('rows').replaceChildren();$('metrics').replaceChildren();$('appContent').hidden=true;
  if($('dashboard').hidden){$('loginStatus').textContent=error.name==='AbortError'?'Conexiunea durează prea mult. Reîncearcă.':error.message;}
  else{$('loadStatus').className='load-status error';$('loadStatus').textContent=error.name==='AbortError'?'Conexiunea durează prea mult. Reîncearcă.':error.message;$('retry').hidden=false;}
 }finally{clearTimeout(timeout);if(ticket===epoch){loading=false;requestController=null;}}
}
function selectApp(app){if(mutating||app===current)return;current=app;tab=tabsFor(app)[0][0];epoch++;requestController?.abort();loading=false;data=emptyData();$('intro').textContent='Conturile și accesul la '+names[app]+'.';$('search').value='';$('inviteEmail').value='';$('rows').replaceChildren();$('metrics').replaceChildren();document.querySelectorAll('[data-app]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.app===app)));refresh();}
function profile(id){return data.profiles.find(p=>p.user_id===id)}
function family(id){return data.families.find(f=>f.id===id)}
function alias(a){return profile(a?.user_id||a?.id)?.alias||a?.email||'Administrator invitat'}
function matches(...values){const q=$('search').value.trim().toLocaleLowerCase('ro');return values.some(v=>String(v||'').toLocaleLowerCase('ro').includes(q))}
function badge(status){const labels={active:'Cont activ',pending:'În așteptare',accepted:'Acceptată',revoked:'Acces retras',cancelled:'Acces retras',failed:'E-mail netrimis',approved:'Invitație trimisă',rejected:'Respinsă',sending:'Se trimite'};return `<span class="pill ${esc(status)}">${esc(labels[status]||status)}</span>`}
function actionButton(action,id,label,danger=false){return `<button type="button" data-action="${esc(action)}" data-id="${esc(id)}"${danger?' class="danger"':''}>${esc(label)}</button>`}
function render(){
 const app=names[current],list=current==='mylist';const caps=data.capabilities||{};$('inviteForm').closest('.invite-panel').hidden=!caps.invite;$('appTitle').textContent=app;$('openApp').href='https://anzosafe-oss.github.io/'+current+'/';
 $('intro').textContent=list?'Familiile, conturile și invitațiile MyList.':'Conturile și accesul la '+app+'.';
 $('inviteTitle').textContent=list?'Invită un administrator de familie':'Invită o persoană în '+app;
 $('inviteDescription').textContent=current==='anonymous'?'Invitația creează profilul frizerului și oferă acces doar la agenda sa Anonimous.':list?'Persoana invitată își creează familia și poate invita încă 3 membri.':'Invitația oferă acces doar la '+app+'. Dacă persoana are deja cont, păstrează parola existentă.';
 $('appNote').textContent=data.notice||(list?'Maximum 4 persoane în fiecare familie, cu administratorul inclus. Invitațiile în așteptare ocupă locuri.':'Retragerea accesului păstrează datele și afectează doar '+app+'. Poți oferi din nou acces printr-o invitație.');
 const pending=data.invitations.filter(i=>i.status==='pending').length;
 const active=data.accounts.filter(a=>list?a.accepted_at:a.status==='active').length;
 const families=data.families.filter(f=>data.accounts.some(a=>a.family_id===f.id)).length;
 const revoked=data.accounts.filter(a=>a.status==='revoked').length;
 const metrics=list?[[families,'Familii'],[active,'Conturi active'],[pending,'Invitații în așteptare'],[data.invitations.filter(i=>i.send_count>0).length,'Invitații trimise în total']]:[[active,'Conturi active'],[data.accounts.filter(a=>a.status==='pending').length,'În așteptarea activării'],[current==='mycar'?data.requests.filter(r=>r.status==='pending').length:data.invitations.filter(i=>i.send_count>0).length,current==='mycar'?'Cereri de acces':'Invitații trimise'],[revoked,'Acces retras']];
 $('metrics').innerHTML=metrics.map(([value,label])=>`<div class="metric"><span class="metric-number-mark" aria-hidden="true">→</span><strong>${value}</strong><span>${label}</span></div>`).join('');
 const tabs=tabsFor(current);if(!tabs.some(t=>t[0]===tab))tab=tabs[0][0];
 $('tabs').innerHTML=tabs.map(([key,label])=>`<button type="button" role="tab" data-tab="${key}" aria-selected="${key===tab}">${label}${key==='invitations'&&pending?' · '+pending:''}${key==='requests'&&data.requests.some(r=>r.status==='pending')?' · '+data.requests.filter(r=>r.status==='pending').length:''}</button>`).join('');
 $('tabs').querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;$('search').value='';render()});renderRows();
}
function renderRows(){
 let rows=[];const list=current==='mylist';
 if(tab==='families')rows=data.families.filter(f=>data.accounts.some(a=>a.family_id===f.id)).filter(f=>matches(f.owner_email,alias(data.accounts.find(a=>a.user_id===f.admin_id)))).map(f=>{
 const occupied=data.accounts.filter(a=>a.family_id===f.id),active=occupied.filter(a=>a.accepted_at).length,admin=data.accounts.find(a=>f.admin_id&&a.user_id===f.admin_id)||data.accounts.find(a=>a.email===f.owner_email);const max=f.max_members||4;
 return `<article class="row"><span class="avatar" aria-hidden="true">${esc(alias(admin).charAt(0).toLocaleUpperCase('ro'))}</span><div class="row-info"><strong>${esc(alias(admin))}</strong><small>${esc(f.owner_email)}</small><small>${active} ${active===1?'membru activ':'membri activi'} · ${occupied.length-active} în așteptare</small></div><div class="quota"><b>${occupied.length} din ${max} locuri</b><progress max="${max}" value="${occupied.length}" aria-label="Locuri ocupate"></progress><small>${Math.max(0,max-occupied.length)} ${max-occupied.length===1?'loc disponibil':'locuri disponibile'}</small></div></article>`;
 });
 if(tab==='invitations')rows=data.invitations.filter(i=>matches(i.email,family(i.family_id)?.owner_email)).map(i=>`<article class="row"><div class="row-info"><strong>${esc(i.email)}</strong><small>${list?(i.kind==='administrator'?'Administrator de familie':'Membru al familiei')+' · '+esc(family(i.family_id)?.owner_email||''):names[current]} · ${date(i.sent_at||i.created_at)}</small><small>${i.send_count||0} trimiteri${i.error?' · '+esc(i.error):''}</small></div>${badge(i.status)}<div class="row-actions">${data.capabilities?.resend&&['pending','failed'].includes(i.status)?actionButton('resend',i.id,'Retrimite'):''}${data.capabilities?.revoke&&i.status==='pending'?actionButton('cancel',i.id,'Retrage',true):''}</div></article>`);
 if(tab==='accounts')rows=data.accounts.filter(a=>(!list||a.accepted_at)&&matches(a.email,alias(a),family(a.family_id)?.owner_email)).map(a=>{
 const f=family(a.family_id),protectedAccount=list?(a.is_admin||f?.admin_id===a.user_id):a.protected;
 const role=list?(a.is_admin?'Administrator MyList':f?.admin_id===a.user_id?'Administrator de familie':'Membru'):(a.protected?'Administrator':names[current]);
 return `<article class="row"><span class="avatar" aria-hidden="true">${esc(alias(a).charAt(0).toLocaleUpperCase('ro'))}</span><div class="row-info"><strong>${esc(alias(a))}</strong>${(list&&profile(a.user_id)?.alias||current==='anonymous'&&profile(a.id)?.alias)?'<small>'+esc(a.email)+'</small>':''}<small>${role}${list?' · Familia '+esc(f?.owner_email||''):a.last_seen_at?' · Ultima conectare: '+date(a.last_seen_at):''}</small></div>${protectedAccount?'<span class="pill">Protejat</span>':badge(list?'active':a.status)}<div class="row-actions">${protectedAccount||!data.capabilities?.revoke?'':!list&&['revoked','failed'].includes(a.status)?actionButton('restore',a.email,'Invită din nou'):actionButton('revoke',list?a.user_id:a.email,'Retrage accesul',true)}</div></article>`;
 });
 if(tab==='requests')rows=data.requests.filter(r=>matches(r.email)).map(r=>`<article class="row"><div class="row-info"><strong>${esc(r.email)}</strong><small>${date(r.created_at)}${r.invite_error?' · '+esc(r.invite_error):''}</small></div>${badge(r.status)}<div class="row-actions">${r.status==='pending'?actionButton('approve',r.id,'Aprobă')+actionButton('reject',r.id,'Respinge',true):''}</div></article>`);
 const searching=$('search').value.trim();const messages={families:['Încă nu există familii','Invită primul administrator de familie folosind formularul de mai sus.'],invitations:['Nicio invitație de afișat','Invitațiile trimise vor apărea aici, împreună cu starea lor.'],accounts:['Niciun cont de afișat','Conturile aplicației selectate vor apărea aici.'],requests:['Nicio cerere de acces','Cererile primite din MyCar vor apărea aici.']};
 const [title,description]=searching?['Niciun rezultat','Încearcă o altă adresă sau un alt alias.']:messages[tab];
 $('rows').innerHTML=rows.join('')||`<div class="empty"><span class="empty-icon" aria-hidden="true">○</span><strong>${title}</strong><span>${description}</span></div>`;
 $('rows').querySelectorAll('[data-action]').forEach(b=>{b.disabled=mutating;b.onclick=()=>handleAction(b)});
}
function setMutationBusy(value){mutating=value;document.querySelectorAll('[data-app],#inviteForm button,#inviteEmail,#logout,#rows button,#confirmSubmit,#cancelConfirm').forEach(el=>el.disabled=value);}
async function mutate(task,message){
 if(mutating)return;const app=current,uid=session?.user.id;setMutationBusy(true);
 try{await task(app);if(current===app&&session?.user.id===uid){toast(message);return true;}}
 catch(error){if($('confirmDialog').open)$('confirmStatus').textContent=error.message;else toast(error.message);return false;}
 finally{setMutationBusy(false);if(session?.user.id===uid&&current===app)await refresh({silent:true});}
}
function handleAction(button){
 const {action,id}=button.dataset;
 if(action==='resend'){mutate(app=>api(app,'resend',{id}),'Invitație retrimisă pe e-mail.');return;}
 const target=tab==='requests'?data.requests.find(r=>r.id===id)?.email:current==='mylist'?(data.invitations.find(i=>i.id===id)?.email||data.accounts.find(a=>a.user_id===id)?.email):id;
 const app=names[current];
 const descriptions={cancel:['Retragi invitația?','Invitația pentru '+app+' va fi retrasă.'+(current==='mylist'?' Locul ocupat în familie va deveni disponibil.':'')],revoke:['Retragi accesul la '+app+'?','Persoana nu va mai avea acces la '+app+'. Conturile din celelalte aplicații se păstrează.'],approve:['Aprobi accesul la MyCar?','Persoana va primi invitația pe e-mail. Dacă are deja cont, păstrează parola existentă.'],reject:['Respingi cererea?','Cererea va fi marcată ca respinsă.'],restore:['Oferi din nou acces la '+app+'?','Persoana va primi o nouă invitație pe e-mail.']};
 if(!descriptions[action])return;
 confirmation={app:current,action,id,target};$('confirmTitle').textContent=descriptions[action][0];$('confirmDescription').textContent=descriptions[action][1];$('confirmTarget').textContent=target;$('confirmCheck').checked=false;$('confirmStatus').textContent='';$('confirmSubmit').textContent=({approve:'Aprobă și trimite',reject:'Respinge',restore:'Trimite invitația',cancel:'Retrage invitația',revoke:'Retrage accesul'})[action];$('confirmDialog').showModal();
}
applyTheme();
$('showPassword').onclick=()=>{const show=$('password').type==='password';$('password').type=show?'text':'password';$('showPassword').textContent=show?'Ascunde':'Arată';$('showPassword').setAttribute('aria-label',show?'Ascunde parola':'Arată parola');$('showPassword').setAttribute('aria-pressed',String(show));};
$('loginForm').onsubmit=async e=>{e.preventDefault();if(!LIVE_ENABLED)return;$('loginButton').disabled=true;$('loginStatus').textContent='Se verifică datele…';try{const r=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(r.error)throw r.error;$('password').value='';session=r.data.session;await refresh();}catch{$('loginStatus').textContent='Conectarea nu a reușit. Verifică e-mailul și parola.';}finally{$('loginButton').disabled=false;}};
$('logout').onclick=async()=>{if(mutating)return;session=null;reset();if(LIVE_ENABLED)await sb.auth.signOut({scope:'local'});};
$('inviteForm').onsubmit=async e=>{e.preventDefault();const email=$('inviteEmail').value.trim();const done=await mutate(app=>api(app,'invite',{email}),'Invitație trimisă pe e-mail.');if(done)$('inviteEmail').value='';};
$('confirmForm').onsubmit=async e=>{e.preventDefault();if(!$('confirmCheck').checked||!confirmation||confirmation.app!==current)return;const c={...confirmation};await mutate(async app=>{await api(app,c.action==='restore'?'invite':c.action,c.action==='restore'?{email:c.target}:{id:c.id});$('confirmDialog').close();},['approve','restore'].includes(c.action)?'Invitație trimisă pe e-mail.':c.action==='reject'?'Cerere respinsă.':'Acces retras din '+names[c.app]+'.');};
$('cancelConfirm').onclick=()=>$('confirmDialog').close();$('confirmDialog').addEventListener('cancel',e=>{if(mutating)e.preventDefault()});
$('search').oninput=renderRows;$('retry').onclick=()=>refresh();document.querySelectorAll('[data-app]').forEach(b=>b.onclick=()=>selectApp(b.dataset.app));
let initialized=false;
if(LIVE_ENABLED){sb.auth.onAuthStateChange((event,next)=>{const old=session?.user.id;session=next;if(!next){reset();return;}if(!initialized||old!==next.user.id){initialized=true;setTimeout(()=>refresh(),0);}});
sb.auth.getSession().then(({data:r,error})=>{if(error){$('loginStatus').textContent='La verificarea sesiunii a apărut o problemă.';return;}session=r.session;if(session&&!initialized){initialized=true;refresh();}});}
setInterval(()=>{if(session&&!document.hidden&&!$('confirmDialog').open&&!$('dashboard').hidden)refresh({silent:true});},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session&&!$('confirmDialog').open)refresh({silent:true});});

