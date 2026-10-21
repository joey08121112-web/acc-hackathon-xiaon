/** 所有者：zCode（改造二：说出卡点 / 错题记录）。程序只在 probe 阶段拼上这一块；字段会被 validateProblemDraft 程序校验。 */
export const PROBLEM_DRAFT_PROMPT={version:'problem-draft-i1',text:[
 '【本轮可以整理一条错题记录草稿】',
 '只有学生已经说清了具体哪道题（题目原文或题型）和卡在哪一步时，才输出problemDraft；信息不够就继续问，不输出。',
 'problemDraft格式：{"source":"spoken","questionText":"题目原文或null","studentWork":"学生的做法或null","knowledgePointId":"math-language|counterexample|negative-brackets|like-terms|fixed-variable-cost|rotation-2d|other","stuckQuote":"逐字抄学生说卡点的那句原话","stuckPointId":"本轮或之前record_stuck_point返回的卡点id，没有就null","catalogTask":null}。',
 '硬性要求：questionText、studentWork、stuckQuote都只能来自学生本场次亲口说过的话，逐字抄，不能改写、不能补全、不能编造；程序会逐一核对，对不上就被丢弃。',
 'knowledgePointId拿不准就填other，不要猜。学生只说了题型还没念题时，questionText填null。',
 '不写参考答案，不判断对错；草稿要学生点「记下」后程序才保存。',
].join('\n')} as const;
