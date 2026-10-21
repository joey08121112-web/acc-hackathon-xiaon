import type { Clock,SourceTime } from '../../shared/learning-contracts';
export const systemClock:Clock={now:()=>new Date().toISOString()};
export function serverTime(clock:Clock):SourceTime{return{occurredAt:clock.now(),recordedAt:clock.now(),timezone:'Asia/Shanghai',trust:'server',legacyLabel:null};}
export class TestClock implements Clock {
  constructor(private instant='2026-10-21T00:00:00.000Z'){}
  now(){return this.instant;}
  advance(milliseconds:number){this.instant=new Date(Date.parse(this.instant)+milliseconds).toISOString();}
  set(instant:string){this.instant=new Date(instant).toISOString();}
}
