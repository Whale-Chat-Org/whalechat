"use client";

import { memo, useMemo } from "react";
import type {
  ClassAttributes,
  ElementType,
  HTMLAttributes,
  TableHTMLAttributes,
} from "react";
import ReactMarkdown from "react-markdown";
import type { Components, ExtraProps } from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { Copy, Check } from "lucide-react";
import { MermaidDiagram } from "./MermaidDiagram";
import { Button } from "./ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

// highlight.js builds, imported individually so no refractor dependency is pulled in.
import javascript from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import typescript from "react-syntax-highlighter/dist/esm/languages/hljs/typescript";
import python from "react-syntax-highlighter/dist/esm/languages/hljs/python";
import java from "react-syntax-highlighter/dist/esm/languages/hljs/java";
import c from "react-syntax-highlighter/dist/esm/languages/hljs/c";
import cpp from "react-syntax-highlighter/dist/esm/languages/hljs/cpp";
import csharp from "react-syntax-highlighter/dist/esm/languages/hljs/csharp";
import php from "react-syntax-highlighter/dist/esm/languages/hljs/php";
import ruby from "react-syntax-highlighter/dist/esm/languages/hljs/ruby";
import go from "react-syntax-highlighter/dist/esm/languages/hljs/go";
import rust from "react-syntax-highlighter/dist/esm/languages/hljs/rust";
import sql from "react-syntax-highlighter/dist/esm/languages/hljs/sql";
import bash from "react-syntax-highlighter/dist/esm/languages/hljs/bash";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import yaml from "react-syntax-highlighter/dist/esm/languages/hljs/yaml";
import markdown from "react-syntax-highlighter/dist/esm/languages/hljs/markdown";
import css from "react-syntax-highlighter/dist/esm/languages/hljs/css";
import xml from "react-syntax-highlighter/dist/esm/languages/hljs/xml";

/** Fence identifier -> highlight.js grammar. jsx/tsx and html reuse a grammar. */
const LANGUAGES = {
  javascript,
  typescript,
  python,
  java,
  c,
  cpp,
  csharp,
  php,
  ruby,
  go,
  rust,
  sql,
  bash,
  json,
  yaml,
  markdown,
  css,
  xml,
  html: xml,
  jsx: javascript,
  tsx: typescript,
};

for (const [name, grammar] of Object.entries(LANGUAGES)) {
  SyntaxHighlighter.registerLanguage(name, grammar);
}

/**
 * Props react-markdown passes to an element override.
 *
 * @remarks Typed against the generic `HTMLElement` attribute set rather than a
 * per-tag one; that is a supertype of what react-markdown supplies for each
 * tag, so the overrides stay assignable to `Components` without casting.
 */
type MarkdownElementProps = ClassAttributes<HTMLElement> &
  HTMLAttributes<HTMLElement> &
  ExtraProps;

/**
 * Build an element override that renders `Tag` with a fixed class list.
 *
 * @param extraProps - Attributes applied before the incoming props, so
 * markdown-supplied attributes still win.
 */
function styled(
  Tag: ElementType,
  className: string,
  extraProps?: Record<string, unknown>
) {
  function Styled({ node, ...props }: MarkdownElementProps) {
    void node;
    return <Tag className={className} {...extraProps} {...props} />;
  }
  Styled.displayName = `Markdown(${String(Tag)})`;
  return Styled;
}

