/* Load a complete, hash-verified revision before replacing the visible analysis. */
(function(){
'use strict';
const base='https://raw.githubusercontent.com/tacurry0/2025football_program/main/trapp/data/';
const localBase=new URL('./data/',document.baseURI).href;
let manifest=null,files=new Map(),pending=null,lastCheck=0,hydration=null;
async function hydrate(){
 if(hydration)return hydration;
 hydration=(async()=>{
 try{const cache=await caches.open('trapp-analysis-verified-v1'),saved=await cache.match(base+'generated/update.json');if(!saved)return;const m=await saved.json(),entries=await Promise.all(Object.keys(m.files).map(async key=>{const r=await cache.match(base+key+'?rev='+m.revision);if(!r)throw Error('Partial cache');return [key,await r.text()];}));if(!manifest){manifest=m;files=new Map(entries);}}catch(_){}
 })();return hydration;
}
async function persist(m,downloaded){
 try{const cache=await caches.open('trapp-analysis-verified-v1');for(const [key,text] of downloaded)await cache.put(base+key+'?rev='+m.revision,new Response(text));await cache.put(base+'generated/update.json',new Response(JSON.stringify(m)));const keep=new Set([...downloaded.keys()].map(key=>base+key+'?rev='+m.revision).concat(base+'generated/update.json'));for(const r of await cache.keys())if(!keep.has(r.url))await cache.delete(r);}catch(_){}
}
async function response(key,verify){
 let failure;
 // Both locations contain the same published revision. Pages remains available when
 // raw.githubusercontent.com is unreachable from a mobile network.
 for(const source of [base,localBase]){
  try{
   const url=source+key+(key.includes('?')?'&':'?')+'refresh='+Date.now()+'-'+Math.random().toString(36).slice(2);
   const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});
   if(!r.ok)throw Error('HTTP '+r.status);
   if(!verify)return r;
   const bytes=await r.arrayBuffer();
   const digest=await crypto.subtle.digest('SHA-256',bytes);
   const actual=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
   if(actual!==verify)throw Error('Published files have not caught up with the manifest');
   return new TextDecoder().decode(bytes);
  }catch(e){failure=e;}
 }
 throw failure;
}
function path(url){return String(url).split('?')[0].replace(/^\.\/data\//,'');}
window.TrappAnalysisData={
 async fetch(url){await hydrate();const text=files.get(path(url));return text!==undefined?Promise.resolve(new Response(text,{headers:{'Content-Type':'application/json'}})):fetch(url);},
 get metadata(){return manifest;},
 async check(force=false){
  await hydrate();
  if(pending)return pending;
  if(!force&&Date.now()-lastCheck<300000)return {changed:false,manifest};
  pending=(async()=>{
   const next=await(await response('generated/update.json')).json();
   if(next.season!=='2026_2027'||!next.revision||!next.files||!next.clubs)throw Error('Invalid update manifest');
   if(manifest?.revision===next.revision){manifest=next;lastCheck=Date.now();return {changed:false,manifest};}
   const entries=Object.entries(next.files);
   if(entries.length<14||entries.some(([key,hash])=>!/^((generated|history)\/(niigata|kumamoto)\/)/.test(key)||key.includes('..')||!key.endsWith('.json')||!/^[a-f0-9]{64}$/.test(hash)))throw Error('Invalid files');
   const downloaded=new Map();let index=0;
   async function worker(){while(index<entries.length){const [key,hash]=entries[index++],text=await response(key+'?rev='+next.revision,hash);JSON.parse(text);downloaded.set(key,text);}}
   await Promise.all([worker(),worker(),worker()]);
   files=downloaded;manifest=next;lastCheck=Date.now();await persist(next,downloaded);return {changed:true,manifest};
  })().finally(()=>{pending=null;});
  return pending;
 }
};
})();
