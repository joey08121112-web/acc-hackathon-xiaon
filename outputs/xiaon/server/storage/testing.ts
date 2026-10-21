/** Synthetic fixtures only. Each caller gets its own on-disk SQLite database. */
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteRepository } from './repository';
import { TestClock } from '../core/clock';
import type { Clock } from '../../shared/learning-contracts';
export function temporaryRepository(clock:Clock=new TestClock()){
 const directory=mkdtempSync(join(tmpdir(),'xiaon-agent-test-'));const databasePath=join(directory,'learning.sqlite');const repository=new SqliteRepository(databasePath);
 return{repository,clock,databasePath,directory,dispose(){repository.close();rmSync(directory,{recursive:true,force:true});}};
}
export { TestClock };
