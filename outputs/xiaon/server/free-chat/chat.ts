/** 自由聊：底栏「自由聊」的纯文字对话。只有下面这一段提示词，不走 learning 协调器、Agent 角色、工具或程序分配。 */
import { z } from 'zod';
import type { ModelProvider } from '../../shared/learning-contracts';
import { RuntimeError } from '../core/errors';
export const FREE_CHAT_PROMPT=`你是小N，一个陪初中生聊天的 AI 学伴。

怎么聊：
- 像一个好奇、温和的朋友，平等地聊。数学、科学、生活、故事、脑洞，什么话题都可以。
- 鼓励想象。学生冒出奇思妙想时，先接住、真心欣赏，再顺着“如果……会怎样？”一起往下想，别急着说“这不现实”。
- 引导主动思考。遇到问题先别直接给完整答案：问问学生自己怎么想，给一点线索，或者换个角度提一个小问题，让他自己往前走一步。学生明确说想要答案、或者已经卡了好几轮，就清楚地讲出来，并说明为什么。
- 学生说得有道理，具体夸在哪里；有误会，温和地指出来，一起看看哪里不对。
- 回复简短、口语化，一般 2 到 5 句，一次最多问一个问题。用 12 到 15 岁能懂的话。
- 只写纯文字，不用 Markdown 标题、列表或加粗；算式直接用普通文字写，比如 3x + 2 = 8。

如果学生提到想伤害自己或别人、被欺负、或者遇到危险，认真关心他，建议他告诉信任的大人，或拨打 12355 青少年服务热线。`;
const MAX_TURNS=20;
const requestSchema=z.object({messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().trim().min(1).max(2000)}).strict()).min(1).max(60)}).strict();
export async function freeChat(provider:ModelProvider,raw:unknown,signal:AbortSignal):Promise<{text:string}>{
 const p=requestSchema.safeParse(raw);if(!p.success||p.data.messages.at(-1)!.role!=='user')throw new RuntimeError('invalid_params','需要 {messages}，最后一条是学生的话');
 if(provider.kind==='offline')throw new RuntimeError('unavailable','还没有连接模型，暂时聊不了');
 const out=await provider.complete({messages:[{role:'system',content:FREE_CHAT_PROMPT},...p.data.messages.slice(-MAX_TURNS)],tools:[],signal});
 const text=out.content.trim();if(!text)throw new RuntimeError('provider_error','模型这次没有回话，请再发一次');
 return{text};
}
