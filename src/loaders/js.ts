import { transform } from "esbuild";
import jiti from "jiti";
import { basename, extname } from "pathe";

import type { Loader, LoaderResult } from "../loader";

const DECLARATION_RE = /\.d\.[cm]?ts$/;
const CM_LETTER_RE = /(?<=\.)(c|m)(?=[jt]s$)/;

const KNOWN_EXT_RE = /\.(c|m)?[jt]sx?$/;

const TS_EXTS = new Set([".ts", ".mts", ".cts"]);

export const jsLoader: Loader = async (input, { options }) => {
  if (!KNOWN_EXT_RE.test(input.path) || DECLARATION_RE.test(input.path)) {
    return;
  }

  const output: LoaderResult = [];

  let contents = await input.getContents();
  let sourceMapping = "";

  // declaration
  if (options.declaration && !input.srcPath?.match(DECLARATION_RE)) {
    const cm = input.srcPath?.match(CM_LETTER_RE)?.[0] || "";
    const extension = `.d.${cm}ts`;
    output.push({
      contents,
      srcPath: input.srcPath,
      path: input.path,
      extension,
      declaration: true,
    });
  }

  // typescript => js
  const sourcemap =
    options.esbuild?.sourcemap === "linked"
      ? "external"
      : options.esbuild?.sourcemap;
  if (TS_EXTS.has(input.extension)) {
    const result = await transform(contents, {
      ...options.esbuild,
      sourcemap,
      sourcefile: input.srcPath,
      loader: "ts",
    });
    contents = result.code;
    sourceMapping = result.map;
  } else if ([".tsx", ".jsx"].includes(input.extension)) {
    const result = await transform(contents, {
      loader: input.extension === ".tsx" ? "tsx" : "jsx",
      ...options.esbuild,
      sourcemap,
      sourcefile: input.srcPath,
    });
    contents = result.code;
    sourceMapping = result.map;
  }

  // esm => cjs
  const isCjs = options.format === "cjs";
  if (isCjs) {
    contents = jiti("")
      .transform({ source: contents, retainLines: false })
      .replace(/^exports.default = /gm, "module.exports = ")
      .replace(/^var _default = exports.default = /gm, "module.exports = ")
      .replace("module.exports = void 0;", "");
  }

  let extension = isCjs ? ".js" : ".mjs"; // TODO: Default to .cjs in next major version
  if (options.ext) {
    extension = options.ext.startsWith(".") ? options.ext : `.${options.ext}`;
  }

  // sourcemap
  if (options.esbuild?.sourcemap && sourceMapping !== "") {
    if (options.esbuild.sourcemap !== "inline") {
      output.push({
        contents: sourceMapping,
        path: input.path,
        extension: `${extension}.map`,
      });
    }

    if (options.esbuild.sourcemap === "linked") {
      const sourceMappingURL = `${basename(input.path, extname(input.path))}${extension}.map`;
      contents += `\n//# sourceMappingURL=${sourceMappingURL}`;
    }
  }

  output.push({
    contents,
    path: input.path,
    extension,
  });

  return output;
};
