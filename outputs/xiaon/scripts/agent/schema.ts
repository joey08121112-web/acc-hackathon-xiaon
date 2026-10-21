import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { schemas, SCHEMA_VERSION } from '../../shared/learning-contracts';
export const document = {$schema:'https://json-schema.org/draft/2020-12/schema',$id:'urn:xiaon:learning:'+SCHEMA_VERSION,description:'A frozen schema '+SCHEMA_VERSION,$defs:Object.fromEntries(Object.entries(schemas).flatMap(([name,schema])=>name==='ToolArguments'?Object.entries(schemas.ToolArguments).map(([tool,s])=>['ToolArguments_'+tool,z.toJSONSchema(s)]):[[name,z.toJSONSchema(schema as z.ZodType)]]))};
if(process.argv[1]?.endsWith('schema.ts'))writeFileSync('shared/learning-contracts.schema.json',JSON.stringify(document,null,2)+'\n');
