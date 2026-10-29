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
