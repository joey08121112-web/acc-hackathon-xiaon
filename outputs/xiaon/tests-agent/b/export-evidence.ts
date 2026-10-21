/** Optional reproducible SYNTHETIC evidence export; never touches application data. */
import { existsSync,writeFileSync } from 'node:fs';
import { fixture } from './fixtures';
const output=process.argv[2];if(!output)throw new Error('Provide a B delivery JSON output path');
if(existsSync(output))throw new Error('Refusing to overwrite existing evidence');
const f=fixture();
try{
 f.open('bracket');await f.grade(f.submit('bracket','x-5'));
 f.expose('bracket','hint');await f.grade(f.submit('bracket','x+5'));
 const assisted=await f.snapshot();
 f.nextDay();f.open('bracket');await f.grade(f.submit('bracket','x+5'));
 f.open('transfer');await f.grade(f.submit('transfer','4*a+2'));
 const firstIndependent=await f.snapshot();
 f.nextDay('2026-10-22T02:00:00.000Z');f.open('b-neg-delayed');await f.grade(f.submit('b-neg-delayed','12-3x'));
 const crossSession=await f.snapshot();
 f.open('calc-0');await f.grade(f.submit('calc-0','3x-1'));
 const recentDifficulty=await f.snapshot();
 const trace={fixture:'SYNTHETIC_ONLY',schemaVersion:'1.0.0',providerKind:'offline',sessions:f.repository.list('sessions'),exposures:f.repository.list('exposures'),attempts:f.repository.list('attempts'),evidence:f.repository.list('evidence'),gradings:f.repository.list('gradings'),snapshots:{assisted,firstIndependent,crossSession,recentDifficulty}};
 writeFileSync(output,JSON.stringify(trace,null,2)+'\n');
 console.log(JSON.stringify({fixture:trace.fixture,attempts:trace.attempts.length,states:Object.fromEntries(Object.entries(trace.snapshots).map(([name,snapshot])=>[name,snapshot.skills.find(s=>s.knowledgePointId==='negative-brackets')?.status])),recentDifficulty:recentDifficulty.skills.find(s=>s.knowledgePointId==='negative-brackets')?.recentDifficulty}));
}finally{f.dispose();}
