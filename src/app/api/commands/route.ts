import { respond, parseBody } from '@/server/http';
import { commandSchema } from '@/server/schemas';
import { applyCommand } from '@/server/commands';
export async function POST(request:Request){return respond(async()=>({result:await applyCommand(await parseBody(request,commandSchema))}));}
