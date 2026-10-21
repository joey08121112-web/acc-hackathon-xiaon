/** 所有者：Claude（阶段 0 冻结）。四个改版插件（problems、memory-flow、progress、conversation）共用的上下文与输入类型。改动走契约变更申请。 */
import type { AgentRun,ChatMessage,ChatObservation,ChatStage,EngineContext,LearningEpisode,ModelContentPart,ModelProvider } from '../../shared/learning-contracts';
import type { StudentEvents } from '../core/events';
import { RuntimeError } from '../core/errors';
/** One traced, tool-less model response. Offline → throws unavailable; the coordinator records the AgentRun. */
export interface ModelCall { operationId:string;prompt:{version:string;text:string};data:unknown;parts?:ModelContentPart[];timeoutMs?:number }
export interface RevampContext extends EngineContext {
 /** remember(), memoryEnabled(), context(), sessions(): the same audited student-event entry points the A/D routes use. */
 events:StudentEvents;
 providerKind:ModelProvider['kind'];
 memoryEnabled():boolean;
 model(call:ModelCall,signal?:AbortSignal):Promise<{content:string;run:AgentRun}>;
}
/** Program check inputs for model-proposed fields. studentTexts are this chat session's student messages (verbatim). */
export interface FieldCheck { sessionId:string;stage:ChatStage;studentTexts:string[] }
export interface ObservationCheck extends FieldCheck { probeAllowed:boolean;existing:ChatObservation[] }
export interface MemoryDraftCheck extends FieldCheck { memoryEnabled:boolean;origin:'chat'|'progress_card' }
export interface ProgressDraftInput { sessionId:string;episode:LearningEpisode|null;studentTexts:string[];candidate:unknown }
export interface EndConversationInput { operationId:string;sessionId:string;trigger:'student_end'|'farewell';history:ChatMessage[] }
export interface MemoryOfferInput { sessionId:string;stage:ChatStage;turn:number }
export const notImplemented=(name:string)=>new RuntimeError('not_implemented',name+' 尚未实现（阶段 0 桩）');
