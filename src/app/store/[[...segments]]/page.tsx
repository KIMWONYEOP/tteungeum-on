import { Workspace } from '@/components/workspace';
export default async function StorePage({params}:{params:Promise<{segments?:string[]}>}){const {segments=[]}=await params;return <Workspace area="store" segments={segments}/>;}
