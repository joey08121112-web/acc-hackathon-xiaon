/** 安全判定关键词表。浏览器与服务端共用同一份。
 *
 * 为什么放 shared/：前端用它把学生刚说的话先标成「需要优先处理」
 * （src/components/learning/ChatPanel.tsx），服务端用它决定切到 safety 阶段
 * （server/core/stages.ts）。两边各写一份就会出现「前端以为拦住了、服务端没当回事」
 * 或者反过来这种偏差 —— 同一个孩子的同一句话，只因为在哪一层判断就不一样。
 */
export const SAFETY_PATTERN =
  /自杀|不想活|想死|去死|自残|割腕|结束生命|伤害自己|活着(?:没|没有)意思|跳楼/;
