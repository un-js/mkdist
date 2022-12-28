import { transform } from "esbuild";
import jiti from "jiti";

import type { Loader, LoaderResult } from "../loader";

const DECLARATION_RE = /\.d\.[cm]?ts$/;
const CM_LETTER_RE = /(?<=\.)(c|m)(?=[jt]s$)/;

export const jsLoader: Loader = async (input, { options }) => {
  if (![".ts", ".js", ".cjs", ".mjs"].includes(input.extension) || DECLARATION_RE.test(input.path)) {
    return;
  }

  const output: LoaderResult = [];

  let contents = await input.getContents();

  // declaration
  if (options.declaration) {
    const cm = input.srcPath?.match(CM_LETTER_RE)?.[0] || "";
    const extension = `.d.${cm}ts`;
    output.push({
      contents,
      srcPath: input.srcPath,
      path: input.path,
      type: "dts",
      extension
    });
  }

  // typescript => js
  if (input.extension === ".ts") {
    contents = await transform(contents, { loader: "ts" }).then(r => r.code);
  }

  // esm => cjs
  const isCjs = options.format === "cjs";
  if (isCjs) {
    contents = jiti("").transform({ source: contents, retainLines: false })
      .replace(/^exports.default = /gm, "module.exports = ");
  }

  output.push({
    contents,
    path: input.path,
    type: isCjs ? "cjs" : "mjs",
    extension: options.ext ? `.${options.ext}` : (isCjs ? ".js" : ".mjs")
  });

  return output;
};
