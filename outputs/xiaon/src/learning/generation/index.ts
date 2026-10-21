/** Browser-safe E1 labels. Templates, prompts, answers and validators stay on the server. */
import type { GenerationRecord } from '../../../shared/learning-contracts';
export const GENERATION_KNOWLEDGE_POINTS=['negative-brackets','like-terms'] as const;
export type GenerationKnowledgePoint=typeof GENERATION_KNOWLEDGE_POINTS[number];
export const isGenerationKnowledgePoint=(id:string):id is GenerationKnowledgePoint=>(GENERATION_KNOWLEDGE_POINTS as readonly string[]).includes(id);
export const focusLabels:Record<string,string>={
 bracket_sign_constant:'括号前是减号时，括号里的常数要变号',bracket_sign_variable:'括号前是减号时，括号里的字母项也要变号',
 bracket_plus_inside:'括号里是加号时，去括号后变成减',bracket_constant_outside:'括号外只有常数时，字母项单独变号',
 combine_after_expand:'去括号后再合并两组同类项',combine_coefficients:'把同一字母的系数相加',
 combine_with_negatives:'带负号的同类项一起合并',separate_constants:'常数和字母项分开合并',
};
export const basisLabels:Record<GenerationRecord['basis'],string>={
 no_evidence:'还没有这个环节的作答记录：这是按课程范围的可选基础题，不是诊断',
 difficulty:'依据：你在这个环节最近一次作答还有困难',help_dependence:'依据：你在这个环节最近是看提示后完成的',
 independent:'依据：你在这个环节已有独立完成的记录',review_due:'依据：这个环节的复习已到期',
};
export const difficultyLabels:Record<string,string>={introductory:'入门',standard:'标准',stretch:'稍有挑战'};
export const reasonLabels:Record<string,string>={
 schema_invalid:'格式不符合要求',tool_call_not_allowed:'试图调用工具',knowledge_point_mismatch:'知识点不对',difficulty_not_allowed:'难度不在允许范围',
 params_invalid:'参数不完整',params_out_of_range:'数字超出范围',degenerate_variable_cancels:'字母项会完全抵消',degenerate_constant_cancels:'常数会完全抵消',
 not_covering_target:'没有覆盖目标环节',expression_mismatch:'题面与模板不一致',answer_mismatch:'答案不对',steps_invalid:'中间步骤不等价',
 steps_final_mismatch:'最后一步没有化简到结果',grader_unsupported:'判题程序无法核对',duplicate_content:'和已有的题重复',
 evidence_reference_invalid:'引用了不存在的记录',focus_not_allowed:'针对的环节不匹配',
};
export const generationNotice='新出的题是同一类题换了数字，由程序按模板计算和核对；做对只说明这一类题，不代表更广泛的迁移。';
