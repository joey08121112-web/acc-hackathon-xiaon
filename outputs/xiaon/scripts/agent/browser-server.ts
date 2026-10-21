/** A-only synthetic browser fixture. Never used by npm run server. */
import { createRuntime } from '../../server/bootstrap';
import { temporaryRepository } from '../../server/storage/testing';
import { SyntheticProvider } from '../../server/providers/synthetic';
import { createHttpServer } from '../../server/http/server';
const f=temporaryRepository();const port=Number(process.env.XIAON_A_BROWSER_API_PORT??18923);const ui=Number(process.env.XIAON_A_BROWSER_PORT??5191);
const r=createRuntime({...f,provider:new SyntheticProvider()});const server=createHttpServer(r,{host:`127.0.0.1:${port}`,allowedOrigins:[`http://127.0.0.1:${ui}`]});
server.listen(port,'127.0.0.1',()=>console.log('A synthetic fixture ready'));
function shutdown(){server.close(()=>{f.dispose();process.exit(0);});server.closeAllConnections();}process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
