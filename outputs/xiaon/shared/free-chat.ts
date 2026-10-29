/** 自由聊的个人档案契约（服务端与前端共用）。跟 learning-contracts 分开：档案是新做的，不复用旧记忆。 */
import { z } from 'zod';
export const PROFILE_KINDS=['about','interest','recent','method'] as const;
export type ProfileKind=typeof PROFILE_KINDS[number];
/** 近况默认记多久；兴趣多久没提到就算“以前喜欢”；删掉的内容记多久（整理时不再加回）。 */
export const RECENT_DAYS=14,INTEREST_COOL_DAYS=60,FORGOTTEN_DAYS=90;
export const ITEM_TEXT_MAX=60,ITEMS_PER_KIND_MAX=30;
export type ProfileItem={
 id:string;kind:ProfileKind;text:string;status:'active'|'past';source:'chat'|'student';
 firstMentionedAt:string;lastMentionedAt:string;mentionCount:number;expiresAt:string|null;editedByStudent:boolean;
 createdAt:string;updatedAt:string;
};
export type ProfileBasic={nickname:string;grade:string};
export type Profile={basic:ProfileBasic;items:ProfileItem[];autoRemember:boolean;now:string};
const itemText=z.string().trim().min(1).max(ITEM_TEXT_MAX);
const itemId=z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
export const profileRequests={
 item:z.discriminatedUnion('action',[
  z.strictObject({action:z.literal('add'),kind:z.enum(PROFILE_KINDS),text:itemText}),
  z.strictObject({action:z.literal('update'),id:itemId,text:itemText}),
  z.strictObject({action:z.literal('status'),id:itemId,status:z.enum(['active','past'])}),
  z.strictObject({action:z.literal('delete'),id:itemId}),
 ]),
 basic:z.strictObject({nickname:z.string().trim().max(20),grade:z.string().trim().max(20)}),
 settings:z.strictObject({autoRemember:z.boolean()}),
};
export type ProfileItemRequest=z.infer<typeof profileRequests.item>;
/** 对话：存在服务器上，一段对话（thread）从「重新开始」算起。 */
export const MESSAGE_TEXT_MAX=2000;
export type FreeChatMessage={id:string;role:'user'|'assistant';content:string;createdAt:string};
export type FreeChatHistory={threadId:string|null;messages:FreeChatMessage[]};
export type FreeChatExchange={threadId:string;user:FreeChatMessage;reply:FreeChatMessage};
export const chatRequests={
 send:z.strictObject({text:z.string().trim().min(1).max(MESSAGE_TEXT_MAX)}),
 newThread:z.strictObject({}),
 digestSeen:z.strictObject({runId:itemId}),
 consolidate:z.strictObject({}),
};
/** 记忆整理：空闲时把还没整理的对话交给模型，按操作更新档案。原始对话整理后保留 MESSAGE_KEEP_DAYS 天。 */
export const MESSAGE_KEEP_DAYS=30;
export type ConsolidationChange={op:'add'|'mention'|'update'|'past';itemId:string;kind:ProfileKind;text:string};
/** 最近一次整理里学生还没看过的结果（只含新增和更新）。 */
export type Digest={runId:string;changes:ConsolidationChange[]};
export type DigestResponse={digest:Digest|null;consolidating:boolean};
export type ConsolidateResult={status:'ok'|'failed'|'skipped'|'empty'|'off';changes:ConsolidationChange[];profile:Profile};
