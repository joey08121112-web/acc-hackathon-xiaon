import assert from "node:assert/strict";
import { correct, getTask } from "../runtime/src/data.ts";
import { initial, reducer, observations } from "../runtime/src/domain.ts";
const cases: [string,string,boolean][] = [
 ["bracket","x+5",true], ["bracket","5+x",true],
 ["transfer","4a+2",true], ["transfer","4*a+2",true],
 ["transfer","4×a+2",true], ["transfer","+4a+2",true],
 ["bracket","3x-2x-5=x+5",false], ["bracket","x-5",false],
 ["transfer","4a-2",false],
];
let failures=0;
for (const [task,value,expected] of cases) {
 const actual=correct(getTask(task),value);
 console.log(JSON.stringify({task,value,expected,actual,result:actual===expected?"PASS":"FAIL"}));
 if(actual!==expected) failures++;
}
let s = reducer(initial(),{type:"open-task",id:"transfer"});
s = reducer(s,{type:"attempt",taskId:"transfer",id:"audit-first",value:"4*a+2",time:"synthetic"});
s = reducer(s,{type:"attempt",taskId:"transfer",id:"audit-second",value:"4a+2",time:"synthetic"});
console.log(JSON.stringify({report:observations(s)[2],records:s.records},null,2));
assert.equal(failures,0,"Equivalent mathematically correct answers must not be recorded as incorrect");
