const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../pull-refresh.js','utf8');
function setup({top=true,loading=false,mutating=false,modal=false,input=false,touches=1,zoom=1,deferred=false}={}){
 const listeners={},options={},vars={},label={textContent:''},indicator={hidden:true,dataset:{},setAttribute(){},querySelector:()=>label};
 let height=70,resize,resolveRefresh;const calls=[];
 const header={getBoundingClientRect:()=>({height})};
 const target={closest:()=>input?{}:null,scrollHeight:0,clientHeight:0,parentElement:null};
 const document={documentElement:{style:{setProperty:(k,v)=>vars[k]=v}},scrollingElement:{scrollTop:top?0:100},visibilityState:'visible',body:{append(){}},querySelector:s=>s==='header'?header:s==='dialog[open]'&&modal?{}:null,createElement:()=>indicator,getElementById:id=>({hidden:false}),addEventListener:(type,fn,opts)=>{listeners[type]=fn;options[type]=opts}};
 const window={scrollY:top?0:100,addEventListener(){},visualViewport:{scale:zoom,addEventListener(){}}};
 const c={document,window,navigator:{maxTouchPoints:touches},ResizeObserver:function(cb){resize=cb;this.observe=()=>{}},getComputedStyle:()=>({overflowY:'auto'}),session:{user:{id:'admin'}},loading,mutating,clearTimeout(){},setTimeout:()=>1,refresh:async opts=>{calls.push(opts);if(deferred)await new Promise(r=>resolveRefresh=r);}};
 vm.createContext(c);vm.runInContext(source,c);
 const event=(x=0,y=0,n=1)=>({target,touches:Array.from({length:n},()=>({clientX:x,clientY:y})),cancelable:true,preventDefault(){this.prevented=true;}});
 return {listeners,options,vars,indicator,label,c,calls,target,event,start:()=>listeners.touchstart(event(0,0)),move:(x,y)=>{const e=event(x,y);listeners.touchmove(e);return e;},end:()=>listeners.touchend(event(0,0,0)),resize:next=>{height=next;resize();},resolve:()=>resolveRefresh()};
}
test('downward pull refreshes dashboard data silently, without page navigation',async()=>{const s=setup();s.start();assert.equal(s.move(0,100).prevented,true);await s.end();assert.equal(s.calls.length,1);assert.equal(s.calls[0].silent,true);assert.equal(s.label.textContent,'Date actualizate');assert.equal(s.options.touchmove.passive,false)});
test('short pulls stop native overscroll but do not refresh',async()=>{const s=setup();s.start();assert.equal(s.move(0,45).prevented,true);await s.end();assert.equal(s.calls.length,0);assert.equal(s.indicator.hidden,true)});
test('a gesture starting below the top remains normal page scrolling',async()=>{const s=setup({top:false});s.start();assert.notEqual(s.move(0,110).prevented,true);await s.end();assert.equal(s.calls.length,0)});
test('horizontal swipes are not intercepted',async()=>{const s=setup();s.start();assert.notEqual(s.move(80,15).prevented,true);await s.end();assert.equal(s.calls.length,0)});
test('form controls, dialogs and in-flight writes are protected',async()=>{for(const state of [{input:true},{modal:true},{mutating:true},{loading:true},{zoom:2}]){const s=setup(state);s.start();assert.notEqual(s.move(0,120).prevented,true);await s.end();assert.equal(s.calls.length,0)}});
test('cancelled and multi-touch gestures do not trigger a refresh',async()=>{const s=setup();s.start();s.move(0,120);s.listeners.touchcancel();await s.end();assert.equal(s.calls.length,0);s.listeners.touchstart(s.event(0,0,2));s.move(0,120);await s.end();assert.equal(s.calls.length,0)});
test('a second pull cannot duplicate an in-flight refresh',async()=>{const s=setup({deferred:true});s.start();s.move(0,110);const pending=s.end();s.start();s.move(0,120);await s.end();assert.equal(s.calls.length,1);s.resolve();await pending;assert.equal(s.calls.length,1)});
test('content offset follows the measured header height',()=>{const s=setup();assert.equal(s.vars['--admin-header-height'],'70px');s.resize(102);assert.equal(s.vars['--admin-header-height'],'102px')});
test('a desktop still measures header height and does not install touch handlers',()=>{const s=setup({touches:0});assert.equal(s.vars['--admin-header-height'],'70px');assert.equal(s.listeners.touchmove,undefined)});
