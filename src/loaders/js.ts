import { transform } from "esbuild";
import jiti from "jiti";

import type { Loader, LoaderResult } from "../loader";

const DECLARATION_RE = /\.d\.[cm]?ts$/;
const CM_LETTER_RE = /(?<=\.)(c|m)(?=[jt]s$)/;

const KNOWN_EXT_RE = /\.(c|m)?[jt]sx?$/;
const VUE_EXT_RE = /\.vue\.[jt]s$/;

const TS_EXTS = new Set([".ts", ".mts", ".cts"]);

export const jsLoader: Loader = async (input, { options }) => {
  if (!KNOWN_EXT_RE.test(input.path) || DECLARATION_RE.test(input.path)) {
    return;
  }

  const output: LoaderResult = [];

  let contents = await input.getContents();

  const isCjs = options.format === "cjs";
  let extension = isCjs ? ".js" : ".mjs"; // TODO: Default to .cjs in next major version
  if (options.ext) {
    extension = options.ext.startsWith(".") ? options.ext : `.${options.ext}`;
  }

  // declaration
  if (options.declaration && !input.srcPath?.match(DECLARATION_RE)) {
    const cm = extension.match(CM_LETTER_RE)?.[0] || "";
    // Vue files always create .vue.d.ts declarations
    // No matter what the corresponding js file uses as an extension
    const isVue = VUE_EXT_RE.test(input.path);
    output.push({
      contents,
      srcPath: input.srcPath,
      path: input.path,
      extension: isVue ? ".d.ts" : `.d.${cm}ts`,
      declaration: true,
    });
  }

  // typescript => js
  if (TS_EXTS.has(input.extension)) {
    contents = await transform(contents, {
      ...options.esbuild,
      loader: "ts",
    }).then((r) => r.code);
  } else if ([".tsx", ".jsx"].includes(input.extension)) {
    contents = await transform(contents, {
      loader: input.extension === ".tsx" ? "tsx" : "jsx",
      ...options.esbuild,
    }).then((r) => r.code);
  }

  // esm => cjs
  if (isCjs) {
    contents = jiti("")
      .transform({ source: contents, retainLines: false })
      .replace(/^exports.default = /gm, "module.exports = ")
      .replace(/^var _default = exports.default = /gm, "module.exports = ")
      .replace("module.exports = void 0;", "");
  }

  output.push({
    contents,
    path: input.path,
    extension,
  });

  return output;
};
