/** D integration example only; importing this module does not register or start any service. */
import type { LearningRuntime } from '../../bootstrap';
import { PlanningEngine } from './index';

export function registerPlanningExample(runtime:LearningRuntime) {
 const planning=new PlanningEngine();
 runtime.registerPlanning(planning);
 return planning;
}
