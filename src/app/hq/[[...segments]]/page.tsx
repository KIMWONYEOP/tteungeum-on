import { requireArea } from '@/server/auth';
import { Workspace } from '@/components/workspace';
export default async function HqPage({params}:{params:Promise<{segments?:string[]}>}){await requireArea('hq');const {segments=[]}=await params;return <Workspace area="hq" segments={segments}/>;}
