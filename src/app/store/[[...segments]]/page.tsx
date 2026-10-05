import { requireArea } from '@/server/auth';
import { Workspace } from '@/components/workspace';
export default async function StorePage({params}:{params:Promise<{segments?:string[]}>}){await requireArea('store');const {segments=[]}=await params;return <Workspace area="store" segments={segments}/>;}
