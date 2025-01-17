import { readFile } from "node:fs/promises";
import { relative, resolve } from "pathe";
import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  beforeAll,
  afterAll,
} from "vitest";
import { createLoader } from "../src/loader";

describe("mkdist", () => {
  let mkdist: typeof import("../src/make").mkdist;

  beforeAll(async () => {
    mkdist = (await import("../src/make")).mkdist;
  });

  it("mkdist", async () => {
    const rootDir = resolve(__dirname, "fixture");
    const { writtenFiles } = await mkdist({ rootDir });
    expect(writtenFiles.sort()).toEqual(
      [
        "dist/README.md",
        "dist/bar.mjs",
        "dist/demo.css",
        "dist/dir-export.mjs",
        "dist/foo.mjs",
        "dist/foo.d.ts", // manual
        "dist/index.mjs",
        "dist/types.d.ts",
        "dist/star/index.mjs",
        "dist/star/other.mjs",
        "dist/components/index.mjs",
        "dist/components/blank.vue",
        "dist/components/js.vue",
        "dist/components/script-multi-block.vue",
        "dist/components/script-setup-ts.vue",
        "dist/components/ts.vue",
        "dist/components/jsx.mjs",
        "dist/components/tsx.mjs",
        "dist/bar/index.mjs",
        "dist/bar/esm.mjs",
        "dist/ts/test1.mjs",
        "dist/ts/test2.mjs",
        "dist/nested.css",
        "dist/prop-types/index.mjs",
      ]
        .map((f) => resolve(rootDir, f))
        .sort(),
    );
  });

  it("mkdist (custom glob pattern)", async () => {
    const rootDir = resolve(__dirname, "fixture");
    const { writtenFiles } = await mkdist({
      rootDir,
      pattern: "components/**",
    });
    expect(writtenFiles.sort()).toEqual(
      [
        "dist/components/index.mjs",
        "dist/components/blank.vue",
        "dist/components/js.vue",
        "dist/components/script-multi-block.vue",
        "dist/components/script-setup-ts.vue",
        "dist/components/ts.vue",
        "dist/components/jsx.mjs",
        "dist/components/tsx.mjs",
      ]
        .map((f) => resolve(rootDir, f))
        .sort(),
    );
  });

  it("mkdist (multiple glob patterns)", async () => {
    const rootDir = resolve(__dirname, "fixture");
    const { writtenFiles } = await mkdist({
      rootDir,
      pattern: ["components/**", "!components/js.vue"],
    });
    expect(writtenFiles.sort()).toEqual(
      [
        "dist/components/index.mjs",
        "dist/components/blank.vue",
        "dist/components/script-multi-block.vue",
        "dist/components/script-setup-ts.vue",
        "dist/components/ts.vue",
        "dist/components/jsx.mjs",
        "dist/components/tsx.mjs",
      ]
        .map((f) => resolve(rootDir, f))
        .sort(),
    );
  });

  it("mkdist (emit types)", async () => {
    const rootDir = resolve(__dirname, "fixture");
    const { writtenFiles } = await mkdist({
      rootDir,
      declaration: true,
      addRelativeDeclarationExtensions: true,
    });
    expect(writtenFiles.sort()).toEqual(
      [
        "dist/README.md",
        "dist/bar.d.ts",
        "dist/bar.mjs",
        "dist/demo.css",
        "dist/dir-export.d.ts",
        "dist/dir-export.mjs",
        "dist/foo.mjs",
        "dist/foo.d.ts",
        "dist/index.mjs",
        "dist/index.d.ts",
        "dist/star/index.mjs",
        "dist/star/index.d.ts",
        "dist/star/other.mjs",
        "dist/star/other.d.ts",
        "dist/types.d.ts",
        "dist/components/index.mjs",
        "dist/components/index.d.ts",
        "dist/components/blank.vue",
        "dist/components/blank.vue.d.ts",
        "dist/components/js.vue",
        "dist/components/js.vue.d.ts",
        "dist/components/script-multi-block.vue",
        "dist/components/script-multi-block.vue.d.ts",
        "dist/components/script-setup-ts.vue",
        "dist/components/script-setup-ts.vue.d.ts",
        "dist/components/ts.vue",
        "dist/components/ts.vue.d.ts",
        "dist/components/jsx.mjs",
        "dist/components/tsx.mjs",
        "dist/components/jsx.d.ts",
        "dist/components/tsx.d.ts",
        "dist/bar/index.mjs",
        "dist/bar/index.d.ts",
        "dist/bar/esm.mjs",
        "dist/bar/esm.d.mts",
        "dist/ts/test1.mjs",
        "dist/ts/test2.mjs",
        "dist/ts/test1.d.mts",
        "dist/ts/test2.d.cts",
        "dist/nested.css",
        "dist/prop-types/index.mjs",
        "dist/prop-types/index.d.ts",
      ]
        .map((f) => resolve(rootDir, f))
        .sort(),
    );

    expect(await readFile(resolve(rootDir, "dist/foo.d.ts"), "utf8")).toMatch(
      "manual declaration",
    );

    expect(await readFile(resolve(rootDir, "dist/star/index.d.ts"), "utf8"))
      .toMatchInlineSnapshot(`
        "export * from "./other.js";
        export type { Other } from "./other.js";
        "
      `);

    expect(await readFile(resolve(rootDir, "dist/dir-export.d.ts"), "utf8"))
      .toMatchInlineSnapshot(`
        "export { default as bar } from "./bar.js";
        export * from "./star/index.js";
        "
      `);

    expect(
      await readFile(resolve(rootDir, "dist/bar/esm.d.mts"), "utf8"),
    ).toMatch("declare");

    expect(
      await readFile(resolve(rootDir, "dist/components/index.d.ts"), "utf8"),
    ).toMatchInlineSnapshot(`
      "export * as jsx from "./jsx.jsx.js";
      export * as tsx from "./tsx.tsx.js";
      export * as blank from "./blank.vue.js";
      export * as scriptSetupTS from "./script-setup-ts.vue.js";
      export * as scriptMultiBlock from "./script-multi-block.vue.js";
      export * as ts from "./ts.vue.js";
      "
    `);

    expect(
      await readFile(resolve(rootDir, "dist/components/ts.vue.d.ts"), "utf8"),
    ).toMatchInlineSnapshot(`
      "declare const _default: import("vue").DefineComponent<{}, {}, {
          test: string;
          str: "test";
      }, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
      export default _default;
      "
    `);

    expect(
      await readFile(
        resolve(rootDir, "dist/components/blank.vue.d.ts"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(`
      "declare const _default: import("vue").DefineComponent<{}, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
      export default _default;
      "
    `);

    expect(
      await readFile(
        resolve(rootDir, "dist/components/script-multi-block.vue.d.ts"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(`
      "interface MyComponentProps {
          msg: string;
      }
      declare const _default: import("vue").DefineComponent<import("vue").ExtractPropTypes<__VLS_TypePropsToOption<MyComponentProps>>, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<__VLS_TypePropsToOption<MyComponentProps>>> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
      export default _default;
      type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;
      type __VLS_TypePropsToOption<T> = {
          [K in keyof T]-?: {} extends Pick<T, K> ? {
              type: import('vue').PropType<__VLS_NonUndefinedable<T[K]>>;
          } : {
              type: import('vue').PropType<T[K]>;
              required: true;
          };
      };
      "
    `);

    expect(
      await readFile(
        resolve(rootDir, "dist/components/script-setup-ts.vue.d.ts"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(`
      "import { Color } from "#prop-types";
      type __VLS_Props = {
          msg: string;
          color: Color;
      };
      declare const _default: import("vue").DefineComponent<import("vue").ExtractPropTypes<__VLS_TypePropsToOption<__VLS_Props>>, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<__VLS_TypePropsToOption<__VLS_Props>>> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
      export default _default;
      type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;
      type __VLS_TypePropsToOption<T> = {
          [K in keyof T]-?: {} extends Pick<T, K> ? {
              type: import('vue').PropType<__VLS_NonUndefinedable<T[K]>>;
          } : {
              type: import('vue').PropType<T[K]>;
              required: true;
          };
      };
      "
    `);
  }, 50_000);

  it("mkdist (emit sourcemaps)", async () => {
    const rootDir = resolve(__dirname, "fixture");
    const { writtenFiles } = await mkdist({
      rootDir,
      esbuild: {
        sourcemap: "linked",
      },
    });

    expect(writtenFiles.sort()).toEqual(
      [
        "dist/README.md",
        "dist/bar.mjs",
        "dist/bar.mjs.map",
        "dist/demo.css",
        "dist/dir-export.mjs",
        "dist/dir-export.mjs.map",
        "dist/foo.mjs",
        "dist/foo.d.ts",
        "dist/index.mjs",
        "dist/index.mjs.map",
        "dist/types.d.ts",
        "dist/star/index.mjs",
        "dist/star/index.mjs.map",
        "dist/star/other.mjs",
        "dist/star/other.mjs.map",
        "dist/components/index.mjs",
        "dist/components/index.mjs.map",
        "dist/components/blank.vue",
        "dist/components/js.vue",
        "dist/components/script-multi-block.vue",
        "dist/components/script-multi-block.vue.mjs.map",
        "dist/components/script-setup-ts.vue",
        "dist/components/script-setup-ts.vue.mjs.map",
        "dist/components/ts.vue",
        "dist/components/ts.vue.mjs.map",
        "dist/components/jsx.mjs",
        "dist/components/jsx.mjs.map",
        "dist/components/tsx.mjs",
        "dist/components/tsx.mjs.map",
        "dist/bar/index.mjs",
        "dist/bar/index.mjs.map",
        "dist/bar/esm.mjs",
        "dist/ts/test1.mjs",
        "dist/ts/test1.mjs.map",
        "dist/ts/test2.mjs",
        "dist/ts/test2.mjs.map",
        "dist/nested.css",
        "dist/prop-types/index.mjs",
        "dist/prop-types/index.mjs.map",
      ]
        .map((f) => resolve(rootDir, f))
        .sort(),
    );

    expect(await readFile(resolve(rootDir, "dist/index.mjs"), "utf8")).toMatch(
      /\n\/\/# sourceMappingURL=index.mjs.map$/,
    );

    expect(
      JSON.parse(await readFile(resolve(rootDir, "dist/bar.mjs.map"), "utf8"))
        .sourcesContent[0],
    ).toMatch(await readFile(resolve(rootDir, "src/bar.ts"), "utf8"));
  });

  describe("mkdist (sass compilation)", () => {
    const rootDir = resolve(__dirname, "fixture");
    let writtenFiles: string[];
    beforeEach(async () => {
      const results = await mkdist({ rootDir });
      writtenFiles = results.writtenFiles;
    });

    it("resolves local imports and excludes partials ", async () => {
      const css = await readFile(resolve(rootDir, "dist/demo.css"), "utf8");

      expect(writtenFiles).not.toContain("dist/_base.css");
      expect(css).toMatch("color: green");
    });

    it("resolves node_modules imports", async () => {
      const css = await readFile(resolve(rootDir, "dist/demo.css"), "utf8");
      expect(css).toMatch("box-sizing: border-box;");
    });

    it("compiles sass blocks in vue SFC", async () => {
      const vue = await readFile(
        resolve(rootDir, "dist/components/js.vue"),
        "utf8",
      );

      expect(vue).toMatch("color: green;\n  background-color: red;");
    });
  });

  it("mkdist (only jsLoader and vueLoader)", async () => {
    const rootDir = resolve(__dirname, "fixture");
    const { writtenFiles } = await mkdist({
      rootDir,
      loaders: ["js", "vue"],
    });
    expect(writtenFiles.sort()).toEqual(
      [
        "dist/README.md",
        "dist/bar.mjs",
        "dist/demo.scss",
        "dist/_base.scss",
        "dist/dir-export.mjs",
        "dist/foo.mjs",
        "dist/foo.d.ts", // manual
        "dist/index.mjs",
        "dist/types.d.ts",
        "dist/star/index.mjs",
        "dist/star/other.mjs",
        "dist/components/index.mjs",
        "dist/components/blank.vue",
        "dist/components/js.vue",
        "dist/components/script-multi-block.vue",
        "dist/components/script-setup-ts.vue",
        "dist/components/ts.vue",
        "dist/components/jsx.mjs",
        "dist/components/tsx.mjs",
        "dist/bar/index.mjs",
        "dist/bar/esm.mjs",
        "dist/ts/test1.mjs",
        "dist/ts/test2.mjs",
        "dist/nested.css",
        "dist/prop-types/index.mjs",
      ]
        .map((f) => resolve(rootDir, f))
        .sort(),
    );
  });

  describe("createLoader", () => {
    it("loadFile returns undefined for an unsupported file", async () => {
      const { loadFile } = createLoader();
      const results = await loadFile({
        extension: ".noth",
        getContents: () => new Error("this should not be called") as any,
        path: "another.noth",
      });
      expect(results).toMatchObject([{ raw: true }]);
    });

    it("vueLoader handles no transpilation of script tag", async () => {
      const { loadFile } = createLoader({
        loaders: ["vue"],
      });
      const results = await loadFile({
        extension: ".vue",
        getContents: () => "<script>Test</script>",
        path: "test.vue",
      });
      expect(results).toMatchObject([{ raw: true }]);
    });

    it("vueLoader handles script tags with attributes", async () => {
      const { loadFile } = createLoader({
        loaders: ["vue", "js"],
      });
      const results = await loadFile({
        extension: ".vue",
        getContents: () => '<script foo lang="ts">Test</script>',
        path: "test.vue",
      });
      expect(results).toMatchObject([
        { contents: ["<script foo>", "Test;", "</script>", ""].join("\n") },
      ]);
    });

    it("vueLoader handles style tags", async () => {
      const { loadFile } = createLoader({
        loaders: ["vue", "sass"],
      });
      const results = await loadFile({
        extension: ".vue",
        getContents: () =>
          [
            "<script>export default {}</script>",
            '<style scoped lang="scss">$color: red; :root { background-color: $color }</style>',
          ].join("\n"),
        path: "test.vue",
      });
      expect(results).toMatchObject([
        {
          contents: [
            "<script>",
            "export default {}",
            "</script>",
            "",
            "<style scoped>",
            ":root {",
            "  background-color: red;",
            "}",
            "</style>",
            "",
          ].join("\n"),
        },
      ]);
    });

    it("vueLoader will generate dts file", async () => {
      const { loadFile } = createLoader({
        loaders: ["vue", "js"],
        declaration: true,
      });
      const results = await loadFile({
        extension: ".vue",
        getContents: () =>
          '<script lang="ts">export default bob = 42 as const</script>',
        path: "test.vue",
      });
      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ declaration: true }),
        ]),
      );
    });

    it("jsLoader will generate dts file (.js)", async () => {
      const { loadFile } = createLoader({
        loaders: ["js"],
        declaration: true,
      });
      const results = await loadFile({
        extension: ".js",
        getContents: () => "export default bob = 42",
        path: "test.mjs",
      });
      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ declaration: true }),
        ]),
      );
    });

    it("jsLoader will generate dts file (.ts)", async () => {
      const { loadFile } = createLoader({
        loaders: ["js"],
        declaration: true,
      });
      const results = await loadFile({
        extension: ".ts",
        getContents: () => "export default bob = 42 as const",
        path: "test.ts",
      });
      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ declaration: true }),
        ]),
      );
    });

    it("jsLoader: respect esbuild options", async () => {
      const { loadFile } = createLoader({
        loaders: ["js"],
        declaration: true,
        esbuild: {
          keepNames: true,
        },
      });
      const results =
        (await loadFile({
          extension: ".ts",
          getContents: () => "function testFunctionName() {}",
          path: "test.ts",
        })) || [];
      expect(results[1].contents).includes("Object.defineProperty");
    });
  });

  it("jsLoader: Support JSX", async () => {
    const { loadFile } = createLoader({
      loaders: ["js"],
      declaration: true,
    });
    const results =
      (await loadFile({
        extension: ".jsx",
        getContents: () => "export const Test = () => <div>42</div>",
        path: "test.jsx",
      })) || [];
    expect(results[1].contents).toMatchInlineSnapshot(`
      "export const Test = () => /* @__PURE__ */ React.createElement("div", null, "42");
      "
    `);
  });

  it("jsLoader: Support TSX", async () => {
    const { loadFile } = createLoader({
      loaders: ["js"],
      declaration: true,
    });
    const results =
      (await loadFile({
        extension: ".tsx",
        getContents: () => "export const Test = () => <div>42</div>",
        path: "test.tsx",
      })) || [];
    expect(results[1].contents).toMatchInlineSnapshot(`
      "export const Test = () => /* @__PURE__ */ React.createElement("div", null, "42");
      "
    `);
  });

  it("emits DTS errors", async () => {
    const rootDir = resolve(__dirname, "fixture");
    const { mkdist } = await import("../src/make");
    const { errors } = await mkdist({
      rootDir,
      declaration: true,
      typescript: {
        compilerOptions: {
          // force compiler errors to be emitted
          noEmitOnError: true,
        },
      },
    });
    const files = errors.map((e) => relative(rootDir, e.filename));
    expect(files).toMatchInlineSnapshot(`
      [
        "dist/components/index.d.ts",
        "dist/components/tsx.d.ts",
      ]
    `);
  }, 50_000);
});

