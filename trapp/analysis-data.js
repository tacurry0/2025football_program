/* Load a complete, hash-verified revision before replacing the visible analysis. */
(function(){
'use strict';
const base='https://raw.githubusercontent.com/tacurry0/2025football_program/main/trapp/data/';
let manifest=null,files=new Map(),pending=null,lastCheck=0,hydration=null,lastError=null;
async function hydrate(){
 if(hydration)return hydration;
 hydration=(async()=>{
 try{const cache=await caches.open('trapp-analysis-verified-v1'),saved=await cache.match(base+'generated/update.json');if(!saved)return;const m=await saved.json(),entries=await Promise.all(Object.keys(m.files).map(async key=>{const r=await cache.match(base+key+'?rev='+m.revision);if(!r)throw Error('Partial cache');return [key,await r.text()];}));if(!manifest){manifest=m;files=new Map(entries);}}catch(_){}
 })();return hydration;
}
async function persist(m,downloaded){
 try{const cache=await caches.open('trapp-analysis-verified-v1');for(const [key,text] of downloaded)await cache.put(base+key+'?rev='+m.revision,new Response(text));await cache.put(base+'generated/update.json',new Response(JSON.stringify(m)));const keep=new Set([...downloaded.keys()].map(key=>base+key+'?rev='+m.revision).concat(base+'generated/update.json'));for(const r of await cache.keys())if(!keep.has(r.url))await cache.delete(r);}catch(_){}
}
async function response(url){const r=await fetch(url,{cache:'no-cache',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);return r;}
function path(url){return String(url).split('?')[0].replace(/^\.\/data\//,'');}
window.TrappAnalysisData={
 async fetch(url){await hydrate();const text=files.get(path(url));return text!==undefined?Promise.resolve(new Response(text,{headers:{'Content-Type':'application/json'}})):fetch(url);},
 get metadata(){return manifest;},
 async check(force=false){
  await hydrate();
  if(pending)return pending;
  if(!force&&Date.now()-lastCheck<300000){if(lastError)throw lastError;return {changed:false,manifest};}
  lastCheck=Date.now();
  pending=(async()=>{
   lastError=null;
   const next=await(await response(base+'generated/update.json?t='+Math.floor(Date.now()/300000))).json();
   if(next.season!=='2026_2027'||!next.revision||!next.files||!next.clubs)throw Error('Invalid update manifest');
   if(manifest?.revision===next.revision){manifest=next;return {changed:false,manifest};}
   const entries=Object.entries(next.files);
   if(entries.length<14||entries.some(([key,hash])=>!/^((generated|history)\/(niigata|kumamoto)\/)/.test(key)||key.includes('..')||!key.endsWith('.json')||!/^[a-f0-9]{64}$/.test(hash)))throw Error('Invalid files');
   const downloaded=new Map();let index=0;
   async function worker(){while(index<entries.length){const [key,hash]=entries[index++],r=await response(base+key+'?rev='+next.revision),bytes=await r.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes),actual=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');if(actual!==hash)throw Error('Publication is still updating');const text=new TextDecoder().decode(bytes);JSON.parse(text);downloaded.set(key,text);}}
   await Promise.all([worker(),worker(),worker()]);
   files=downloaded;manifest=next;await persist(next,downloaded);return {changed:true,manifest};
  })().catch(e=>{lastError=e;throw e;}).finally(()=>{pending=null;});
  return pending;
 }
};
})();
