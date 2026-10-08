import { Outlet } from "react-router";

/** Layout for /app/stores, /app/stores/new, and /app/stores/:storeId */
export default function StoresLayout() {
  return <Outlet />;
}
