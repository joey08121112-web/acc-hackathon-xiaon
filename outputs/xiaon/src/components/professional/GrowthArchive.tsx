/** 所有者：ChatGPT（第二期：成长档案）。挂载位与 props 由 Claude 第二期契约补丁定（见 交付/claude/CONTRACT-PHASE2.md）；桩阶段返回 null。
 * 数据：GET learning/trend（apiRequest<TrendQuery>('learning/trend')，zCode 的 tracking 插件），按月串上同月的 l.view.summaries、l.view.progressCards。 */
import type { LearningUI } from '../../agents/useLearning';
/** 挂在 LearningPages page==='growth'，错题列表之后。 */
export type GrowthArchiveProps={l:LearningUI;navigate:(page:string,tab?:string)=>void};
export function GrowthArchive(props:GrowthArchiveProps){void props;return null;}
