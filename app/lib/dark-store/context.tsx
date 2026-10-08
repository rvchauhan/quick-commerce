import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { configureDarkStoreClient, resetDarkStoreClient } from "./api";
import type { ApiUser } from "./types";

export type DarkStoreAppContext =
  | {
      apiUrl: string;
      token: string;
      user: ApiUser;
      business: { id: string; name: string };
      configured: true;
    }
  | {
      configured: false;
      error: string | null;
    };

const Ctx = createContext<DarkStoreAppContext>({
  configured: false,
  error: "Dark Store session not loaded",
});

export function DarkStoreProvider({
  value,
  children,
}: {
  value: DarkStoreAppContext;
  children: ReactNode;
}) {
  // Configure synchronously during render so child effects/fetches never race
  // ahead of the partner JWT (useEffect would be too late).
  if (value.configured) {
    configureDarkStoreClient({ apiUrl: value.apiUrl, token: value.token });
  } else {
    resetDarkStoreClient();
  }

  const memo = useMemo(() => value, [value]);

  return <Ctx.Provider value={memo}>{children}</Ctx.Provider>;
}

export function useDarkStore() {
  return useContext(Ctx);
}
