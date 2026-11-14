import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
const MAIN='https://radskybbymadavveatzn.supabase.co';
const MAIN_KEY='sb_publishable_VJh0qSiBA0OIcG7YqnLyjA_-YwiTlMT';
const OWNER='anzo.safe@gmail.com';
const ORIGINS=new Set(['https://myappsadmin-anzo.zota-andrei.chatgpt.site','https://anzosafe-oss.github.io']);
const ok=r=>{if(r.error)throw Error(r.error.message);return r.data};
const validEmail=s=>typeof s==='string'&&s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export async function handler(req){
 const origin=req.headers.get('origin')||'';
 const headers={'Access-Control-Allow-Origin':ORIGINS.has(origin)?origin:'https://myappsadmin-anzo.zota-andrei.chatgpt.site','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(origin&&!ORIGINS.has(origin))return reply({error:'Origine nepermisă.'},403);
 if(req.method!=='POST')return reply({error:'Metodă nepermisă.'},405);
 const token=req.headers.get('authorization')?.replace(/^Bearer /i,'');
 if(!token)return reply({error:'Autentificare necesară.'},401);
 const url=Deno.env.get('SUPABASE_URL');
 const db=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
 const caller=createClient(MAIN,MAIN_KEY,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const auth=await caller.auth.getUser(token);
  if(auth.error||!auth.data.user)return reply({error:'Sesiune expirată. Conectează-te din nou.'},401);
  const actor=auth.data.user;
  if(actor.email?.toLowerCase()!==OWNER||!actor.email_confirmed_at)return reply({error:'Acces rezervat administratorului.'},403);
  // Verify the existing server-controlled global administrator role, not user metadata.
  const overview=await caller.rpc('mylist_admin_overview');
  if(overview.error)return reply({error:'Acces rezervat administratorului.'},403);
  const raw=await req.text();if(raw.length>4096)return reply({error:'Cerere prea mare.'},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'Cerere invalidă.'},400)}
  if(!body||typeof body!=='object')return reply({error:'Cerere invalidă.'},400);
  const {app,action}=body;
  const petProject=url.includes('caajrctjlxehhofuwhag');
  if(!(petProject?app==='mypet':['mylist','mycar'].includes(app)))return reply({error:'Aplicație invalidă.'},400);
  async function proxy(name,payload){
   const response=await fetch(MAIN+'/functions/v1/'+name,{method:'POST',headers:{'Content-Type':'application/json',apikey:MAIN_KEY,Authorization:'Bearer '+token,Origin:'https://anzosafe-oss.github.io'},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});
   const data=await response.json();if(!response.ok||data.error)throw Error(data.error||'Operația nu a reușit.');return data;
  }
  if(app==='mylist'){
   if(action==='overview')return reply({...overview.data,capabilities:{invite:true,resend:true,revoke:true,review:false}});
   if(action==='invite')return reply(await proxy('mylist-invite',{email:body.email,kind:'administrator'}));
   if(action==='resend'){
    const i=overview.data.invitations.find(i=>i.id===body.id&&['pending','failed'].includes(i.status));
    if(!i)return reply({error:'Invitația nu mai poate fi retrimisă.'},409);
    return reply(await proxy('mylist-invite',{email:i.email,kind:i.kind}));
   }
   if(action==='cancel'||action==='revoke'){
    const entry=action==='cancel'?overview.data.invitations.find(i=>i.id===body.id&&i.status==='pending'):overview.data.accounts.find(a=>a.user_id===body.id);
    if(!entry)return reply({error:'Contul sau invitația nu mai există.'},404);
    ok(await caller.rpc('mylist_action',{op:action==='cancel'?'cancel_invite':'remove_account',p:{email:entry.email}}));return reply({ok:true});
   }
   return reply({error:'Acțiune invalidă.'},400);
  }
  const car=db.schema('mycar');
  if(app==='mycar'){
   const admins=ok(await car.from('invitation_admins').select('user_id'));
   if(!admins.some(a=>a.user_id===actor.id))return reply({error:'Acces rezervat administratorului MyCar.'},403);
   const APP='https://anzosafe-oss.github.io/mycar/';
   async function sendCarInvite(rawEmail){
    const email=String(rawEmail||'').trim().toLowerCase();
    if(!validEmail(email))throw Error('Adresa de e-mail nu este validă.');
    const reservation=ok(await car.rpc('reserve_access_invite',{recipient:email}));
    let delivered=false,recipientId=reservation.user_id||null;
    try{
     if(recipientId){
      const existingUser=ok(await db.auth.admin.getUserById(recipientId)).user;
      const redirect=existingUser?.email_confirmed_at?APP:APP+'?type=invite';
      const client=createClient(MAIN,MAIN_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      ok(await client.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:redirect}}));
     }else{
      const invite=ok(await db.auth.admin.inviteUserByEmail(email,{redirectTo:APP}));
      recipientId=invite.user?.id||null;
      if(!recipientId)throw Error('Destinatarul nu a putut fi verificat.');
     }
     delivered=true;
    }finally{
     ok(await car.rpc('finish_access_invite',{recipient:email,delivery:reservation.delivery_key,recipient_id:recipientId,delivered}));
    }
    return {email,user_id:recipientId};
   }
   if(action==='overview'){
    const access=ok(await car.from('app_access').select('email,user_id,status,created_at,updated_at,sent_at,send_count,error').order('created_at',{ascending:false}).limit(1000));
    const activity=ok(await car.from('account_activity').select('user_id,last_seen_at').limit(1000));
    const requests=ok(await car.from('invitation_requests').select('id,email,status,created_at,updated_at,invite_error,invited_user_id').order('created_at',{ascending:false}).limit(1000));
    const accounts=access.map(a=>({id:a.user_id,email:a.email,status:a.status,active:a.status==='active',last_seen_at:activity.find(v=>v.user_id===a.user_id)?.last_seen_at||null,protected:a.email===OWNER||admins.some(v=>v.user_id===a.user_id)}));
    const invitations=access.filter(a=>a.send_count>0||a.status==='failed').map(a=>({...a,id:a.email,status:a.status==='active'?'accepted':a.status}));
    return reply({accounts,invitations,requests,capabilities:{invite:true,resend:true,revoke:true,review:true},notice:'Invitațiile și retragerea accesului se aplică doar MyCar. Datele conturilor sunt păstrate. Conturile existente în celelalte aplicații pot folosi parola lor.'});
   }
   if(action==='invite'||action==='resend'){
    const email=String(action==='resend'?body.id:body.email||'').trim().toLowerCase();
    if(action==='resend'){
     const entry=ok(await car.from('app_access').select('status').eq('email',email).maybeSingle());
     if(!entry||!['pending','failed'].includes(entry.status))return reply({error:'Invitația nu mai poate fi retrimisă.'},409);
    }
    await sendCarInvite(email);return reply({ok:true,message:'Invitație trimisă pe e-mail.'});
   }
   if(action==='revoke'||action==='cancel'){
    const email=String(body.id||'').trim().toLowerCase();
    if(!validEmail(email))return reply({error:'Adresă de e-mail invalidă.'},400);
    if(action==='cancel'){
     const entry=ok(await car.from('app_access').select('status').eq('email',email).maybeSingle());
     if(!entry||entry.status!=='pending')return reply({error:'Invitația nu mai este în așteptare.'},409);
    }
    ok(await car.rpc('revoke_access',{recipient:email}));return reply({ok:true});
   }
   if(action==='approve'||action==='reject'){
    if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/i.test(body.id))return reply({error:'Cerere invalidă.'},400);
    const request=ok(await car.from('invitation_requests').select('id,email,status').eq('id',body.id).maybeSingle());
    if(!request||request.status!=='pending')return reply({error:'Cererea a fost deja procesată.'},409);
    if(action==='reject'){
     const row=ok(await car.from('invitation_requests').update({status:'rejected',reviewed_by:actor.id,updated_at:new Date().toISOString(),invite_error:null}).eq('id',body.id).eq('status','pending').select('id').maybeSingle());
     return row?reply({ok:true}):reply({error:'Cererea a fost deja procesată.'},409);
    }
    const claim=ok(await car.from('invitation_requests').update({status:'sending',reviewed_by:actor.id,updated_at:new Date().toISOString()}).eq('id',body.id).eq('status','pending').select('id').maybeSingle());
    if(!claim)return reply({error:'Cererea a fost deja procesată.'},409);
    try{
     const result=await sendCarInvite(request.email);
     ok(await car.from('invitation_requests').update({status:'approved',invited_user_id:result.user_id,invite_error:null,updated_at:new Date().toISOString()}).eq('id',body.id).eq('status','sending'));
     return reply({ok:true});
    }catch(error){
     ok(await car.from('invitation_requests').update({status:'pending',invite_error:error.message||'Invitația nu a fost trimisă.',updated_at:new Date().toISOString()}).eq('id',body.id).eq('status','sending'));throw error;
    }
   }
   return reply({error:'Acțiune invalidă.'},400);
  }
  const pet=db;
  const APP='https://anzosafe-oss.github.io/mypet/';
  async function sendPetInvite(rawEmail){
   const email=String(rawEmail||'').trim().toLowerCase();
   if(!validEmail(email))throw Error('Adresa de e-mail nu este validă.');
   const reservation=ok(await pet.rpc('mypet_reserve_access_invite',{recipient:email}));
   let delivered=false,recipientId=reservation.user_id||null;
   try{
    if(recipientId){
     const existing=ok(await db.auth.admin.getUserById(recipientId)).user;
     const client=createClient(url,'sb_publishable_9MJ6QZaJ13nfuwYJyLZSmA_WAh0Rret',{auth:{persistSession:false,autoRefreshToken:false}});
     ok(await client.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:existing?.email_confirmed_at?APP:APP+'?type=invite'}}));
    }else{
     const invite=ok(await db.auth.admin.inviteUserByEmail(email,{redirectTo:APP+'?type=invite'}));
     recipientId=invite.user?.id||null;
     if(!recipientId)throw Error('Destinatarul nu a putut fi verificat.');
    }
    delivered=true;
   }finally{
    ok(await pet.rpc('mypet_finish_access_invite',{recipient:email,delivery:reservation.delivery_key,recipient_id:recipientId,delivered}));
   }
   return {ok:true};
  }
  if(action==='overview'){
   const access=ok(await pet.from('mypet_app_access').select('email,user_id,status,created_at,updated_at,sent_at,send_count,error,last_seen_at').order('created_at',{ascending:false}).limit(1000));
   return reply({accounts:access.map(a=>({id:a.user_id,email:a.email,status:a.status,active:a.status==='active',last_seen_at:a.last_seen_at,protected:a.email===OWNER})),invitations:access.filter(a=>a.send_count>0||a.status==='failed').map(a=>({...a,id:a.email,status:a.status==='active'?'accepted':a.status})),requests:[],capabilities:{invite:true,resend:true,revoke:true,review:false},notice:'Invitațiile și retragerea accesului se aplică doar MyPet. Carnetele și istoricul sunt păstrate. MyPet folosește un cont separat de MyCar și MyList.'});
  }
  if(action==='invite'||action==='resend'){
   const email=String(action==='resend'?body.id:body.email||'').trim().toLowerCase();
   if(action==='resend'){
    const entry=ok(await pet.from('mypet_app_access').select('status').eq('email',email).maybeSingle());
    if(!entry||!['pending','failed'].includes(entry.status))return reply({error:'Invitația nu mai poate fi retrimisă.'},409);
   }
   return reply(await sendPetInvite(email));
  }
  if(action==='revoke'||action==='cancel'){
   const email=String(body.id||'').trim().toLowerCase();
   if(!validEmail(email))return reply({error:'Adresă de e-mail invalidă.'},400);
   if(action==='cancel'){
    const entry=ok(await pet.from('mypet_app_access').select('status').eq('email',email).maybeSingle());
    if(!entry||entry.status!=='pending')return reply({error:'Invitația nu mai este în așteptare.'},409);
   }
   ok(await pet.rpc('mypet_revoke_access',{recipient:email}));return reply({ok:true});
  }
  return reply({error:'Acțiune invalidă.'},400);
 }catch(error){console.error('MyAppsAdmin operation failed');return reply({error:error.message||'Operația nu a reușit. Reîncearcă.'},400)}
}
Deno.serve(handler);
