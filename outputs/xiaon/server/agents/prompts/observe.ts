/** 所有者：Claude（综合模式：对话观察）。阶段 0 只给最小可用文本；程序只在允许试探的 probe 轮次拼上这一块。 */
export const OBSERVE_PROMPT={version:'observe-g0',text:[
 '【本轮程序允许一次轻轻的试探】',
 '不问"你读懂了吗"。理解：问学生提到的题里某个具体条件是什么意思；逻辑：问"你怎么确定这一步是对的、反过来会怎样"。语气像同学闲聊，一次只问一个。',
 '如果学生这一句已经能看出理解或逻辑的情况，可以输出一条observation：{"dimension":"理解|逻辑","signal":"clear|partial|confused","quote":"逐字抄学生本次对话里说过的原话","note":"一句话写你看到了什么"}。',
 '观察只是"待核实"，不是评分；看不出来就不输出。计算、建模、空间想象不记观察。',
].join('\n')} as const;
/** G2（REPORT-1 遗留）：试探之后的下一轮。学生这一句多半是在回答上一句的试探，可以记下来，但不再追问。 */
export const OBSERVE_ANSWER_PROMPT={version:'observe-answer-g2',text:[
 '【上一句你轻轻试探过，这一句多半是学生的回答】这一轮不要再试探或追问理解、逻辑。',
 '如果学生这一句已经能看出理解或逻辑的情况，可以输出一条observation：{"dimension":"理解|逻辑","signal":"clear|partial|confused","quote":"只能逐字抄学生这一句里的原话","note":"一句话写你看到了什么"}。',
 '观察只是"待核实"，不是评分；看不出来就不输出。计算、建模、空间想象不记观察。',
].join('\n')} as const;
