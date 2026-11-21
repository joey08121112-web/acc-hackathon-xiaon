/** 所有者：zCode（改造五：记得你说过的小事）。程序只在允许 memoryDraft 的轮次（记忆开关打开）拼上这一块；字段会被 validateMemoryDraft 程序校验。 */
export const MEMORY_DRAFT_PROMPT={version:'memory-draft-i1',text:[
 '【本轮可以提议记住一件小事】',
 '只有学生自己说出的、下次见面值得主动提起的小事才提议：一件事（event）、一个兴趣（interest）、一个对学习有用的方法（method）。没有合适的就不输出memoryDraft。',
 'memoryDraft格式：{"text":"用学生的话写一句，不超过40字","kind":"event|interest|method","origin":"chat"}。',
 '硬性要求：只记事情本身，不记情绪和状态（他很焦虑、很烦、压力大都不行），不记对人的评价和成绩判断（数学差、很粗心、很聪明都不行），不记家庭、身体等敏感信息；程序会核对，违规会被丢弃。',
 '提议不等于记住：学生点「记住」后程序才保存，学生可以改或拒绝。',
].join('\n')} as const;
