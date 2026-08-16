"use client";

import { useEffect, useRef, useState, memo } from "react";
import mermaid from "mermaid";
import { AlertCircle } from "lucide-react";

interface MermaidDiagramProps {
  /** The body of a ```mermaid fence, without the fence itself. */
  code: string;
}

/** mermaid.initialize is global, so only the first mounted diagram runs it. */
let isInitialized = false;

/** The node mermaid appends to <body> when a diagram fails to parse. */
const ERROR_NODE_ID = "dmermaid-error";

/** Selector for the stray nodes mermaid appends to <body> on a parse failure. */
const STRAY_ERROR_SELECTOR = `#${ERROR_NODE_ID}, [id^="mermaid-"]`;

/** Remove the error node mermaid leaves behind after a failed render. */
function removeStrayErrorNode() {
  document.getElementById(ERROR_NODE_ID)?.remove();
}

/** Render a ```mermaid fence to SVG, falling back to the source on a syntax error. */
export const MermaidDiagram = memo(function MermaidDiagram({
  code,
}: MermaidDiagramProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [svg, setSvg] = useState("");

  useEffect(() => {
    if (isInitialized) return;
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
      fontFamily: "inherit",
    });
    isInitialized = true;
  }, []);

  useEffect(() => {
    if (!code.trim()) return;

    setError(null);
    setIsRendering(true);
    const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;

    (async () => {
      removeStrayErrorNode();
      try {
        const result = await mermaid.render(id, code);
        setSvg(result.svg);
      } catch (err) {
        console.error("Mermaid rendering error:", err);
        removeStrayErrorNode();
        setError(err instanceof Error ? err.message : "Invalid diagram syntax");
      } finally {
        setIsRendering(false);
      }
    })();
  }, [code]);

  useEffect(() => {
    if (ref.current && svg) {
      ref.current.innerHTML = svg;
    }
  }, [svg]);

  // mermaid can append error nodes to <body> outside React's control; sweep them.
  useEffect(() => {
    const interval = setInterval(() => {
      document.querySelectorAll(STRAY_ERROR_SELECTOR).forEach((div) => {
        if (
          div.textContent?.includes("Syntax error") ||
          div.textContent?.includes("mermaid version")
        ) {
          div.remove();
        }
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="my-4 border border-destructive/50 rounded-lg overflow-hidden">
        <div className="bg-destructive/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive mb-1">
              Mermaid Diagram Error
            </p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        </div>
        <div className="bg-muted/50 p-4 overflow-x-auto">
          <pre className="text-xs font-mono text-muted-foreground">
            <code>{code}</code>
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4">
      <div
        ref={ref}
        className="flex justify-center items-center p-4 bg-background/50 rounded-lg border overflow-x-auto overflow-y-auto max-h-[600px]"
        style={{ minHeight: isRendering ? "100px" : "auto" }}
      />
      {isRendering && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          Rendering diagram...
        </p>
      )}
    </div>
  );
});
