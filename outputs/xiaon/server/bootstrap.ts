import { resolve } from 'node:path';
import type { Clock,LearningRepository,ModelProvider,EngineRegistration,EngineContext,AssessmentEnginePort,PlanningEnginePort } from '../shared/learning-contracts';
import { SqliteRepository } from './storage/repository';
import { LegacyImporter } from './storage/import-legacy';
import { systemClock } from './core/clock';
import { StudentEvents } from './core/events';
import { AgentRuntime } from './core/agent';
import { LegacyAssessment,legacyTasks } from './tools/legacy';
import { ToolRegistry } from './tools/registry';
import { OfflineProvider,GlmProvider } from './providers/glm';
import { readGlmConfig,GLM_DEFAULTS } from './providers/config';
import { HedgedProvider } from './providers/hedge';
import { RuntimeError } from './core/errors';
import { FreeChatStore } from './free-chat/store';
export function createRuntime(options:{repository?:LearningRepository;databasePath?:string;clock?:Clock;provider?:ModelProvider;engines?:EngineRegistration;modelTimeoutMs?:number}={}){
 const repository=options.repository??new SqliteRepository(options.databasePath??resolve('.local/learning.sqlite'));const clock=options.clock??systemClock;
 // 自由聊和学习记录同一个文件、不同的表；只给了 repository 没给路径（测试）时用内存库。
 const freeChat=new FreeChatStore(options.databasePath??(options.repository?':memory:':resolve('.local/learning.sqlite')),clock);
 const engines:EngineRegistration={assessment:new LegacyAssessment(),...options.engines};
 const provider=options.provider??new OfflineProvider();
 const ctx=():EngineContext=>({repository,clock,catalog:engines.assessment!.catalog});
 repository.transaction(()=>{for(const task of legacyTasks)repository.append('tasks',task);});
 const events=new StudentEvents(ctx);const tools=new ToolRegistry(ctx,()=>engines,events);const agent=new AgentRuntime(ctx,provider,tools,events,options.modelTimeoutMs??GLM_DEFAULTS.timeoutMs);const importer=new LegacyImporter(ctx);
 return{repository,freeChat,clock,provider,events,tools,agent,importer,get catalog(){return ctx().catalog;},context:()=>events.context(),engineContext:ctx,
  registerAssessment(engine:AssessmentEnginePort){engines.assessment=engine;},registerPlanning(engine:PlanningEnginePort){engines.planning=engine;},
  assessment():AssessmentEnginePort{return engines.assessment!;},planning():PlanningEnginePort{if(!engines.planning)throw new RuntimeError('not_implemented','C planning 引擎尚未注册');return engines.planning;},
 };
}
export type LearningRuntime=ReturnType<typeof createRuntime>;
/** One provider shared by every user's runtime; it holds no learning data. */
export function providerFromEnvironment(){
 const config=readGlmConfig();
 const provider:ModelProvider=config.apiKey?new HedgedProvider(new GlmProvider(config.apiKey,config.model,fetch,config),config.hedgeMs):new OfflineProvider();
 return{provider,modelTimeoutMs:config.timeoutMs};
}
