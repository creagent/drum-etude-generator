const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const core=vm.createContext({});vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],core);
const definitions=vm.runInContext('DURATIONS',core);
const all=Object.fromEntries(definitions.map(d=>[d.id,{notes:true,rests:true}]));
function sequence(items) {
  let time=0;
  return items.map(([type,rest=false,dotted=false])=>{
    const ticks=definitions.find(d=>d.id===type).ticks*(dotted?1.5:1);
    const event={type,rest,dotted,ticks,time,tuplet:type==='triplet'?Math.floor(time/24)*24:null};time+=ticks;return event;
  });
}
const shape=m=>Array.from(m,e=>[e.type,e.rest,e.dotted,e.time,e.ticks]);
const original=sequence([['sixteenth',true],['eighth',true],['quarter'],['eighth',true],['sixteenth'],['eighth',true],['eighth',true],['eighth']]);
const simplified=core.simplifyMeasure(original,all);
assert.deepEqual(shape(simplified),[
  ['eighth',true,true,0,18],
  ['quarter',false,true,18,36],
  ['sixteenth',false,false,54,6],
  ['quarter',true,false,60,24],
  ['eighth',false,false,84,12]
]);
assert.equal(JSON.stringify(core.makePlaybackPlan({bars:1,measures:[original]},90,true).sounds),JSON.stringify(core.makePlaybackPlan({bars:1,measures:[simplified]},90,true).sounds));
const attacks=sequence([['eighth'],['eighth']]);
assert.deepEqual(shape(core.simplifyMeasure(attacks,all)),shape(attacks),'Two hits must never turn into one');
const silence=sequence([['eighth',true],['eighth',true]]);
assert.deepEqual(shape(core.simplifyMeasure(silence,all)),[['quarter',true,false,0,24]]);
assert.equal(core.simplifyMeasure(silence,{eighth:{rests:true}}).length,2,'Disabled quarter rests stay disabled');
const restThenNote=sequence([['eighth',true],['eighth']]);
assert.deepEqual(shape(core.simplifyMeasure(restThenNote,all)),shape(restThenNote),'A leading rest cannot move an attack earlier');
const tri=sequence([['quarter'],['triplet',true],['triplet',true],['triplet',true],['quarter',true],['quarter']]);
assert.equal(core.simplifyMeasure(tri,all).filter(e=>e.type==='triplet').length,3);
const glyphs=core.drawMeasure(simplified,500);
assert.equal((glyphs.match(/class="augmentation-dot"/g)||[]).length,2);
assert.ok(!/NaN|undefined|Infinity/.test(core.scoreSVG({bars:1,measures:[simplified]},2)));
let state=981;
const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
const sample=core.makeEtude(64,all,random,false).measures.flat();
for(const type of ['half','quarter','eighth','sixteenth']) {
  assert.ok(sample.some(e=>e.type===type&&e.dotted&&!e.rest),`Dotted ${type} notes must be generated`);
  assert.ok(sample.some(e=>e.type===type&&!e.dotted),`Plain ${type} remains available`);
}
assert.ok(sample.every(e=>Number.isInteger(e.ticks)));
assert.ok(sample.filter(e=>e.type==='triplet').every(e=>!e.dotted));
assert.ok(!/type="checkbox"[^>]*(?:dotted|точк)/.test(html));
const generated=core.makeEtude(8,all,()=>0.999999);
assert.ok(generated.measures.every(m=>m.reduce((sum,e)=>sum+e.ticks,0)===96));
console.log('PASS: screenshot example, rest merging, note extension, preserved attacks, selected vocabulary, dotted glyphs and dotted generation.');
