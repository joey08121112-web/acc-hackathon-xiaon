/** Compile-only D registration example, never auto-registers into production. */
import { RubricAssessment,createModelAnalyzer } from '../../server/plugins/assessment';
import type { LearningRuntime } from '../../server/bootstrap';
import type { AssessmentEnginePort,ModelProvider } from '../../shared/learning-contracts';
import { skillStatusLabels,evidenceKindLabels } from '../../src/learning/assessment';
export function registerAssessmentExample(runtime:LearningRuntime,assessorProvider?:ModelProvider):AssessmentEnginePort {
 const engine=new RubricAssessment(assessorProvider?{analyzer:createModelAnalyzer(assessorProvider)}:{});
 runtime.registerAssessment(engine);return engine;
}
export const browserLabelConsumer={first:skillStatusLabels.first_independent,redo:evidenceKindLabels.original_redo};
