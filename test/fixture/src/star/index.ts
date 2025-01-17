export * from "./other";
export type { Other } from "./other";

export function wonder(twinkle: import("./other").Other): string {
  return twinkle;
}
