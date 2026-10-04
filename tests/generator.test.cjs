const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const core = vm.createContext({});
vm.runInContext(source, core);
const defs = vm.runInContext('DURATIONS', core);
let seed=731;
const random = () => ((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
let tested=0;
for(let mask=1;mask<1024;mask++) {
  const selection=Object.fromEntries(defs.map((d,i)=>[d.id,{notes:Boolean(mask&(1<<(i*2))),rests:Boolean(mask&(1<<(i*2+1)))}]));
  const available=defs.filter(d=>selection[d.id].notes||selection[d.id].rests);
  for(const rng of [random,()=>0,()=>0.999999]) {
    const etude=core.makeEtude(3,selection,rng);
    assert.equal(etude.measures.length,3);
    for(const measure of etude.measures) {
      let time=0;
      for(let i=0;i<measure.length;i++) {
        const event=measure[i];
        assert.equal(event.time,time);
        assert.equal(event.ticks,defs.find(d=>d.id===event.type).ticks);
        assert.ok(selection[event.type][event.rest?'rests':'notes']);
        if(event.type==='triplet') {
          assert.equal(event.tuplet%12,0);
          assert.ok(event.time>=event.tuplet&&event.time<event.tuplet+12);
          const group=measure.filter(e=>e.tuplet===event.tuplet);
          assert.equal(group.length,3);
          assert.ok(group.every(e=>e.type==='triplet'&&e.ticks===4));
        } else assert.equal(event.tuplet,null);
        time+=event.ticks;
      }
      assert.equal(time,48);
      assert.ok(new Set(measure.map(e=>e.type)).size>=Math.min(2,available.length));
      const drawing=core.drawMeasure(measure,core.measureMinWidth(measure));
      assert.ok(!/NaN|undefined|Infinity/.test(drawing));
      tested++;
    }
  }
}
assert.throws(()=>core.makeEtude(1,{}),/хотя бы одну/);
for(const bars of [0,65,1.5,NaN])assert.throws(()=>core.makeEtude(bars,{quarter:{notes:true}}),/Количество/);
const short=core.makeEtude(9,{half:{notes:true}},random);
const wide=core.layoutScore(short,1200);
assert.equal(wide.columns,4);
assert.deepEqual(Array.from(wide.rows,r=>r.end-r.start),[4,4,1]);
const narrow=core.layoutScore(short,320);
assert.equal(narrow.columns,2);
assert.deepEqual(Array.from(narrow.rows,r=>r.end-r.start),[2,2,2,2,1]);
const dense=core.makeEtude(4,{sixteenth:{notes:true}});
assert.equal(core.layoutScore(dense,1200).columns,2);
const mixed=core.drawMeasure([
  {type:'eighth',ticks:6,time:0,rest:false,tuplet:null},
  {type:'sixteenth',ticks:3,time:6,rest:false,tuplet:null},
  {type:'sixteenth',ticks:3,time:9,rest:false,tuplet:null}
],150);
assert.ok(mixed.includes(' 43H'), 'Sixteenths receive their secondary beam');
const svg=core.scoreSVG(short,4);
assert.ok(svg.includes('4/4')&&!/NaN|undefined|Infinity/.test(svg));
assert.ok(!html.includes('id="counts"')&&!html.includes('class="count"'));
console.log(`PASS: ${tested} measures across all 1023 checkbox combinations; 4/4 totals, vocabulary, tuplets, variation, layout and rendering.`);
