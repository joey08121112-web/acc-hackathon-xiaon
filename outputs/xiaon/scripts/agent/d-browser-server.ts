/** Test-only service: synthetic data/model and injectable clock, never loaded by server/index.ts. */
import { temporaryRepository,TestClock } from '../../server/storage/testing';
import { createRuntime } from '../../server/bootstrap';
import { installLearning } from '../../server/agents/learning';
import { createHttpServer } from '../../server/http/server';
import { ScenarioProvider } from '../../tests-agent/d/provider';
const port=Number(process.env.XIAON_D_API_PORT??18931),ui=Number(process.env.XIAON_D_UI_PORT??5194);
const clock=new TestClock(),f=temporaryRepository(clock),provider=new ScenarioProvider(),r=createRuntime({...f,provider});installLearning(r,{timeoutMs:800});
const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[`http://127.0.0.1:${ui}`]});
const listener=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',(req,res)=>{if(req.url?.startsWith('/__test/')){
 if(req.headers['x-xiaon-test']!=='synthetic-d-only'){res.writeHead(403);res.end();return;}
 const url=new URL(req.url,'http://127.0.0.1');res.setHeader('Content-Type','application/json');
 if(url.pathname==='/__test/advance'){const days=Number(url.searchParams.get('days'));if(!Number.isFinite(days)||days<0||days>30){res.writeHead(400);res.end();return;}clock.advance(days*86400000);res.end(JSON.stringify({now:clock.now()}));return;}
 if(url.pathname==='/__test/provider'){provider.mode=url.searchParams.get('mode') as typeof provider.mode;res.end('{}');return;}
 if(url.pathname==='/__test/messages'){res.end(JSON.stringify(provider.messages));return;}
 if(url.pathname==='/__test/reset'){r.repository.reset!();clock.set('2026-10-21T00:00:00.000Z');provider.messages=[];provider.mode='normal';res.end('{}');return;}
 res.writeHead(404);res.end();return;
 }listener.call(server,req,res);});
server.listen(port,'127.0.0.1',()=>console.log(`D synthetic test API ${port}`));
process.once('SIGTERM',()=>{server.close(()=>{f.dispose();process.exit(0);});server.closeAllConnections();});