describe("mkdist with vue-tsc v1", () => {
  beforeAll(() => {
    vi.resetModules();

    vi.doMock("pkg-types", async (importOriginal) => {
      const original = await importOriginal<typeof import("pkg-types")>();
      return {
        ...original,
        readPackageJSON: (path: string) => {
          if (path === "vue-tsc") {
            return original.readPackageJSON("vue-tsc1");
          }
          return original.readPackageJSON(path);
        },
      };
    });
    vi.doMock("vue-tsc", async () => {
      return await import("vue-tsc1");
    });
  });

  afterAll(() => {
    vi.doUnmock("pkg-types");
    vi.doUnmock("vue-tsc");
  });

  it("mkdist (emit types)", async () => {
    const rootDir = resolve(__dirname, "fixture");
    const { mkdist } = await import("../src/make");

    const { writtenFiles } = await mkdist({
      rootDir,
      declaration: true,
      addRelativeDeclarationExtensions: true,
    });
    expect(writtenFiles.sort()).toEqual(
      [
        "dist/README.md",
        "dist/bar.d.ts",
        "dist/bar.mjs",
        "dist/demo.css",
        "dist/dir-export.d.ts",
        "dist/dir-export.mjs",
        "dist/foo.mjs",
        "dist/foo.d.ts",
        "dist/index.mjs",
        "dist/index.d.ts",
        "dist/star/index.mjs",
        "dist/star/index.d.ts",
        "dist/star/other.mjs",
        "dist/star/other.d.ts",
        "dist/types.d.ts",
        "dist/components/index.mjs",
        "dist/components/index.d.ts",
        "dist/components/blank.vue",
        "dist/components/blank.vue.d.ts",
        "dist/components/js.vue",
        "dist/components/js.vue.d.ts",
        "dist/components/script-multi-block.vue",
        "dist/components/script-multi-block.vue.d.ts",
        "dist/components/script-setup-ts.vue",
        "dist/components/script-setup-ts.vue.d.ts",
        "dist/components/ts.vue",
        "dist/components/ts.vue.d.ts",
        "dist/components/jsx.mjs",
        "dist/components/tsx.mjs",
        "dist/components/jsx.d.ts",
        "dist/components/tsx.d.ts",
        "dist/bar/index.mjs",
        "dist/bar/index.d.ts",
        "dist/bar/esm.mjs",
        "dist/bar/esm.d.mts",
        "dist/ts/test1.mjs",
        "dist/ts/test2.mjs",
        "dist/ts/test1.d.mts",
        "dist/ts/test2.d.cts",
        "dist/nested.css",
        "dist/prop-types/index.mjs",
        "dist/prop-types/index.d.ts",
      ]
        .map((f) => resolve(rootDir, f))
        .sort(),
    );

    expect(await readFile(resolve(rootDir, "dist/foo.d.ts"), "utf8")).toMatch(
      "manual declaration",
    );

    expect(await readFile(resolve(rootDir, "dist/star/index.d.ts"), "utf8"))
      .toMatchInlineSnapshot(`
        "export * from "./other.js";
        export type { Other } from "./other.js";
        "
      `);
    expect(
      await readFile(resolve(rootDir, "dist/bar/esm.d.mts"), "utf8"),
    ).toMatch("declare");

    expect(
      await readFile(resolve(rootDir, "dist/components/index.d.ts"), "utf8"),
    ).toMatchInlineSnapshot(`
      "export * as jsx from "./jsx.jsx.js";
      export * as tsx from "./tsx.tsx.js";
      export * as blank from "./blank.vue.js";
      export * as scriptSetupTS from "./script-setup-ts.vue.js";
      export * as scriptMultiBlock from "./script-multi-block.vue.js";
      export * as ts from "./ts.vue.js";
      "
    `);

    expect(
      await readFile(
        resolve(rootDir, "dist/components/blank.vue.d.ts"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(`
      "declare const _default: import("vue").DefineComponent<{}, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
      export default _default;
      "
    `);

    expect(
      await readFile(resolve(rootDir, "dist/components/ts.vue.d.ts"), "utf8"),
    ).toMatchInlineSnapshot(`
      "declare const _default: import("vue").DefineComponent<{}, {}, {
          test: string;
          str: "test";
      }, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
      export default _default;
      "
    `);

    expect(
      await readFile(
        resolve(rootDir, "dist/components/script-setup-ts.vue"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(`
      "<script>
      import { defineComponent as _defineComponent } from "vue";
      import { ref } from "vue";
      export default /* @__PURE__ */ _defineComponent({
        __name: "script-setup-ts",
        props: {
          msg: { type: String, required: true },
          color: { type: Object, required: true }
        },
        setup(__props, { expose: __expose }) {
          __expose();
          const props = __props;
          const str = ref("hello");
          const __returned__ = { props, str };
          Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
          return __returned__;
        }
      });
      </script>

      <template>
        <div>{{ str }}</div>
      </template>
      "
    `);

    expect(
      await readFile(
        resolve(rootDir, "dist/components/script-multi-block.vue"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(`
      "<script>
      import { defineComponent as _defineComponent } from "vue";
      export default /* @__PURE__ */ _defineComponent({
        __name: "script-multi-block",
        props: {
          msg: { type: String, required: true }
        },
        setup(__props, { expose: __expose }) {
          __expose();
          const __returned__ = {};
          Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
          return __returned__;
        }
      });
      </script>

      <template>
        <div>{{ msg }}</div>
      </template>
      "
    `);

    expect(
      await readFile(
        resolve(rootDir, "dist/components/script-multi-block.vue.d.ts"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(`
      "interface MyComponentProps {
          msg: string;
      }
      declare const _default: import("vue").DefineComponent<import("vue").ExtractPropTypes<__VLS_TypePropsToRuntimeProps<MyComponentProps>>, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<__VLS_TypePropsToRuntimeProps<MyComponentProps>>> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
      export default _default;
      type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;
      type __VLS_TypePropsToRuntimeProps<T> = {
          [K in keyof T]-?: {} extends Pick<T, K> ? {
              type: import('vue').PropType<__VLS_NonUndefinedable<T[K]>>;
          } : {
              type: import('vue').PropType<T[K]>;
              required: true;
          };
      };
      "
    `);

    expect(
      await readFile(
        resolve(rootDir, "dist/components/script-setup-ts.vue.d.ts"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(`
      "import { Color } from "#prop-types";
      declare const _default: import("vue").DefineComponent<import("vue").ExtractPropTypes<__VLS_TypePropsToRuntimeProps<{
          msg: string;
          color: Color;
      }>>, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<__VLS_TypePropsToRuntimeProps<{
          msg: string;
          color: Color;
      }>>> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
      export default _default;
      type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;
      type __VLS_TypePropsToRuntimeProps<T> = {
          [K in keyof T]-?: {} extends Pick<T, K> ? {
              type: import('vue').PropType<__VLS_NonUndefinedable<T[K]>>;
          } : {
              type: import('vue').PropType<T[K]>;
              required: true;
          };
      };
      "
    `);
  }, 50_000);
});

describe("mkdist with vue-tsc ~v2.0.21", () => {
  beforeAll(() => {
    vi.resetModules();

    vi.doMock("pkg-types", async (importOriginal) => {
      const original = await importOriginal<typeof import("pkg-types")>();
      return {
        ...original,
        readPackageJSON: async (path: string) => {
          if (path === "vue-tsc") {
            return original.readPackageJSON("vue-tsc2.0");
          }
          return original.readPackageJSON(path);
        },
      };
    });
    vi.doMock("mlly", async () => {
      const original = await import("mlly");
      const resolve: typeof import("mlly").resolve = (id, options) => {
        if (id === "vue-tsc") {
          return original.resolve("vue-tsc2.0", options);
        }
        return original.resolve(id, options);
      };
      return {
        ...original,
        resolve,
      };
    });
    vi.doMock("vue-tsc", async () => {
      return await import("vue-tsc2.0");
    });
  });

  afterAll(() => {
    vi.doUnmock("pkg-types");
    vi.doUnmock("vue-tsc");
  });

  it("mkdist (emit types)", async () => {
    const rootDir = resolve(__dirname, "fixture");
    const { mkdist } = await import("../src/make");

    const { writtenFiles } = await mkdist({
      rootDir,
      declaration: true,
      addRelativeDeclarationExtensions: true,
    });
    expect(writtenFiles.sort()).toEqual(
      [
        "dist/README.md",
        "dist/bar.d.ts",
        "dist/bar.mjs",
        "dist/demo.css",
        "dist/dir-export.d.ts",
        "dist/dir-export.mjs",
        "dist/foo.mjs",
        "dist/foo.d.ts",
        "dist/index.mjs",
        "dist/index.d.ts",
        "dist/star/index.mjs",
        "dist/star/index.d.ts",
        "dist/star/other.mjs",
        "dist/star/other.d.ts",
        "dist/types.d.ts",
        "dist/components/index.mjs",
        "dist/components/index.d.ts",
        "dist/components/blank.vue",
        "dist/components/blank.vue.d.ts",
        "dist/components/js.vue",
        "dist/components/js.vue.d.ts",
        "dist/components/script-multi-block.vue",
        "dist/components/script-multi-block.vue.d.ts",
        "dist/components/script-setup-ts.vue",
        "dist/components/script-setup-ts.vue.d.ts",
        "dist/components/ts.vue",
        "dist/components/ts.vue.d.ts",
        "dist/components/jsx.mjs",
        "dist/components/tsx.mjs",
        "dist/components/jsx.d.ts",
        "dist/components/tsx.d.ts",
        "dist/bar/index.mjs",
        "dist/bar/index.d.ts",
        "dist/bar/esm.mjs",
        "dist/bar/esm.d.mts",
        "dist/ts/test1.mjs",
        "dist/ts/test2.mjs",
        "dist/ts/test1.d.mts",
        "dist/ts/test2.d.cts",
        "dist/nested.css",
        "dist/prop-types/index.mjs",
        "dist/prop-types/index.d.ts",
      ]
        .map((f) => resolve(rootDir, f))
        .sort(),
    );

    expect(await readFile(resolve(rootDir, "dist/foo.d.ts"), "utf8")).toMatch(
      "manual declaration",
    );

    expect(await readFile(resolve(rootDir, "dist/star/index.d.ts"), "utf8"))
      .toMatchInlineSnapshot(`
        "export * from "./other.js";
        export type { Other } from "./other.js";
        "
      `);
    expect(
      await readFile(resolve(rootDir, "dist/bar/esm.d.mts"), "utf8"),
    ).toMatch("declare");

    expect(
      await readFile(resolve(rootDir, "dist/components/index.d.ts"), "utf8"),
    ).toMatchInlineSnapshot(`
      "export * as jsx from "./jsx.jsx.js";
      export * as tsx from "./tsx.tsx.js";
      export * as blank from "./blank.vue.js";
      export * as scriptSetupTS from "./script-setup-ts.vue.js";
      export * as scriptMultiBlock from "./script-multi-block.vue.js";
      export * as ts from "./ts.vue.js";
      "
    `);

    expect(
      await readFile(
        resolve(rootDir, "dist/components/blank.vue.d.ts"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(`
      "declare const _default: import("vue").DefineComponent<{}, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
      export default _default;
      "
    `);

    expect(
      await readFile(resolve(rootDir, "dist/components/ts.vue.d.ts"), "utf8"),
    ).toMatchInlineSnapshot(`
      "declare const _default: import("vue").DefineComponent<{}, {}, {
          test: string;
          str: "test";
      }, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
      export default _default;
      "
    `);

    expect(
      await readFile(
        resolve(rootDir, "dist/components/script-multi-block.vue"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(`
      "<script>
      import { defineComponent as _defineComponent } from "vue";
      export default /* @__PURE__ */ _defineComponent({
        __name: "script-multi-block",
        props: {
          msg: { type: String, required: true }
        },
        setup(__props, { expose: __expose }) {
          __expose();
          const __returned__ = {};
          Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
          return __returned__;
        }
      });
      </script>

      <template>
        <div>{{ msg }}</div>
      </template>
      "
    `);

    expect(
      await readFile(
        resolve(rootDir, "dist/components/script-multi-block.vue.d.ts"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(`
      "interface MyComponentProps {
          msg: string;
      }
      declare const _default: import("vue").DefineComponent<import("vue").ExtractPropTypes<__VLS_TypePropsToOption<MyComponentProps>>, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<__VLS_TypePropsToOption<MyComponentProps>>> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
      export default _default;
      type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;
      type __VLS_TypePropsToOption<T> = {
          [K in keyof T]-?: {} extends Pick<T, K> ? {
              type: import('vue').PropType<__VLS_NonUndefinedable<T[K]>>;
          } : {
              type: import('vue').PropType<T[K]>;
              required: true;
          };
      };
      "
    `);

    expect(
      await readFile(
        resolve(rootDir, "dist/components/script-setup-ts.vue.d.ts"),
        "utf8",
      ),
    ).toMatchInlineSnapshot(`
      "import { Color } from "#prop-types";
      declare const _default: import("vue").DefineComponent<import("vue").ExtractPropTypes<__VLS_TypePropsToOption<{
          msg: string;
          color: Color;
      }>>, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<__VLS_TypePropsToOption<{
          msg: string;
          color: Color;
      }>>> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
      export default _default;
      type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;
      type __VLS_TypePropsToOption<T> = {
          [K in keyof T]-?: {} extends Pick<T, K> ? {
              type: import('vue').PropType<__VLS_NonUndefinedable<T[K]>>;
          } : {
              type: import('vue').PropType<T[K]>;
              required: true;
          };
      };
      "
    `);
  }, 50_000);
});
