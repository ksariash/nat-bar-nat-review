import test from 'node:test';
import assert from 'node:assert/strict';
import {passageParts, passageVisible, visiblePartIndex} from './public/pdf-navigation.js';

test('continuations follow page and column order, including a right column that starts higher', () => {
  const parts = passageParts([
    {page: 5, column: 0, bbox: [.07,.1,.48,.3]},
    {page: 4, column: 1, bbox: [.53,.05,.93,.6]},
    {page: 4, column: 0, bbox: [.07,.8,.48,.9]}
  ]);
  assert.deepEqual(parts.map(p => [p.page,p.column]), [[4,0],[4,1],[5,0]]);
});
test('authority fragments and wrapped lines do not create extra parts', () => {
  const parts = passageParts([
    {page: 4, column: 1, bbox: [.53,.2,.6,.22]},
    {page: 4, column: 1, bbox: [.61,.2,.93,.22]},
    {page: 4, column: 1, bbox: [.53,.23,.93,.25]}
  ]);
  assert.deepEqual(parts, [{page:4,column:1,bbox:[.53,.2,.93,.25]}]);
});
test('unusable highlight geometry cannot create a jump target', () => {
  assert.deepEqual(passageParts([{page:0,bbox:[0,0,1,1]},{page:1,bbox:[1,0,0,1]},
    {page:2,bbox:[0,0,NaN,1]}]), []);
});
const viewport = {left:0,top:100,right:393,bottom:700};
test('current-topic detection accounts for horizontal panning and vertical clipping', () => {
  assert.equal(passageVisible([{left:500,top:200,right:800,bottom:220}],viewport),false);
  assert.equal(passageVisible([{left:10,top:20,right:300,bottom:80}],viewport),false);
  assert.equal(passageVisible([{left:10,top:200,right:300,bottom:220}],viewport),true);
  assert.equal(passageVisible([{left:10,top:699,right:300,bottom:719}],viewport),false);
});
test('a visible continuation counts even if the first segment is offscreen', () => {
  assert.equal(passageVisible([{left:500,top:200,right:800,bottom:220},
    {left:10,top:200,right:300,bottom:220}],viewport),true);
});
test('manual scrolling selects the visible part and leaves the previous part when none is visible', () => {
  assert.equal(visiblePartIndex([{left:500,top:100,right:800,bottom:700},
    {left:10,top:150,right:300,bottom:400}],viewport),1);
  assert.equal(visiblePartIndex([{left:500,top:100,right:800,bottom:700}],viewport),-1);
});
