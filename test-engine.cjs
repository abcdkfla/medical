const assert=require('node:assert/strict');
const M=require('./docs/engine.js');
function run(c,dt=.002){const s=M.create(c);let count=0;while(!s.stopped){M.step(s,c,dt);for(const k of ['t','V','B','G','N','AM','C','ph'])assert(Number.isFinite(s[k])&&s[k]>=0,k);assert(s.V<=4+1e-8);assert(++count<500000);}return s;}
const base=M.defaults();assert.equal(M.media(base).s,20);assert.equal(M.media(base).n,1.06);assert.equal(M.media(base).xmax,9.6);
for(const strain of ['bl21','cg']){const c={...M.defaults(),strain,duration:240,temp:strain==='bl21'?37:30};const s=run(c);assert.equal(s.t,240);if(strain==='cg')assert.equal(s.AM,0);assert(Math.abs(s.N+.12*(s.B-c.x0*c.v0)-(M.media(c).n*c.v0+s.baseTotal/1000*c.baseM*14))<1e-8);console.log(strain,'240 h finite, nitrogen balance passed',M.snapshot(s));}
const recipe=M.defaults();recipe.recipeOn=true;const s=run(recipe);assert.equal(s.phase,2);assert(Math.abs(s.feedTotal-280)<1e-6);console.log('recipe transitions + integrated feed passed');
const cap={...M.defaults(),v0:3.99,feed:100,phAuto:false};const stopped=run(cap);assert.equal(stopped.V,4);assert(stopped.t<.11);console.log('volume hard stop passed');
const zero=M.defaults();zero.air=0;zero.o2=0;const zs=run(zero);assert.equal(zs.kla,0);console.log('zero gas passed');
const noN=M.defaults();noN.phAuto=false;noN.reagents.forEach(r=>r.n=0);assert.equal(run(noN).B,noN.x0*noN.v0);console.log('nitrogen limitation passed');
assert.throws(()=>M.create({...M.defaults(),duration:Infinity}));assert.throws(()=>M.create({...M.defaults(),v0:5}));assert.throws(()=>M.create({...M.defaults(),recipeOn:true,duration:100}));assert.throws(()=>M.create({...M.defaults(),reagents:[{name:'bad',g:2,c:.8,n:.5,s:0}]}));console.log('invalid configuration rejected');
const a=run({...M.defaults(),duration:24},.002),b=run({...M.defaults(),duration:24},.001);assert(Math.abs(a.B-b.B)/b.B<.03);console.log('step-size convergence <3% passed',a.B,b.B);
