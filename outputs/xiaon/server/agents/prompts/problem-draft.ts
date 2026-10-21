/** 所有者：zCode（改造二：说出卡点 / 错题记录）。阶段 0 只给最小可用文本；程序只在 probe 阶段拼上这一块。 */
export const PROBLEM_DRAFT_PROMPT={version:'problem-draft-g0',text:[
 '【本轮可以整理一条错题记录草稿】',
 '只有学生已经口述了具体哪道题、怎么做的、卡在哪时，才输出problemDraft；信息不够就继续问，不输出。',
 'problemDraft格式：{"source":"spoken","questionText":"题目原文或null","studentWork":"学生的做法或null","knowledgePointId":"math-language|counterexample|negative-brackets|like-terms|fixed-variable-cost|rotation-2d|other","stuckQuote":"逐字抄学生说的卡点原话","stuckPointId":"本轮或之前record_stuck_point返回的卡点id，没有就null","catalogTask":null}。',
 '不写参考答案，不判断对错；草稿要学生确认后程序才保存。',
].join('\n')} as const;
