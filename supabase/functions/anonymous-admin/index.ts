import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
const MAIN='https://radskybbymadavveatzn.supabase.co';
const MAIN_KEY='sb_publishable_VJh0qSiBA0OIcG7YqnLyjA_-YwiTlMT';
const OWNER='anzo.safe@gmail.com';
const ORIGINS=new Set(['https://myappsadmin-anzo.zota-andrei.chatgpt.site','https://anzosafe-oss.github.io']);
const ok=r=>{if(r.error)throw Error(r.error.message);return r.data};
const validEmail=s=>typeof s==='string'&&s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
// Removing an address from the admin list never deletes Auth users or application records.
function canRemoveAddress(data,email,app){
 if(!email||email==='anzo.safe@gmail.com')return false;
 const accounts=(data.accounts||[]).filter(a=>a.email===email);
 const invitations=(data.invitations||[]).filter(i=>i.email===email);
 if(app==='mylist')return accounts.length===0&&invitations.length>0&&invitations.every(i=>['cancelled','revoked'].includes(i.status));
 return accounts.length>0&&accounts.every(a=>a.status==='revoked'&&!a.protected)&&!invitations.some(i=>['pending','accepted','active'].includes(i.status));
}
async function visibleOverview(db,app,data){
 const result=await db.from('myapps_admin_hidden').select('email').eq('app',app);
 if(result.error)throw Error(result.error.message);
 const hidden=new Set((result.data||[]).map(r=>r.email).filter(email=>canRemoveAddress(data,email,app)));
 const removedIds=new Set((data.accounts||[]).filter(a=>hidden.has(a.email)).map(a=>a.user_id||a.id));
 return {...data,accounts:(data.accounts||[]).filter(a=>!hidden.has(a.email)).map(a=>({...a,can_remove:canRemoveAddress(data,a.email,app)})),invitations:(data.invitations||[]).filter(i=>!hidden.has(i.email)).map(i=>({...i,can_remove:canRemoveAddress(data,i.email,app)})),profiles:(data.profiles||[]).filter(p=>!removedIds.has(p.user_id)),requests:(data.requests||[]).filter(r=>!hidden.has(r.email)||['pending','sending'].includes(r.status))};
}
async function removeAddress(db,app,data,rawEmail){
 const email=String(rawEmail||'').trim().toLowerCase();
 if(!canRemoveAddress(data,email,app))return false;
 const result=await db.from('myapps_admin_hidden').upsert({app,email},{onConflict:'app,email'});
 if(result.error)throw Error(result.error.message);return true;
}
async function restoreAddress(db,app,email){
 const result=await db.from('myapps_admin_hidden').delete().eq('app',app).eq('email',email);
 if(result.error)throw Error(result.error.message);
}

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
  if(app!=='anonymous'||!url.includes('caajrctjlxehhofuwhag'))return reply({error:'Aplicație invalidă.'},400);
  const agenda=db.schema('anonymous');
  if(action==='remove'){const accounts=ok(await agenda.rpc('admin_overview'));return await removeAddress(db,app,{accounts},body.id)?reply({ok:true}):reply({error:'Doar adresele cu acces retras pot fi eliminate.'},409);}
  const APP='https://anzosafe-oss.github.io/anonymous/';
  async function sendInvite(rawEmail){
   const email=String(rawEmail||'').trim().toLowerCase();
   if(!validEmail(email))throw Error('Adresa de e-mail nu este validă.');
   const reservation=ok(await agenda.rpc('reserve_access_invite',{recipient:email}));
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
    ok(await agenda.rpc('finish_access_invite',{recipient:email,delivery:reservation.delivery_key,recipient_id:recipientId,delivered}));
   }
   await restoreAddress(db,app,email);return {ok:true};
  }
  if(action==='overview'){
   const access=ok(await agenda.rpc('admin_overview'));
   return reply(await visibleOverview(db,app,{profiles:access.filter(a=>a.user_id).map(a=>({user_id:a.user_id,alias:a.alias})),accounts:access.map(a=>({id:a.user_id,email:a.email,status:a.status,active:a.status==='active',last_seen_at:a.last_seen_at,protected:a.email===OWNER})),invitations:access.filter(a=>a.send_count>0||a.status==='failed').map(a=>({...a,id:a.email,status:a.status==='active'?'accepted':a.status})),requests:[],capabilities:{invite:true,resend:true,revoke:true,review:false},notice:'Invitațiile și retragerea accesului se aplică doar Anonimous. Programările sunt păstrate. Invitații primesc acces doar la agenda proprie.'}));
  }
  if(action==='invite'||action==='resend'){
   const email=String(action==='resend'?body.id:body.email||'').trim().toLowerCase();
   if(action==='resend'){
    const entry=ok(await agenda.from('app_access').select('status').eq('email',email).maybeSingle());
    if(!entry||!['pending','failed'].includes(entry.status))return reply({error:'Invitația nu mai poate fi retrimisă.'},409);
   }
   return reply(await sendInvite(email));
  }
  if(action==='revoke'||action==='cancel'){
   const email=String(body.id||'').trim().toLowerCase();
   if(!validEmail(email))return reply({error:'Adresă de e-mail invalidă.'},400);
   if(action==='cancel'){
    const entry=ok(await agenda.from('app_access').select('status').eq('email',email).maybeSingle());
    if(!entry||entry.status!=='pending')return reply({error:'Invitația nu mai este în așteptare.'},409);
   }
   ok(await agenda.rpc('revoke_access',{recipient:email}));return reply({ok:true});
  }
  return reply({error:'Acțiune invalidă.'},400);
 }catch(error){console.error('MyAppsAdmin operation failed');return reply({error:error.message||'Operația nu a reușit. Reîncearcă.'},400)}
}
Deno.serve(handler);
