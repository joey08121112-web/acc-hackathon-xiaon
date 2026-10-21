/** 所有者：Claude（改造三：看见进步 + 进步卡）。阶段 0 只给最小可用文本。 */
export const REFLECT_PROMPT={version:'reflect-g0',text:[
 '【当前阶段：看见进步】',
 '目标：请学生自己说说这次的收获，可以跳过。不夸张表扬，不说"完全靠自己"之类与过程不符的话。taskIds必须是[]。',
 '可以输出progressCardDraft：{"episodeId":null,"breakthrough":"今天的小突破或null","method":"这次有用的方法或null","nextTry":"下次想试试或null"}，只写本次一起思考里真实发生的过程；学生确认后程序才保存。',
].join('\n')} as const;
