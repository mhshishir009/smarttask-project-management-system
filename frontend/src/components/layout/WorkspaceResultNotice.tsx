import { Link, useLocation, useSearchParams } from "react-router-dom";

// Keep a selected result visible after navigation, with an explicit way back to the full list.
export default function WorkspaceResultNotice({ field }: {field: string}) {
  const [params] = useSearchParams();
  const location = useLocation();
  if (!params.get(field)) return null;
  return <p role="status" className="text-sm text-slate-500">Showing workspace search result. <Link to={location.pathname} className="font-medium text-blue-600 hover:text-blue-700">Clear search</Link></p>;
}
