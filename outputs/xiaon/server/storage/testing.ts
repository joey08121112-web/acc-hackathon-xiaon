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
/** A port the OS just assigned (listen on 0), so tests never collide with the lanes' fixed dev ports (e.g. 18951–18954). */
export async function freePort():Promise<number>{
 const { createServer }=await import('node:net');const server=createServer();
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve());});
 const port=(server.address() as {port:number}).port;await new Promise<void>(resolve=>server.close(()=>resolve()));return port;
}
