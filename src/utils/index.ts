import type { MkdistOptions } from "../make";

export function getOutputExtension(options: MkdistOptions) {
  const isCjs = options.format === "cjs";
  let ext = isCjs ? ".js" : ".mjs"; // TODO: Default to .cjs in next major version
  if (options.ext) {
    ext = options.ext.startsWith(".") ? options.ext : `.${options.ext}`;
  }
  return ext;
}
