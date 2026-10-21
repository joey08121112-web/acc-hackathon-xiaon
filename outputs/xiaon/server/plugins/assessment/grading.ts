import { correct,tasks as legacyTasks,type Task } from '../../../src/data';
import type { TaskDefinition,Attempt,Evidence,GradingResult } from '../../../shared/learning-contracts';
import { validateAnalysis,type AnswerAnalysis,type AnalysisPoint } from './model-analysis';
type PointFinding={pointId:string;status:Evidence['status'];quote:string;location:Evidence['location'];explanation:string;source:Evidence['source']};
export type ObjectiveFinding=Omit<PointFinding,'pointId'|'source'>;
const parserTask=(task:TaskDefinition,answer:string[]):Task=>({id:task.id,dim:task.primaryDimension,title:task.title,question:task.question,hint:'受限表达式核对',explanation:'只核对结果',answer});
/** Reuses data.ts correct() as a parser AND comparator; self-equivalence probes parser support without eval or a copied parser. */
export function checkObjective(task:TaskDefinition,value:string):ObjectiveFinding{
 const lines=value.split('\n');const first=lines[0].trim();const start=value.indexOf(first);
 const location={start:Math.max(0,start),end:Math.max(0,start)+first.length};
 const finding=(status:Evidence['status'],explanation:string):ObjectiveFinding=>({status,quote:first,location,explanation});
 if(!first)return finding('uncertain','没有有效作答；不作能力判断');
 if(task.version===1&&task.choices.length){
  const old=legacyTasks.find(t=>t.id===task.id);return finding(old&&correct(old,first)?'supported':'unsupported','仅复核旧题结果，不补造解释或跨次证据');
 }
 if(task.choices.length){
  const labels=task.choices.map(c=>c.split(':')[0]);
  if(!labels.includes(first))return finding('uncertain','选择不在受支持选项内');
  return finding(task.answer.includes(first)?'supported':'unsupported','只核对选项，不据此推断理由理解');
 }
 // Calculation steps on additional lines must all remain equivalent; explanations for language/model tasks are separately analyzed.
 const source=task.primaryDimension==='计算'?lines.filter(l=>l.trim()).map(l=>l.trim().replace(/^=/,'')).join('='):first;
 if(source.length>2000||(source.match(/\(/g)?.length??0)>32)return finding('uncertain','表达式超出受限核对预算');
 const steps=source.split('=');
 if(steps.some(step=>!correct(parserTask(task,[step]),step)))return finding('uncertain','不支持该答案语法；不是任意数学证明核验');
 const ok=correct(parserTask(task,task.answer),source);
 return {...finding(ok?'supported':'unsupported',ok?'受限一次式的所有已写等号步骤均与参考结果等价；不推断心理过程':'可解析的一次式或等号链存在与可信结果不等价的步骤'),...(task.primaryDimension==='计算'?{quote:value,location:{start:0,end:value.length}}:{})};
}
export function evaluateRubric(task:TaskDefinition,attempt:Attempt,analysis?:AnswerAnalysis):{
 findings:PointFinding[];verdict:GradingResult['verdict'];uncertainties:string[];errorClues:string[];method:GradingResult['method'];
}{
 const objective=checkObjective(task,attempt.value);
 const findings:PointFinding[]=[{pointId:task.rubric[0].id,...objective,source:'program'}];
 const uncertainties:string[]=[];
 let checked:AnswerAnalysis|undefined;
 if(analysis){checked=validateAnalysis({points:analysis.points},task,attempt);uncertainties.push(...analysis.issues,...checked.issues);}
 const resultModel=checked?.points.find(p=>p.pointId===task.rubric[0].id);
 const conflict=resultModel&&resultModel.status!==objective.status;
 if(conflict)uncertainties.push('程序与模型的结果评分点冲突，保留确定性证据并待核查');
 for(const rubric of task.rubric.slice(1)){
  const point:AnalysisPoint|undefined=checked?.points.find(p=>p.pointId===rubric.id);
  findings.push(point?{...point,source:'model'}:{pointId:rubric.id,status:'uncertain',quote:'',location:{start:0,end:0},explanation:'没有经定位校验的学生解释证据，需继续核查',source:'program'});
 }
 if(findings.some(p=>p.status==='uncertain'))uncertainties.push('部分评分点证据不足；未用最终结果猜测学生的思考过程');
 const errorClues=objective.status==='unsupported'?task.commonErrors.filter(e=>attempt.value.split('\n')[0].trim()===e.indicator).map(e=>e.description):[];
 const verdict=conflict||uncertainties.length||findings.some(p=>p.status==='uncertain')?'needs_review':findings.some(p=>p.status==='unsupported')?'incorrect':'correct';
 return{findings,verdict,uncertainties:[...new Set(uncertainties)],errorClues,method:analysis?'model_assisted':'rubric_program'};
}
