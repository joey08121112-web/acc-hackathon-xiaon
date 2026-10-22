/** 所有者：Claude。首页一次只出一张选择卡：按先后顺序挑一张，其余这一轮不出。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickHomeSlot } from '../../src/components/learning/ChatPanel';
const none={learningLoop:false,loopEntry:false,problemDraft:false,progressCardDraft:false,askProblem:false,needsCheck:false,modeSuggestion:false,askStudy:false,taskSuggestion:false,memory:false,retest:false,memoryOff:false};
test('one card at a time, in order: this problem first, then next steps, memory and reminders last',()=>{
 assert.equal(pickHomeSlot(none),null);
 assert.equal(pickHomeSlot({...none,memory:true,needsCheck:true}),'needsCheck','the memory offer waits behind the needs check');
 assert.equal(pickHomeSlot({...none,memory:true,retest:true}),'memory');
 assert.equal(pickHomeSlot({...none,problemDraft:true,askProblem:true,progressCardDraft:true}),'problemConfirm');
 assert.equal(pickHomeSlot({...none,askStudy:true,taskSuggestion:true,modeSuggestion:true}),'modeSwitch');
 assert.equal(pickHomeSlot({...none,taskSuggestion:true,memory:true}),'taskSuggestion');
 assert.equal(pickHomeSlot({...none,memoryOff:true,retest:true}),'retest','the memory-off line only shows when nothing else does');
 assert.equal(pickHomeSlot({...none,memoryOff:true}),'memoryOff');
 assert.equal(pickHomeSlot({...none,learningLoop:true,problemDraft:true,needsCheck:true,memory:true}),'learningLoop','an active learning fragment is the one card');
 assert.equal(pickHomeSlot({...none,loopEntry:true,needsCheck:true}),'needsCheck','the loop entry waits behind reply cards');
 assert.equal(pickHomeSlot({...none,loopEntry:true,retest:true}),'retest');
 assert.equal(pickHomeSlot({...none,loopEntry:true,memoryOff:true}),'loopEntry');
});