const components: Components = {
  code({ node, className, children, ...props }: MarkdownElementProps) {
    void node;
    const language = /language-(\w+)/.exec(String(className ?? ""))?.[1] ?? "";
    const code = String(children).replace(/\n$/, "");

    if (!className) {
      return (
        <code
          className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }

    if (language === "mermaid") return <MermaidDiagram code={code} />;

    return <CodeBlock language={language} code={code} />;
  },

  table({
    node,
    children,
    ...props
  }: ClassAttributes<HTMLTableElement> &
    TableHTMLAttributes<HTMLTableElement> &
    ExtraProps) {
    void node;
    return (
      <div className="my-4 sm:my-6 w-full max-w-full overflow-hidden">
        <div className="border rounded-lg shadow-sm overflow-hidden">
          <div className="table-scroll overflow-x-auto overflow-y-auto max-h-[400px] sm:max-h-[600px] relative scrollbar-thin">
            <table className="w-full divide-y divide-border min-w-max" {...props}>
              {children}
            </table>
          </div>
        </div>
      </div>
    );
  },

  thead: styled("thead", "bg-muted sticky top-0 z-10"),
  tbody: styled("tbody", "bg-background divide-y divide-border"),
  tr: styled("tr", "hover:bg-muted/30 transition-colors"),
  th: styled(
    "th",
    "px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-3 text-left text-[10px] xs:text-xs font-bold text-foreground uppercase tracking-wider border-r border-border last:border-r-0 whitespace-nowrap bg-muted/80"
  ),
  td: styled(
    "td",
    "px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-[10px] xs:text-xs sm:text-sm text-foreground border-r border-border last:border-r-0 whitespace-nowrap"
  ),
  p: styled("p", "my-2 sm:my-3 leading-relaxed"),
  ul: styled("ul", "my-2 sm:my-3 ml-4 sm:ml-6 list-disc space-y-1 sm:space-y-2"),
  ol: styled(
    "ol",
    "my-2 sm:my-3 ml-4 sm:ml-6 list-decimal space-y-1 sm:space-y-2"
  ),
  li: styled("li", "leading-relaxed"),
  h1: styled(
    "h1",
    "text-lg sm:text-xl md:text-2xl font-bold mt-4 sm:mt-5 md:mt-6 mb-3 sm:mb-4"
  ),
  h2: styled(
    "h2",
    "text-base sm:text-lg md:text-xl font-bold mt-3 sm:mt-4 md:mt-5 mb-2 sm:mb-3"
  ),
  h3: styled("h3", "text-sm sm:text-base md:text-lg font-semibold mt-3 sm:mt-4 mb-2"),
  h4: styled("h4", "text-sm sm:text-base font-semibold mt-2 sm:mt-3 mb-1.5 sm:mb-2"),
  blockquote: styled(
    "blockquote",
    "border-l-2 sm:border-l-4 border-primary pl-3 sm:pl-4 py-1.5 sm:py-2 my-3 sm:my-4 italic text-muted-foreground bg-muted/30 rounded-r text-xs sm:text-sm"
  ),
  a: styled("a", "text-primary hover:underline font-medium", {
    target: "_blank",
    rel: "noopener noreferrer",
  }),
  hr: styled("hr", "my-6 border-border"),
};

interface MarkdownRendererProps {
  content: string;
}

/**
 * Render assistant markdown: GFM, KaTeX math, raw HTML, Mermaid fences and
 * syntax-highlighted code.
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
}: MarkdownRendererProps) {
  const processedContent = useMemo(
    () =>
      content
        // Normalize LaTeX delimiters remark-math does not recognise.
        .replace(/\\\[([\s\S]*?)\\\]/g, (_, body) => `\n$$${body.trim()}$$\n`)
        .replace(/\\\(([\s\S]*?)\\\)/g, (_, body) => `$${body.trim()}$`)
        // Drop stray "$$ 12 $" fragments that would otherwise open a math block.
        .replace(/\$\$\s*\d+\s*\$/g, "")
        // Display math must sit on its own line.
        .replace(/([^\n])\$\$/g, "$1\n$$")
        .replace(/\$\$([^\n])/g, "$$\n$1"),
    [content]
  );

  return (
    <div className="markdown-content w-full max-w-full min-w-0">
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});

/** A fenced code block with a hover-revealed copy button. */
const CodeBlock = memo(function CodeBlock({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="code-block relative group my-3 sm:my-4 max-w-full overflow-hidden">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 sm:h-8 sm:w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-background/80 hover:bg-background"
        onClick={() => copy(code)}
      >
        {copied ? (
          <Check className="h-3 w-3 sm:h-4 sm:w-4" />
        ) : (
          <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
        )}
      </Button>
      <div className="overflow-x-auto rounded-md sm:rounded-lg max-w-full scrollbar-thin">
        <SyntaxHighlighter
          style={atomOneDark}
          language={language || "text"}
          PreTag="div"
          className="!my-0 !rounded-md sm:!rounded-lg text-xs sm:text-sm"
          customStyle={{
            margin: 0,
            borderRadius: "0.375rem",
            padding: "0.75rem",
            maxWidth: "100%",
            fontSize: "inherit",
          }}
          codeTagProps={{ style: { fontSize: "inherit" } }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});
