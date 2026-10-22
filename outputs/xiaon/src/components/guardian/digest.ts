/** 家长视图的数据口径（纯函数，浏览器与测试共用）。
 * 只读结构化学习记录：作答分类、知识点状态、计划确认、复习队列、错题条数、进步卡信心自评、专业模式等级。
 * 不读聊天、倾诉、记忆、对话观察，也不读孩子写下的作答原文、错题原话或进步卡文字。 */
import type { LearningView } from '../../../server/agents/learning';
import { MODULE_LEVEL_LABELS } from '../../../shared/learning-contracts';
import { skillStatusLabels } from '../../learning/assessment';
import { shanghaiDate } from '../../learning/review';
import { MONTH_PLAN_POINT_NAMES } from '../plan/pointNames';

type Kind='new_independent'|'completed_with_help'|'corrected_original'|'original_redo'|'incorrect'|'pending'|'unknown';
export type WeekChange={name:string;fromDate:string;fromLabel:string;toDate:string};
export type GuardianDigest={
 overview:{
  planGoal:string|null;planDeferred:boolean;monthGoal:string|null;paused:boolean;
  skills:{name:string;label:string;lastDate:string|null}[];unobserved:number;
  nextReview:{name:string;dueDate:string}|null;activeReviews:number;
  levels:{module:string;label:string}[]|null;levelsDate:string|null;
 };
 week:{
  start:string;end:string;hasEarlier:boolean;days:string[];attempts:number;
  kinds:{independent:number;helped:number;original:number;incorrect:number;pending:number};
  changes:WeekChange[];practising:{name:string;count:number}[];
  problems:{count:number;names:string[]};plan:{date:string;action:string}[];
  confidence:{more_sure:number;about_same:number;still_unsure:number}|null;
  levelChanges:{module:string;from:string;to:string}[];tips:string[];
 };
};

const resultLabels:Record<Kind,string>={new_independent:'新题独立做对',completed_with_help:'看过提示后做对',corrected_original:'同一道题改对',original_redo:'原题重做',incorrect:'还没做对',pending:'待核查',unknown:'记录不完整'};
const actionLabels:Record<string,string>={accept:'接受了计划',lighter:'把计划减量',reschedule:'把计划改期',defer:'计划暂不开始',resume:'恢复了计划'};
const pointName=(id:string)=>MONTH_PLAN_POINT_NAMES[id]??id;
const pretty=(s:string)=>Object.entries({...MONTH_PLAN_POINT_NAMES,...skillStatusLabels}).reduce((text,[key,value])=>text.replaceAll(key,value),s);
/** YYYY-MM-DD arithmetic in calendar days, independent of the browser time zone. */
export function addDays(date:string,days:number){const [y,m,d]=date.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+days)).toISOString().slice(0,10);}
export function weekStart(date:string){const [y,m,d]=date.split('-').map(Number);const dow=new Date(Date.UTC(y,m-1,d)).getUTCDay();return addDays(date,-((dow+6)%7));}
export const shortDate=(date:string)=>`${Number(date.slice(5,7))}月${Number(date.slice(8,10))}日`;

