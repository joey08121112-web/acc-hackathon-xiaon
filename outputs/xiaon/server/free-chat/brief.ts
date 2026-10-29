/** 回话时附在自由聊提示词后面的「关于这个同学」：只挑要紧的几条，控制在 BRIEF_MAX 字以内。
 * “以前喜欢”的兴趣不放进来，免得小N 主动提起学生已经不喜欢的事。 */
import type { Profile, ProfileItem, ProfileKind } from '../../shared/free-chat';
export const BRIEF_MAX=600;
const LIMITS:Record<ProfileKind,number>={about:4,interest:6,recent:4,method:3};
const LABELS:Record<ProfileKind,string>={about:'关于他',interest:'最近喜欢',recent:'最近的事',method:'对他有用的学习方法'};
const day=(iso:string)=>new Date(iso).toLocaleDateString('zh-CN',{month:'long',day:'numeric',timeZone:'Asia/Shanghai'});
const line=(item:ProfileItem)=>item.kind==='recent'?`${item.text}（${day(item.createdAt)}记下的）`:item.text;
export function profileBrief(profile:Profile):string{
 const{nickname,grade}=profile.basic;
 const facts=[nickname&&`可以叫他“${nickname}”`,grade&&`读${grade}`].filter(Boolean).join('，');
 // items 已按最近提到排好序；每类取前几条，超长就从最后一类往前删。
 const groups=(Object.keys(LIMITS) as ProfileKind[]).map(kind=>({kind,items:profile.items.filter(i=>i.kind===kind&&i.status==='active').slice(0,LIMITS[kind]).map(line)}));
 const render=()=>[facts&&`- ${facts}`,...groups.filter(g=>g.items.length).map(g=>`- ${LABELS[g.kind]}：${g.items.join('；')}`)].filter(Boolean).join('\n');
 let body=render();
 for(let k=groups.length-1;body.length>BRIEF_MAX&&k>=0;){if(groups[k].items.length)groups[k].items.pop();else k--;body=render();}
 if(!body)return '';
 return `关于这个同学（他自己填的，或者之前聊天时记下的）：
${body}

这些只是背景。自然地用上，比如举例时用他喜欢的东西，或者顺口关心一下最近的事；不用每句都提，也不要说“我记得你的档案里写着”。如果他现在说的和这里不一样，以他现在说的为准。`;
}
