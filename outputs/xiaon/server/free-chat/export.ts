/** 档案导出：把「小N 记了我什么」原样交出来。
 *
 * 2026-11-21 加。未成年人也有知情权和拿到自己数据的权利 —— 但「知道存在」不等于「拿得走」，
 * 所以这里给的是一份完整、可读、机器可解析的副本，不是界面截图。
 *
 * 包含：基本信息、当前条目（含溯源：哪段对话、哪句原话）、被新版本取代的旧条目、删掉过的内容、
 * 每一段对话。排除：程序保管的参考答案（problemSecrets）—— 那是判题用的秘密，不属于「关于学生」的档案。
 */
import { MESSAGE_KEEP_DAYS } from '../../shared/free-chat';
import type { FreeChatStore } from './store';

export type FreeChatExport={
  exportedAt:string;
  scope:'free-chat-profile';
  note:string;
  basic:{nickname:string;grade:string};
  autoRemember:boolean;
  autoRememberConfigured:boolean;
  items:ReturnType<FreeChatStore['profile']>['items'];
  supersededItems:ReturnType<FreeChatStore['itemHistory']>;
  forgotten:{kind:string;text:string;deletedAt:string}[];
  threads:{threadId:string;startedAt:string;preview:string;messageCount:string|number}[];
  messages:{threadId:string;role:string;content:string;createdAt:string}[];
  retention:{conversationKeepDays:number};
};

export function exportFreeChat(store:FreeChatStore):FreeChatExport{
 const profile=store.profile();
 const threads=store.threads() as {threadId:string;startedAt:string;preview:string;messageCount:number}[];
 const messages=threads.flatMap(t=>store.historyPage(t.threadId).messages.map(m=>({threadId:t.threadId,role:m.role,content:m.content,createdAt:m.createdAt})));
 return{
  exportedAt:profile.now,
  scope:'free-chat-profile',
  note:'这是小N 目前关于你的全部记录。items 里带 evidenceQuote 的条目，附着你当时说过的原话，可以对照着看。',
  basic:profile.basic,
  autoRemember:profile.autoRemember,
  autoRememberConfigured:profile.autoRememberConfigured,
  items:profile.items,
  supersededItems:store.itemHistory(),
  forgotten:store.forgotten(),
  threads,
  messages,
  retention:{conversationKeepDays:MESSAGE_KEEP_DAYS},
 };
}
