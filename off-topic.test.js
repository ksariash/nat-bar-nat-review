import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatedSkips, skipAt} from './public/off-topic.js';
const aside = {id:'a', label:'Aside', start:10, end:20};
test('missing data leaves the full audio available',()=>assert.deepEqual(validatedSkips(undefined,100),[]));
test('invalid, overlapping and duplicate ranges cannot skip review audio',()=>{
  assert.deepEqual(validatedSkips([aside,{...aside,start:22,end:30},{id:'b',label:'Overlap',start:15,end:25},{id:'c',label:'Invalid',start:-1,end:5},{id:'d',label:'Invalid',start:40,end:101}],100),[aside]);
});
test('start is included and end excluded to prevent repeated skipping',()=>{
  assert.equal(skipAt([aside],9.99),undefined);
  assert.equal(skipAt([aside],10),aside);
  assert.equal(skipAt([aside],19.99),aside);
  assert.equal(skipAt([aside],20),undefined);
});
