import { mkdirSync } from 'node:fs';
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
import { RuntimeError } from './core/errors';
export function createRuntime(options:{repository?:LearningRepository;databasePath?:string;clock?:Clock;provider?:ModelProvider;engines?:EngineRegistration;modelTimeoutMs?:number}={}){
 const repository=options.repository??new SqliteRepository(options.databasePath??resolve('.local/learning.sqlite'));const clock=options.clock??systemClock;
 const engines:EngineRegistration={assessment:new LegacyAssessment(),...options.engines};
 const provider=options.provider??new OfflineProvider();
 const ctx=():EngineContext=>({repository,clock,catalog:engines.assessment!.catalog});
 repository.transaction(()=>{for(const task of legacyTasks)repository.append('tasks',task);});
 const events=new StudentEvents(ctx);const tools=new ToolRegistry(ctx,()=>engines,events);const agent=new AgentRuntime(ctx,provider,tools,events,options.modelTimeoutMs??GLM_DEFAULTS.timeoutMs);const importer=new LegacyImporter(ctx);
 return{repository,clock,provider,events,tools,agent,importer,get catalog(){return ctx().catalog;},context:()=>events.context(),engineContext:ctx,
  registerAssessment(engine:AssessmentEnginePort){engines.assessment=engine;},registerPlanning(engine:PlanningEnginePort){engines.planning=engine;},
  assessment():AssessmentEnginePort{return engines.assessment!;},planning():PlanningEnginePort{if(!engines.planning)throw new RuntimeError('not_implemented','C planning 引擎尚未注册');return engines.planning;},
 };
}
export type LearningRuntime=ReturnType<typeof createRuntime>;
export function runtimeFromEnvironment(){
 const path=resolve(process.env.XIAON_DB_PATH??'.local/learning.sqlite');mkdirSync(resolve(path,'..'),{recursive:true,mode:0o700});
 const config=readGlmConfig();
 return createRuntime({databasePath:path,provider:config.apiKey?new GlmProvider(config.apiKey,config.model,fetch,config):new OfflineProvider(),modelTimeoutMs:config.timeoutMs});
}
