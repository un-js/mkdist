import { statSync } from "node:fs";
import { findStaticImports, findExports, findTypeExports } from "mlly";
import { resolve } from "pathe";
import type { TSConfig } from "pkg-types";
import type { MkdistOptions } from "../make";
import { getOutputExtension } from "./index";
import type { CompilerHost, EmitResult } from "typescript";

export async function normalizeCompilerOptions(
  _options: TSConfig["compilerOptions"],
) {
  const ts = await import("typescript").then((r) => r.default || r);
  return ts.convertCompilerOptionsFromJson(_options, process.cwd()).options;
}

export type DeclarationOutput = Record<
  string,
  { contents: string; errors?: Error[] }
>;

export async function getDeclarations(
  vfs: Map<string, string>,
  opts?: MkdistOptions,
): Promise<DeclarationOutput> {
  const ts = await import("typescript").then((r) => r.default || r);

  const inputFiles = [...vfs.keys()];

  const tsHost = ts.createCompilerHost(opts.typescript.compilerOptions);

  tsHost.writeFile = (fileName: string, declaration: string) => {
    vfs.set(fileName, declaration);
  };
  const _readFile = tsHost.readFile;
  tsHost.readFile = (filename) => {
    if (vfs.has(filename)) {
      return vfs.get(filename);
    }
    return _readFile(filename);
  };

  const program = ts.createProgram(
    inputFiles,
    opts.typescript.compilerOptions,
    tsHost,
  );
  const result = program.emit();
  const output = extractDeclarations(vfs, inputFiles, opts);
  augmentWithDiagnostics(result, output, tsHost, ts);

  return output;
}

const JS_EXT_RE = /\.(m|c)?(ts|js)$/;
const JSX_EXT_RE = /\.(m|c)?(ts|js)x?$/;
const RELATIVE_RE = /^\.{1,2}[/\\]/;

export function extractDeclarations(
  vfs: Map<string, string>,
  inputFiles: string[],
  opts?: MkdistOptions,
): DeclarationOutput {
  const output: DeclarationOutput = {};

  for (const filename of inputFiles) {
    const dtsFilename = filename.replace(JSX_EXT_RE, ".d.$1ts");
    let contents = vfs.get(dtsFilename) || "";
    if (opts?.addRelativeDeclarationExtensions) {
      const srcExt =
        filename.match(JS_EXT_RE)?.[0].replace(/ts$/, "js") || ".js";
      const ext = getOutputExtension(opts);

      const imports = findStaticImports(contents);
      const exports = findExports(contents);
      const typeExports = findTypeExports(contents);
      for (const spec of [...exports, ...typeExports, ...imports]) {
        if (!spec.specifier || !RELATIVE_RE.test(spec.specifier)) {
          continue;
        }
        const srcPath = resolve(filename, "..", spec.specifier);
        const srcDtsPath = srcPath + srcExt.replace(JS_EXT_RE, ".d.$1ts");

        let specifier = spec.specifier;
        try {
          if (!vfs.get(srcDtsPath)) {
            const stat = statSync(srcPath);
            if (stat.isDirectory()) {
              specifier += "/index";
            }
          }
        } catch {
          // src file does not exists
        }
        // add file extension for relative paths (`.js` will match the `.d.ts` extension we emit)
        contents = contents.replace(
          spec.code,
          spec.code.replace(spec.specifier, specifier + ext),
        );
      }
    }
    output[filename] = { contents };

    vfs.delete(filename);
  }

  return output;
}

export function augmentWithDiagnostics(
  result: EmitResult,
  output: DeclarationOutput,
  tsHost: CompilerHost,
  ts: typeof import("typescript"),
) {
  if (result.diagnostics?.length) {
    for (const diagnostic of result.diagnostics) {
      const filename = diagnostic.file?.fileName;
      if (filename in output) {
        output[filename].errors = output[filename].errors || [];
        output[filename].errors.push(
          new TypeError(ts.formatDiagnostics([diagnostic], tsHost), {
            cause: diagnostic,
          }),
        );
      }
    }
    console.error(ts.formatDiagnostics(result.diagnostics, tsHost));
  }
}
