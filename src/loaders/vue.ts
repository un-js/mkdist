import type { SFCBlock } from "vue/compiler-sfc";
import type {
  InputFile,
  Loader,
  LoaderContext,
  LoaderResult,
  OutputFile,
} from "../loader";
import { transpileVueTemplate } from "../utils/vue";

export interface DefineVueLoaderOptions {
  blockLoaders?: {
    [blockType: string]: VueBlockLoader | undefined;
  };
}

export type VueBlock = Pick<SFCBlock, "type" | "content" | "attrs">;

export interface VueBlockLoader {
  (
    block: VueBlock,
    context: LoaderContext & {
      rawInput: InputFile;
      addOutput: (...files: OutputFile[]) => void;
    },
  ): Promise<VueBlock | undefined>;
}

export interface DefaultBlockLoaderOptions {
  type: "script" | "style" | "template";
  outputLang: string;
  defaultLang?: string;
  validExtensions?: string[];
}

export function defineVueLoader(options?: DefineVueLoaderOptions): Loader {
  const blockLoaders = options?.blockLoaders || {};

  return async (input, context) => {
    if (input.extension !== ".vue") {
      return;
    }

    const { compileScript, parse } = await import("vue/compiler-sfc");

    let modified = false;
    let fakeScriptBlock = false;

    const raw = await input.getContents();
    const sfc = parse(raw, {
      filename: input.srcPath,
      ignoreEmpty: true,
    });
    if (sfc.errors.length > 0) {
      for (const error of sfc.errors) {
        console.error(error);
      }
      return;
    }

    const output: LoaderResult = [];
    const addOutput = (...files: OutputFile[]) => output.push(...files);

    const blocks: VueBlock[] = [
      ...sfc.descriptor.styles,
      ...sfc.descriptor.customBlocks,
    ].filter((item) => !!item);

    // we need to transpile script when using <script setup> and typescript
    // and we need to transpile template because <template> can't access variables in setup after transpiled
    const requireTranspile = !!sfc.descriptor.scriptSetup?.lang;

    // we also need to remove typescript from template block
    const requireTranspileTemplate = [
      sfc.descriptor.script,
      sfc.descriptor.scriptSetup,
    ].some((block) => !!block?.lang);

    if (sfc.descriptor.template && !requireTranspile) {
      if (requireTranspileTemplate) {
        const transformed = await transpileVueTemplate(
          // for lower version of @vue/compiler-sfc, `ast.source` is the whole .vue file
          sfc.descriptor.template.content,
          sfc.descriptor.template.ast,
          async (code) => {
            const res = await context.loadFile({
              getContents: () => code,
              path: `${input.path}.ts`,
              srcPath: `${input.srcPath}.ts`,
              extension: ".ts",
            });

            return (
              res.find((f) => [".js", ".mjs", ".cjs"].includes(f.extension))
                ?.contents || code
            );
          },
        );
        blocks.unshift({
          type: "template",
          content: transformed,
          attrs: sfc.descriptor.template.attrs,
        });
      } else {
        blocks.unshift(sfc.descriptor.template);
      }
    }

    if (requireTranspile) {
      // merge script blocks and template block
      const merged = compileScript(sfc.descriptor, {
        id: input.srcPath,
        inlineTemplate: true,
      });
      merged.setup = false;
      merged.attrs = toOmit(merged.attrs, "setup");
      blocks.unshift(merged);
    } else {
      const scriptBlocks = [
        sfc.descriptor.script,
        sfc.descriptor.scriptSetup,
      ].filter((item) => !!item);
      blocks.unshift(...scriptBlocks);

      if (scriptBlocks.length === 0) {
        // push a fake script block to generate dts
        blocks.unshift({
          type: "script",
          content: "export default {}",
          attrs: {},
        });
        fakeScriptBlock = true;
      }
    }

    const results = await Promise.all(
      blocks.map(async (data) => {
        const blockLoader = blockLoaders[data.type];
        const result = await blockLoader?.(data, {
          ...context,
          rawInput: input,
          addOutput,
        });
        if (result) {
          modified = true;
        }
        return result || data;
      }),
    );

    if (!modified) {
      return;
    }

    const contents = results
      .map((block) => {
        if (block.type === "script" && fakeScriptBlock) {
          return undefined;
        }

        const attrs = Object.entries(block.attrs)
          .map(([key, value]) => {
            if (!value) {
              return undefined;
            }

            return value === true ? key : `${key}="${value}"`;
          })
          .filter((item) => !!item)
          .join(" ");

        const header = `<${`${block.type} ${attrs}`.trim()}>`;
        const footer = `</${block.type}>`;

        return `${header}\n${cleanupBreakLine(block.content)}\n${footer}\n`;
      })
      .filter((item) => !!item)
      .join("\n");
    addOutput({
      path: input.path,
      srcPath: input.srcPath,
      extension: ".vue",
      contents,
      declaration: false,
    });

    return output;
  };
}

export function defineDefaultBlockLoader(
  options: DefaultBlockLoaderOptions,
): VueBlockLoader {
  return async (block, { loadFile, rawInput, addOutput }) => {
    if (options.type !== block.type) {
      return;
    }

    const lang =
      typeof block.attrs.lang === "string"
        ? block.attrs.lang
        : options.outputLang;
    const extension = `.${lang}`;

    const files =
      (await loadFile({
        getContents: () => block.content,
        path: `${rawInput.path}${extension}`,
        srcPath: `${rawInput.srcPath}${extension}`,
        extension,
      })) || [];

    const blockOutputFile = files.find(
      (f) =>
        f.extension === `.${options.outputLang}` ||
        options.validExtensions?.includes(f.extension as string),
    );
    if (!blockOutputFile?.contents) {
      return;
    }
    addOutput(...files.filter((f) => f !== blockOutputFile));

    return {
      type: block.type,
      attrs: toOmit(block.attrs, "lang"),
      content: blockOutputFile.contents,
    };
  };
}

const styleLoader = defineDefaultBlockLoader({
  outputLang: "css",
  type: "style",
});

const scriptLoader = defineDefaultBlockLoader({
  outputLang: "js",
  type: "script",
  validExtensions: [".js", ".mjs"],
});

export const vueLoader = defineVueLoader({
  blockLoaders: {
    style: styleLoader,
    script: scriptLoader,
  },
});

function cleanupBreakLine(str: string): string {
  return str.replaceAll(/(\n\n)\n+/g, "\n\n").replace(/^\s*\n|\n\s*$/g, "");
}
function toOmit<R extends Record<keyof object, unknown>, K extends keyof R>(
  record: R,
  toRemove: K,
): Omit<R, K> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== toRemove),
  ) as Omit<R, K>;
}
