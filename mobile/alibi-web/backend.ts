import { request } from "./bridge";
const backend = { story: { listCharacters: () => request({ type: "characters" }) } };
export function useBackend() { return backend; }
