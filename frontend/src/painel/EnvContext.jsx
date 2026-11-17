import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const KEY = "radar-painel-env";
export const ENV_OPTIONS = [
  { value: "production", label: "Produção" },
  { value: "staging", label: "Teste" },
];
const VALID = ENV_OPTIONS.map((o) => o.value);

function readEnv() {
  try {
    const v = sessionStorage.getItem(KEY);
    if (VALID.includes(v)) return v;
  } catch (e) { /* ignore */ }
  return "production";
}

const EnvContext = createContext({ env: "production", setEnv: () => {} });

export function EnvProvider({ children }) {
  const [env, setEnvState] = useState(readEnv);
  const setEnv = useCallback((v) => {
    if (!VALID.includes(v)) return;
    setEnvState(v);
    try { sessionStorage.setItem(KEY, v); } catch (e) { /* ignore */ }
  }, []);
  const value = useMemo(() => ({ env, setEnv }), [env, setEnv]);
  return <EnvContext.Provider value={value}>{children}</EnvContext.Provider>;
}

export function useEnv() {
  return useContext(EnvContext);
}
