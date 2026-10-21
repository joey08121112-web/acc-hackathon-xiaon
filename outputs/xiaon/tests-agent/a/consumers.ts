/** Compile-only separate B/C consumer examples. These intentionally unavailable stubs are NOT implementations. */
import type { AssessmentEnginePort,PlanningEnginePort,TaskCatalog,EngineContext,AssessmentSnapshot,PlanProposal,ReviewItem,PlanVersion,ReportSnapshot,ReviewOutcome } from '../../shared/learning-contracts';
import { RuntimeError } from '../../server/core/errors';
import type { LearningRuntime } from '../../server/bootstrap';
export function assessmentConsumer(catalog:TaskCatalog):AssessmentEnginePort{
 return {id:'b-compile-example',catalog,async grade(_input:{attemptId:string;operationId:string},_context:EngineContext){throw new RuntimeError('not_implemented');},async snapshot(_input:{operationId:string},_context:EngineContext):Promise<AssessmentSnapshot>{throw new RuntimeError('not_implemented');}};
}
export const planningConsumer:PlanningEnginePort={
 id:'c-compile-example',
 async due(_input:{at:string;includePaused:boolean},_context:EngineContext):Promise<ReviewItem[]>{throw new RuntimeError('not_implemented');},
 async recordOutcome(_input:ReviewOutcome,_context:EngineContext):Promise<ReviewItem[]>{throw new RuntimeError('not_implemented');},
 async propose(_input:{operationId:string;assessment:AssessmentSnapshot;timeBudgetMinutes:number},_context:EngineContext):Promise<PlanProposal>{throw new RuntimeError('not_implemented');},
 async confirm(_input:Parameters<PlanningEnginePort['confirm']>[0],_context:EngineContext):Promise<PlanVersion>{throw new RuntimeError('not_implemented');},
 async report(_input:Parameters<PlanningEnginePort['report']>[0],_context:EngineContext):Promise<ReportSnapshot>{throw new RuntimeError('not_implemented');},
};
export function registerExample(runtime:LearningRuntime,b:AssessmentEnginePort,c:PlanningEnginePort){runtime.registerAssessment(b);runtime.registerPlanning(c);}
