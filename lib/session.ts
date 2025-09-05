import { cookies } from "next/headers";

const ACCESS = "sp_access_token";
const REFRESH = "sp_refresh_token";

export function setTokens(access_token: string, refresh_token: string) {
  const c = cookies();
  c.set(ACCESS, access_token, { httpOnly: true, sameSite: "lax", path: "/" });
  c.set(REFRESH, refresh_token, { httpOnly: true, sameSite: "lax", path: "/" });
}

export function getTokens() {
  const c = cookies();
  return {
    access: c.get(ACCESS)?.value || "",
    refresh: c.get(REFRESH)?.value || ""
  };
}

export function clearTokens() {
  const c = cookies();
  c.delete(ACCESS);
  c.delete(REFRESH);
}
