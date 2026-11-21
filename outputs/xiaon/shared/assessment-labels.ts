/** Browser-safe labels only. Trusted answers/rubrics live in the server plugin. */
import type { SkillState } from './learning-contracts';
export const skillStatusLabels:Record<SkillState['status'],string>={
 unobserved:'尚未观察',needs_support:'需要支持',completed_with_help:'提示后完成',
 first_independent:'首次独立完成',cross_session_independent:'跨次独立完成',
};
/** 证据类别的值域。单一来源：视图契约（shared/views.ts 的 AttemptClassification.kind）
 * 与界面文案都从这里取，不在两处各写一份清单。 */
export const evidenceKindValues=['new_independent','completed_with_help','corrected_original','original_redo','incorrect','pending','unknown'] as const;
export type EvidenceKind=typeof evidenceKindValues[number];
export const evidenceKindLabels={
 new_independent:'新题独立完成',completed_with_help:'提示后完成',corrected_original:'原题修改正确',
 original_redo:'原题重做',incorrect:'本次结果未通过',pending:'待核查',unknown:'信息不足',
} as const satisfies Record<EvidenceKind,string>;
export const assessmentScopeNotice='只说明已观察子技能；不代表整体五维能力、智力、人格或长期教学效果。';
