/**
 * GitHub 凭据管理
 *
 * PAT 只存浏览器：localStorage（记住本设备）或 sessionStorage（仅本次会话）。
 * 绝不进入构建产物，也绝不写入仓库。
 */
const TOKEN_KEY = "easydocument:token";
const REMEMBER_KEY = "easydocument:token-remember";

export interface StoredToken {
  token: string;
  remembered: boolean;
}

export function loadToken(): StoredToken | null {
  if (typeof window === "undefined") return null;
  const remembered = window.localStorage.getItem(TOKEN_KEY);
  if (remembered) return { token: remembered, remembered: true };
  const session = window.sessionStorage.getItem(TOKEN_KEY);
  if (session) return { token: session, remembered: false };
  return null;
}

export function saveToken(token: string, remember: boolean) {
  clearToken();
  const storage = remember ? window.localStorage : window.sessionStorage;
  storage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
}

export function clearToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(TOKEN_KEY);
}

export function wasRemembered(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(REMEMBER_KEY) === "1";
}

/** 只显示首尾，避免日志/截图泄露 */
export function maskToken(token: string): string {
  if (token.length <= 12) return "****";
  return `${token.slice(0, 7)}…${token.slice(-4)}`;
}
