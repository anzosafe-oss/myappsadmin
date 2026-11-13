const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../supabase/functions/myapps-admin/index.ts','utf8').replace(/^import .*\n/,'').replace('export async function handler','async function handler').replace('Deno.serve(handler);','globalThis.handler=handler;');
function env({project='main',email='anzo.safe@gmail.com',valid=true,role=true,confirmed=true}={}){
 const calls=[];const main='https://radskybbymadavveatzn.supabase.co';
 const caller={auth:{getUser:async()=>({error:valid?null:Error('invalid'),data:{user:valid?{id:'owner',email,email_confirmed_at:confirmed?'now':null}:null}})},rpc:async(name)=>{calls.push(name);return role?{data:{families:[],accounts:[],invitations:[],profiles:[]}}:{error:Error('no role')}}};
 const db={schema:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{user_id:'owner'}})})})})}),auth:{admin:{listUsers:async()=>({data:{users:[{id:'owner-pet',email:'anzo.safe@gmail.com',email_confirmed_at:'now',last_sign_in_at:'now'}]}})}}};
 const context={Response,Request,AbortSignal,console:{error:()=>{}},setTimeout,clearTimeout,Deno:{env:{get:k=>k==='SUPABASE_URL'?(project==='pet'?'https://caajrctjlxehhofuwhag.supabase.co':main):'service-test'}},createClient:(url,key)=>key==='service-test'?db:caller,fetch:async(url,options)=>{calls.push(JSON.parse(options.body));return new Response(JSON.stringify({accounts:[],requests:[]}))}};
 vm.createContext(context);vm.runInContext(source,context);return {calls,call:async(body,headers={})=>context.handler(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://myappsadmin-anzo.zota-andrei.chatgpt.site',Authorization:'Bearer example',...headers},body:JSON.stringify(body)}))};
}
test('reject invalid tokens before directory access',async()=>assert.equal((await env({valid:false}).call({app:'mypet',action:'overview'})).status,401));
test('reject a non-admin even with a valid session',async()=>{const e=env({email:'other@example.test'});assert.equal((await e.call({app:'mylist',action:'overview'})).status,403);assert.equal(e.calls.length,0)});
test('reject unconfirmed owner email',async()=>assert.equal((await env({confirmed:false}).call({app:'mylist',action:'overview'})).status,403));
test('require existing server-controlled admin role',async()=>assert.equal((await env({role:false}).call({app:'mylist',action:'overview'})).status,403));
test('reject unexpected origins',async()=>assert.equal((await env().call({app:'mylist',action:'overview'},{Origin:'https://other.example'})).status,403));
test('do not route pet requests to main project',async()=>assert.equal((await env().call({app:'mypet',action:'overview'})).status,400));
test('do not route car requests to pet project',async()=>assert.equal((await env({project:'pet'}).call({app:'mycar',action:'overview'})).status,400));
test('MyList exposes existing admin operations',async()=>{const r=await env().call({app:'mylist',action:'overview'});assert.equal(r.status,200);assert.equal((await r.json()).capabilities.revoke,true)});
test('MyCar exposes review only until new RLS is approved',async()=>{const r=await env().call({app:'mycar',action:'overview'});assert.equal(r.status,200);const d=await r.json();assert.equal(d.capabilities.invite,false);assert.equal(d.capabilities.revoke,false);assert.equal(d.capabilities.review,true)});
test('MyPet exposes read-only directory',async()=>{const r=await env({project:'pet'}).call({app:'mypet',action:'overview'});const d=await r.json();assert.equal(r.status,200);assert.equal(d.accounts[0].protected,true);assert.equal(d.capabilities.invite,false);assert.equal(d.capabilities.revoke,false)});
test('disabled MyCar mutations return a clear conflict',async()=>assert.equal((await env().call({app:'mycar',action:'revoke',id:'user@example.test'})).status,409));
test('disabled MyPet mutations cannot send mail or change accounts',async()=>{const e=env({project:'pet'});assert.equal((await e.call({app:'mypet',action:'invite',email:'user@example.test'})).status,409);assert.deepEqual(e.calls,['mylist_admin_overview'])});
