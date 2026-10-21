/** 所有者：zCode（改造五：记忆已关提示）。阶段 0 桩组件：先返回 null，挂载位与 props 已冻结（见 交付/claude/CONTRACT.md）。 */
/** where：home = 首页，progress_card = 进步卡处。去打开记忆走 navigate('memory')。 */
export type MemoryOffNoticeProps={memoryEnabled:boolean;where:'home'|'progress_card';navigate:(page:string,tab?:string)=>void};
export function MemoryOffNotice(props:MemoryOffNoticeProps){void props;return null;}