/** weekOffset 0 = 本周（上海时间，周一到周日），-1 = 上一周。 */
export function guardianDigest(v:LearningView,weekOffset=0):GuardianDigest{
 const today=shanghaiDate(v.now),start=addDays(weekStart(today),weekOffset*7),end=addDays(start,6);
 const inWeek=(date:string)=>date>=start&&date<=end;
 const pointOf=new Map<string,string>();for(const s of v.assessment.skills)for(const id of s.attemptIds)pointOf.set(id,s.knowledgePointId);
 const superseded=new Set(v.attempts.flatMap(a=>a.supersedesAttemptId?[a.supersedesAttemptId]:[]));
 const attempts=v.attempts.filter(a=>a.value.trim()&&!superseded.has(a.id)).map(a=>({id:a.id,at:a.sourceTime.occurredAt??a.sourceTime.recordedAt,date:shanghaiDate(a.sourceTime.occurredAt??a.sourceTime.recordedAt),kind:a.classification.kind as Kind,point:pointOf.get(a.id)??null})).sort((a,b)=>a.at.localeCompare(b.at));
 const week=attempts.filter(a=>inWeek(a.date));

 // 变化：本周第一次新题独立做对，且之前（任何时候）在同一知识点需要过帮助或没做对。
 const changes:WeekChange[]=[];
 for(const point of new Set(week.map(a=>a.point).filter((p):p is string=>!!p))){
  const success=week.find(a=>a.point===point&&a.kind==='new_independent');if(!success)continue;
  const before=attempts.filter(a=>a.point===point&&a.at<success.at&&['completed_with_help','incorrect','corrected_original'].includes(a.kind)).at(-1);
  if(before)changes.push({name:pointName(point),fromDate:before.date,fromLabel:resultLabels[before.kind],toDate:success.date});
 }
 const practising=[...new Set(week.filter(a=>a.kind==='incorrect'&&a.point).map(a=>a.point!))]
  .filter(p=>!week.some(a=>a.point===p&&a.kind==='new_independent'))
  .map(p=>({name:pointName(p),count:week.filter(a=>a.point===p&&a.kind==='incorrect').length}));

 const problems=v.problems.filter(p=>inWeek(shanghaiDate(p.confirmedAt)));
 const cards=v.progressCards.filter(c=>inWeek(shanghaiDate(c.confirmedAt))&&c.confidence&&c.confidence!=='prefer_not');
 const count=(k:string)=>cards.filter(c=>c.confidence===k).length;
 const reports=[...v.professionalReports].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 const levelChanges=reports.filter(r=>inWeek(shanghaiDate(r.createdAt))).flatMap(r=>r.changes).map(c=>({module:c.module,from:MODULE_LEVEL_LABELS[c.from],to:MODULE_LEVEL_LABELS[c.to]}));

 const currentPlan=v.plans.at(-1)?.snapshot??null;
 const month=today.slice(0,7),stage=v.monthStages.find(s=>s.month===month&&s.status==='confirmed');
 const latest=reports.at(-1);
 const reviews=v.reviews.filter(r=>r.status==='active').sort((a,b)=>a.dueAt.localeCompare(b.dueAt));
 const observed=v.assessment.skills.filter(s=>s.status!=='unobserved');
 const kinds={independent:week.filter(a=>a.kind==='new_independent').length,helped:week.filter(a=>a.kind==='completed_with_help').length,original:week.filter(a=>a.kind==='corrected_original'||a.kind==='original_redo').length,incorrect:week.filter(a=>a.kind==='incorrect').length,pending:week.filter(a=>a.kind==='pending'||a.kind==='unknown').length};

 const tips:string[]=[];
 if(changes.length)tips.push(`可以请孩子讲讲「${changes[0].name}」那一步现在是怎么想的，只听孩子讲，不用考。`);
 else if(practising.length)tips.push(`「${practising[0].name}」这周还在练。比起问做对没有，可以问“哪一步最想再看一眼”。`);
 if(!week.length)tips.push('这周没有留下做题记录。休息也是允许的，可以先聊聊最近过得怎么样，而不是问分数。');
 else if(kinds.helped)tips.push('看过提示再做对也是在学，不必追问“为什么要看提示”。');
 if(v.paused&&weekOffset===0)tips.push('孩子现在选择了暂停学习提醒。什么时候继续由孩子自己决定，不需要催。');

 return {
  overview:{
   planGoal:currentPlan?pretty(currentPlan.goal):null,planDeferred:currentPlan?.confirmation.action==='defer',
   monthGoal:stage?`${stage.module}：${stage.goal}`:null,paused:!!v.paused,
   skills:observed.map(s=>({name:pointName(s.knowledgePointId),label:skillStatusLabels[s.status],lastDate:s.trustedLearningDates.at(-1)??null})),
   unobserved:v.assessment.skills.length-observed.length,
   nextReview:reviews[0]?{name:pointName(reviews[0].knowledgePointId),dueDate:shanghaiDate(reviews[0].dueAt)}:null,activeReviews:reviews.length,
   levels:latest?latest.modules.map(m=>({module:m.module,label:MODULE_LEVEL_LABELS[m.level]})):null,levelsDate:latest?shanghaiDate(latest.createdAt):null,
  },
  week:{
   start,end,hasEarlier:attempts.some(a=>a.date<start)||v.problems.some(p=>shanghaiDate(p.confirmedAt)<start),
   days:[...new Set(week.map(a=>a.date))],attempts:week.length,kinds,changes,practising,
   problems:{count:problems.length,names:[...new Set(problems.map(p=>pointName(p.knowledgePointId)))]},
   plan:v.plans.map(p=>p.snapshot).filter(p=>inWeek(shanghaiDate(p.confirmation.confirmedAt))).map(p=>({date:shanghaiDate(p.confirmation.confirmedAt),action:actionLabels[p.confirmation.action]??p.confirmation.action})),
   confidence:cards.length?{more_sure:count('more_sure'),about_same:count('about_same'),still_unsure:count('still_unsure')}:null,
   levelChanges,tips,
  },
 };
}

/** 复制给家长群/自己留存的文字版；内容与页面一致，不多带任何字段。 */
export function digestText(d:GuardianDigest){
 const w=d.week,o=d.overview,lines=[`学伴小N · 每周学习小结（${shortDate(w.start)}–${shortDate(w.end)}）`];
 lines.push(w.attempts?`学习 ${w.days.length} 天，做了 ${w.attempts} 道题，其中新题独立做对 ${w.kinds.independent} 道。`:'这周没有留下做题记录。');
 for(const c of w.changes)lines.push(`变化：${c.name}，${shortDate(c.fromDate)}${c.fromLabel} → ${shortDate(c.toDate)}新题独立做对。`);
 for(const p of w.practising)lines.push(`还在练：${p.name}（这周有 ${p.count} 次还没做对）。`);
 for(const c of w.levelChanges)lines.push(`专业模式测评：${c.module} ${c.from} → ${c.to}。`);
 if(w.problems.count)lines.push(`记下错题 ${w.problems.count} 道（${w.problems.names.join('、')}）。`);
 if(o.monthGoal)lines.push(`本月目标：${o.monthGoal}`);
 if(o.planGoal)lines.push(`当前计划：${o.planGoal}${o.planDeferred?'（孩子选择了暂不开始）':''}`);
 if(o.nextReview)lines.push(`下一次复习：${o.nextReview.name}，${shortDate(o.nextReview.dueDate)}起。`);
 for(const t of w.tips)lines.push(`家长可以这样聊：${t}`);
 lines.push('只覆盖在小N里做过的题，不代表整体成绩；不包含聊天、倾诉和孩子写下的原话。');
 return lines.join('\n');
}
