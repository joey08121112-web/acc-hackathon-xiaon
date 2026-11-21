/** 监护人同意的服务端留痕（2026-11-21 加）。
 *
 * 之前监护人同意只存在浏览器本地（localStorage 的 guardian 字段）：换设备就没了，
 * 家长查不到「当时同意的是哪一版、谁同意的、什么时候同意的」。
 * 现在同意写进服务端，追加式记录：撤回另记一条，前面的记录原样保留。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { temporaryRepository,TestClock } from '../../server/storage/testing';
import { GUARDIAN_AGREEMENT_VERSION,schemas } from '../../shared/learning-contracts';

const setup=()=>{
 const f=temporaryRepository(new TestClock('2026-11-21T02:00:00.000Z')),r=createRuntime({...f}),d=installLearning(r,{timeoutMs:2000});
 return {...f,r,d};
};
const id=()=>crypto.randomUUID();

test('同意写进服务端：版本、时间、操作者都留得住，家长能查',async()=>{
 const f=setup();try{
  const granted=f.r.events.guardianConsent({operationId:id(),agreementVersion:GUARDIAN_AGREEMENT_VERSION,actor:'guardian',decision:'granted',scope:['learning_overview','memory_use'],note:'家长当面确认'});
  assert.equal(granted.decision,'granted');
  assert.equal(granted.agreementVersion,GUARDIAN_AGREEMENT_VERSION);
  assert.equal(granted.actor,'guardian');
  assert.equal(granted.at,'2026-11-21T02:00:00.000Z');
  // 服务端库里查得到（不是只在这个进程里）。
  const stored=f.r.repository.list('guardianConsents');
  assert.equal(stored.length,1);
  assert.equal(stored[0].note,'家长当面确认');
  // 家长查同意流水时能看到。
  const view=await f.d.view();
  assert.equal(view.guardianConsents.length,1);
  assert.equal(view.guardianConsents[0].agreementVersion,GUARDIAN_AGREEMENT_VERSION);
 }finally{f.dispose();}
});

test('撤回是另记一条：旧记录原样保留，不改不改写',async()=>{
 const f=setup();try{
  const first=f.r.events.guardianConsent({operationId:id(),agreementVersion:GUARDIAN_AGREEMENT_VERSION,actor:'guardian',decision:'granted',scope:['memory_use']});
  const revoked=f.r.events.guardianConsent({operationId:id(),agreementVersion:GUARDIAN_AGREEMENT_VERSION,actor:'guardian',decision:'revoked',scope:['memory_use'],note:'家长撤回'});
  const all=f.r.repository.list('guardianConsents');
  assert.equal(all.length,2,'两条都在');
  // 同一条授权的两个修订：id 相同，revision 递增，旧的那条原样保留。
  const kept=all.find(c=>c.revision===1)!;
  assert.equal(kept.id,first.id);
  assert.equal(kept.decision,'granted','原来那条没有被改写');
  assert.equal(revoked.revision,2,'同一项授权的修订号递增');
  const latest=all.find(c=>c.revision===2)!;
  assert.equal(latest.decision,'revoked');
  assert.equal(latest.note,'家长撤回');
  // 取「当前状态」拿到的是最新那条。
  assert.equal(f.r.repository.get('guardianConsents',first.id)!.decision,'revoked');
 }finally{f.dispose();}
});

test('同意书版本、操作者、结果、范围都不能缺',()=>{
 const base={schemaVersion:'1.0.0',id:'gc-1',operationId:'op-1',revision:1,agreementVersion:'1.0',actor:'guardian',decision:'granted',scope:['learning_overview'],note:null,at:'2026-11-21T02:00:00.000Z'};
 assert.equal(schemas.GuardianConsent.safeParse(base).success,true);
 assert.equal(schemas.GuardianConsent.safeParse({...base,actor:'teacher'}).success,false,'操作者只能是学生或监护人');
 assert.equal(schemas.GuardianConsent.safeParse({...base,decision:'maybe'}).success,false);
 assert.equal(schemas.GuardianConsent.safeParse({...base,scope:[]}).success,false,'范围不能为空');
 assert.equal(schemas.GuardianConsent.safeParse({...base,agreementVersion:''}).success,false);
 assert.equal(schemas.GuardianConsent.safeParse({...base,extra:'x'}).success,false,'不接受未知字段');
});
