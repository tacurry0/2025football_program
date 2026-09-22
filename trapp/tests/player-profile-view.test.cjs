const test=require('node:test');
const assert=require('node:assert/strict');
const {numbers,numberPlan,cycle,shell}=require('../player-profile-view');
const scopes=[{key:'total',numbers:[23,23,16,0],rotate:true},{key:'year:2027',numbers:[23],rotate:false},{key:'year:2020',numbers:[16],rotate:false}];
test('season selection isolates that season while total deduplicates and preserves number zero',()=>{
 assert.deepEqual(numberPlan(scopes,'total'),{values:['23','16','0'],rotate:true});
 assert.deepEqual(numberPlan(scopes,'year:2020'),{values:['16'],rotate:false});
 assert.deepEqual(numberPlan(scopes,'year:2027'),{values:['23'],rotate:false});
 assert.deepEqual(numberPlan(scopes,'missing'),{values:['—'],rotate:false});
 assert.deepEqual(numbers('23、16/23,0'),['23','16','0']);
});
test('total cycles every five seconds and disposal removes its timer; a year does not rotate',()=>{
 const callbacks=new Map(); let id=0;
 const clock={setInterval(fn,ms){assert.equal(ms,5000);callbacks.set(++id,fn);return id;},clearInterval(id){callbacks.delete(id);}};
 const shown=[];const stop=cycle(numberPlan(scopes,'total'),v=>shown.push(v),clock);
 assert.deepEqual(shown,['23']);callbacks.get(1)();callbacks.get(1)();callbacks.get(1)();
 assert.deepEqual(shown,['23','16','0','23']);stop();assert.equal(callbacks.size,0);
 cycle(numberPlan(scopes,'year:2020'),v=>shown.push(v),clock);assert.equal(callbacks.size,0);assert.equal(shown.at(-1),'16');
});
test('profile header escapes names, shows only one number and exposes an icon-only accessible card button',()=>{
 const html=shell({name:'<選手>',english:'PLAYER',position:'FW',photo:'',emblem:'crest.png',club:'niigata',scopes,period:'year:2020',body:''});
 assert(html.includes('&lt;選手&gt;'));assert(html.includes('背番号 16'));assert(!html.includes('アルビレックス新潟'));
 assert.match(html,/data-pa-player-card aria-label="選手カードを作成"[^>]*><svg/);
 assert.equal((html.match(/data-pv-number /g)||[]).length,1);
});

test('cutouts preserve aliases, URI encoding, manual photos and original fallbacks',()=>{
 const {photoSources}=require('../player-profile-view');
 const original='./data/assets/images/player_niigata/'+encodeURIComponent('笠井 佳祐')+'.jpg';
 const cutout='./data/assets/player_cutouts/123abc.webp';
 const index={'./data/assets/images/player_niigata/笠井 佳祐.jpg':cutout};
 assert.deepEqual(photoSources([original,'missing.jpg'],index),[cutout,original,'missing.jpg']);
 assert.deepEqual(photoSources(['data:image/png;base64,abc'],index),['data:image/png;base64,abc']);
 assert.deepEqual(photoSources([original],{}),[original]);
 assert.deepEqual(photoSources([original],{[decodeURIComponent(original)]:'https://untrusted/image'}),[original]);
});
