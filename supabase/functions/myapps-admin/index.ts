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
   const role=ok(await car.from('invitation_admins').select('user_id').eq('user_id',actor.id).maybeSingle());
   if(!role)return reply({error:'Acces rezervat administratorului MyCar.'},403);
   if(['approve','reject'].includes(action))return reply(await proxy('mycar-invitations',{action,id:body.id}));
  }
  if(action!=='overview')return reply({error:'Această funcție nu este încă activată pentru aplicația selectată.'},409);
  if(app==='mycar'){
   const old=await proxy('mycar-invitations',{action:'list'});
   const accounts=old.accounts.map(a=>({...a,status:a.active?'active':'pending',protected:a.email?.toLowerCase()===OWNER}));
   const invitations=old.requests.filter(r=>r.status==='approved').map(r=>({id:r.id,email:r.email,status:accounts.find(a=>a.id===r.invited_user_id)?.active?'accepted':'pending',sent_at:r.updated_at,created_at:r.created_at,send_count:1}));
   return reply({accounts,invitations,requests:old.requests,capabilities:{invite:false,resend:false,revoke:false,review:true},notice:'Poți aproba sau respinge cererile de acces. Invitațiile directe și retragerea accesului nu sunt încă activate.'});
  }
  const users=[];
  for(let page=1;page<=10;page++){
   const result=ok(await db.auth.admin.listUsers({page,perPage:1000}));users.push(...result.users);
   if(result.users.length<1000)break;
   if(page===10)throw Error('Lista conturilor este prea mare pentru această pagină.');
  }
  const accounts=users.map(u=>({id:u.id,email:u.email,active:!!u.email_confirmed_at&&!!u.last_sign_in_at,status:u.email_confirmed_at&&u.last_sign_in_at?'active':'pending',last_seen_at:u.last_sign_in_at,protected:u.email?.toLowerCase()===OWNER}));
  return reply({accounts,invitations:[],requests:[],capabilities:{invite:false,resend:false,revoke:false,review:false},notice:'Vizualizare conturi MyPet. Invitațiile și retragerea accesului nu sunt încă activate.'});
 }catch(error){console.error('MyAppsAdmin operation failed');return reply({error:error.message||'Operația nu a reușit. Reîncearcă.'},400)}
}
Deno.serve(handler);
