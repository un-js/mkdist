import type {
  ParentNode,
  ExpressionNode,
  TemplateChildNode,
  AttributeNode,
  DirectiveNode,
  SourceLocation,
  RootNode,
} from "@vue/compiler-dom-types";

// copy from `@vue/compiler-dom`
enum NodeTypes {
  ROOT,
  ELEMENT,
  TEXT,
  COMMENT,
  SIMPLE_EXPRESSION,
  INTERPOLATION,
  ATTRIBUTE,
  DIRECTIVE,

  // containers
  COMPOUND_EXPRESSION,
  IF,
  IF_BRANCH,
  FOR,
  TEXT_CALL,

  // codegen
  VNODE_CALL,
  JS_CALL_EXPRESSION,
  JS_OBJECT_EXPRESSION,
  JS_PROPERTY,
  JS_ARRAY_EXPRESSION,
  JS_FUNCTION_EXPRESSION,
  JS_CONDITIONAL_EXPRESSION,
  JS_CACHE_EXPRESSION,

  // ssr codegen
  JS_BLOCK_STATEMENT,
  JS_TEMPLATE_LITERAL,
  JS_IF_STATEMENT,
  JS_ASSIGNMENT_EXPRESSION,
  JS_SEQUENCE_EXPRESSION,
  JS_RETURN_STATEMENT,
}

interface Expression {
  loc: SourceLocation;
  src: string;
  replacement?: string;
}

function handleNode(
  node:
    | ParentNode
    | ExpressionNode
    | TemplateChildNode
    | AttributeNode
    | DirectiveNode,
  addExpression: (...expressions: Expression[]) => void,
) {
  const search = (
    node: ExpressionNode | TemplateChildNode | AttributeNode | DirectiveNode,
  ) => handleNode(node, addExpression);

  switch (node.type) {
    case NodeTypes.ROOT: {
      for (const child of node.children) {
        search(child);
      }
      return;
    }
    case NodeTypes.ELEMENT: {
      const nodes = [...node.children, ...node.props];
      for (const child of nodes) {
        search(child);
      }
      return;
    }
    case NodeTypes.TEXT: {
      return;
    }
    case NodeTypes.COMMENT: {
      return;
    }
    case NodeTypes.SIMPLE_EXPRESSION: {
      if (node.ast === null || node.ast === false) {
        return;
      }
      addExpression({ loc: node.loc, src: node.content });
      return;
    }
    case NodeTypes.INTERPOLATION: {
      search(node.content);
      return;
    }
    case NodeTypes.ATTRIBUTE: {
      search(node.value);
      return;
    }
    case NodeTypes.DIRECTIVE: {
      const nodes = [
        node.exp,
        // node.arg,
        // node.forParseResult?.source,
        // node.forParseResult?.value,
        // node.forParseResult?.key,
        // node.forParseResult?.index,
        ...node.modifiers,
      ].filter((item) => !!item);
      for (const child of nodes) {
        search(child);
      }
      return;
    }
    case NodeTypes.COMPOUND_EXPRESSION: {
      if (!node.ast) {
        return;
      }

      addExpression({ loc: node.loc, src: node.loc.source });
      return;
    }
    // case NodeTypes.IF:
    // case NodeTypes.FOR:
    // case NodeTypes.TEXT_CALL:
    default: {
      throw new Error(`Unexpected node type: ${node.type}`);
    }
  }
}

export function replaceBySourceLocation(
  src: string,
  input: { loc: SourceLocation; replacement: string }[],
) {
  if (input.length === 0) {
    return src;
  }

  const data = [...input].sort(
    (a, b) => b.loc.start.offset - a.loc.start.offset,
  );
  let result = src;
  for (const { loc, replacement } of data) {
    const start = loc.start.offset;
    const end = loc.end.offset;
    result = result.slice(0, start) + replacement + result.slice(end);
  }

  return result;
}

export async function transpileVueTemplate(
  content: string,
  root: RootNode,
  transform: (code: string) => string | Promise<string>,
): Promise<string> {
  const expressions: Expression[] = [];

  handleNode(root, (...items) => expressions.push(...items));
  await Promise.all(
    expressions.map(async (item) => {
      if (item.src.trim() === "") {
        item.replacement = item.src;
        return;
      }

      try {
        // `{ key: val } as any` in `<div :style="{ key: val } as any" />` is a valid js snippet,
        // but it can't be transformed.
        // We can warp it with `()` to make it a valid js file
        let res = (await transform(`(${item.src})`)).trim();

        // result will be wrapped in `{content};\n`, we need to remove it
        if (res.endsWith(";")) {
          res = res.slice(0, -1);
        }

        item.replacement = res;
      } catch {
        item.replacement = item.src;
      }
    }),
  );

  const result = replaceBySourceLocation(
    content,
    expressions.filter((item) => !!item.replacement) as (Expression & {
      replacement: string;
    })[],
  );

  return result;
}
