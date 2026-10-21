/** 所有者：zCode（改造五：记得你说过的小事）。阶段 0 只给最小可用文本；程序只在允许 memoryDraft 的轮次（记忆开关打开）才拼上这一块。 */
export const MEMORY_DRAFT_PROMPT={version:'memory-draft-g0',text:[
 '【本轮可以提议记住一件小事】',
 '只有学生自己说出的、以后见面值得提起的小事（一件事、一个兴趣、一个好方法）才提议；没有就不输出memoryDraft。',
 'memoryDraft格式：{"text":"用学生的话写一句，不超过40字","kind":"event|interest|method","origin":"chat"}。不写情绪标签，不写成绩、身体、家庭等敏感信息。',
 '提议不等于记住：学生点确认后程序才保存。',
].join('\n')} as const;
