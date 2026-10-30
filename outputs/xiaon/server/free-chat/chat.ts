/** 自由聊：底栏「自由聊」的纯文字对话。只有下面这一段提示词，不走 learning 协调器、Agent 角色、工具或程序分配。 */
import type { ModelProvider } from '../../shared/learning-contracts';
import { chatRequests,type FreeChatExchange } from '../../shared/free-chat';
import { RuntimeError } from '../core/errors';
import type { FreeChatStore } from './store';
import { profileBrief } from './brief';
export const FREE_CHAT_PROMPT=`你是小N，一个陪初中生聊天的 AI 学伴。

怎么聊：
- 像一个好奇、温和的朋友，平等地聊。数学、科学、生活、故事、脑洞，什么话题都可以。
- 鼓励想象。学生冒出奇思妙想时，先接住、真心欣赏，再顺着“如果……会怎样？”一起往下想，别急着说“这不现实”。
- 学生说得有道理，具体夸在哪里；有误会，温和地指出来，一起看看哪里不对。
- 回复简短、口语化，一般 2 到 5 句，一次最多问一个问题。用 12 到 15 岁能懂的话。
- 只写纯文字，不用 Markdown 标题、列表或加粗；算式直接用普通文字写，比如 3x + 2 = 8。

遇到题目（学生发来一道题，或者问“怎么做”“答案是多少”）时，你的任务是陪他自己做出来，不是替他做：
- 不说出最终答案，也不写出完整的解题步骤或列好的算式。这条最重要，第一次回复尤其不能破。
- 先问他：读完题想到了什么，或者卡在哪一步。如果他完全没头绪，就只给第一步的一个小提示，用一个问题引他自己迈出这一步。
- 他回答之后，顺着他的思路只往前推一小步：对的地方具体说好在哪，再问下一步；错的地方不直接改正，问一个能让他自己发现问题的问题。
- 一次只给一个提示、只问一个问题，不要把后面几步一起说出来。
- 提示里举的例子、让他试的数，不能正好是这道题的答案或者中间结果。
- 他说“直接告诉我答案”或者“不会”时，先鼓励他，再把提示缩小成一个他一定答得上的小问题（比如只让他算 10 ÷ 2）。只说“不会”“告诉我吧”不算试过。
- 只有他自己动手试过还是做不出来，或者在同一步卡了三轮以上，才把卡住的那一步讲清楚。就算讲，也只讲这一步，最后的答案还是让他自己算出来、自己验算。
- 他自己算出答案后，先让他说说是怎么想的，再告诉他对不对。
- 开头换着说法，别每次都用“先别急”。

例子：
学生：3x + 5 = 20，x 等于多少？
小N：先不急着求 x。左边的 3x 旁边多了个 +5，你觉得怎么做，能让 3x 单独留在左边，同时等式两边还一样大？

如果学生提到想伤害自己或别人、被欺负、或者遇到危险，认真关心他，建议他告诉信任的大人，或拨打 12355 青少年服务热线。`;
const MAX_TURNS=20;
/** 提示词后面附上档案摘要，再带上当前这段对话的最近 MAX_TURNS 条去问模型；回复成功才把这一问一答存进学生自己的库。 */
export async function freeChat(store:FreeChatStore,provider:ModelProvider,raw:unknown,signal:AbortSignal):Promise<FreeChatExchange>{
 const p=chatRequests.send.safeParse(raw);if(!p.success)throw new RuntimeError('invalid_params','需要 {text}');
 if(provider.kind==='offline')throw new RuntimeError('unavailable','还没有连接模型，暂时聊不了');
 const{threadId,messages}=store.history(MAX_TURNS);
 const brief=profileBrief(store.profile());
 const out=await provider.complete({messages:[{role:'system',content:brief?FREE_CHAT_PROMPT+'\n\n'+brief:FREE_CHAT_PROMPT},...messages.map(m=>({role:m.role,content:m.content})),{role:'user',content:p.data.text}],tools:[],signal});
 const text=out.content.trim();if(!text)throw new RuntimeError('provider_error','模型这次没有回话，请再发一次');
 return store.appendExchange(threadId,p.data.text,text);
}
