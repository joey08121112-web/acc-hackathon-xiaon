/** 所有者：Claude。等待回复时小N说的话：每一档都有几句可换，不再提首页并不存在的「取消等待」按钮；休息时的悄悄话也不止一句。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { THINKING } from '../../src/components/learning/PetStage';
import { clipsOf } from '../../src/voice/clips';
test('waiting lines vary at every step and only promise what the home page offers',()=>{
 assert.ok(THINKING.length>=5,'a slow reply keeps getting new words');
 for(const step of THINKING)assert.ok(step.length>=2,step.join('/'));
 assert.ok(THINKING.flat().every(line=>!line.includes('取消等待')));
 assert.ok(clipsOf('sleepy').length>=4);assert.ok(clipsOf('think').length>=4);assert.ok(clipsOf('long').length>=4);
});
