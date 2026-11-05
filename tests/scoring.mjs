import assert from 'node:assert/strict';
import { TESTS, scoreTest } from '../lib/tests.ts';

assert.equal(TESTS.length,12,'exactly 12 screening modules');
assert.equal(new Set(TESTS.map(t=>t.id)).size,12,'unique test identifiers');
for(const t of TESTS){
 assert.ok(t.items.length>0,t.id);
 const answers=t.items.map(()=>t.choices[0].value);
 const score=scoreTest(t.id,answers);
 assert.ok(Number.isFinite(score.score),t.id);
 assert.ok(['green','yellow','red','neutral'].includes(score.zone),t.id);
 assert.equal(score.clinicallyValidated,false,'must not claim clinical validation');
}
assert.equal(scoreTest('gad7',Array(7).fill(2)).zone,'red');
assert.equal(scoreTest('gad7',Array(7).fill(0)).zone,'green');
assert.equal(scoreTest('asq',[0,0,0,0,0]).zone,'green');
assert.equal(scoreTest('asq',[1,0,0,0,0]).zone,'yellow');
assert.equal(scoreTest('asq',[0,1,0,0,1]).zone,'red');
assert.equal(scoreTest('asq',[2,0,0,0,0]).zone,'yellow');
assert.equal(scoreTest('msi',Array(10).fill(1)).zone,'red');
assert.equal(scoreTest('ed15',Array(15).fill(3)).score,3);
assert.equal(scoreTest('needs',Array(5).fill(10)).score,50);
assert.throws(()=>scoreTest('gad7',[1,2]),/არასწორი/);
assert.throws(()=>scoreTest('gad7',Array(7).fill(99)),/არასწორი/);
console.log('12 instruments and safety scoring smoke tests passed');
