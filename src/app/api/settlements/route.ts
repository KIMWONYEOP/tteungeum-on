import { parseBody, respond } from '@/server/http';
import { commandSchema } from '@/server/schemas';
import { applyCommand } from '@/server/commands';
import { HttpError } from '@/server/auth';
export async function POST(request:Request){return respond(async()=>{const command=await parseBody(request,commandSchema);if(!['generateSettlement','updateSettlement'].includes(command.type))throw new HttpError(400,'정산 요청이 아닙니다.');return {result:await applyCommand(command)};});}
