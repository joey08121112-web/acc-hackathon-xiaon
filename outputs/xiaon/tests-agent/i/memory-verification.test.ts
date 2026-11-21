/** 记忆验证（MEMORY-DESIGN-GUIDE §7 第 8 项）在 CI 里也跑一次。
 *
 * 脚本本身在 scripts/agent/memory-verification.ts，会产出可对外引用的证据文件；
 * 这个测试保证 CI 每次都验一遍，别让「跑过一次」变成「跑过一次就够了」。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { runVerification } from '../../scripts/agent/memory-verification';

test('S1/S3/S10 与跨天保持都通过',async()=>{
 const report=await runVerification();
 for(const [name,scenario] of Object.entries(report.scenarios)){
  assert.equal(scenario.passed,true,`${name} 没通过：${scenario.summary}`);
 }
 assert.equal(Object.keys(report.scenarios).length,4);
 // 诚实边界必须写在证据里 —— 没有它，这份文件会被当成「效果证明」。
 assert.match(report.honestBoundary,/不.*证明|机制/);
});
