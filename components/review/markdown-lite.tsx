/**
 * MarkdownLite — tiny safe Markdown subset renderer.
 *
 * Supports:
 *   - **bold**
 *   - *italic*
 *   - bullet lines starting with "- " or "* "
 *   - blank-line paragraph breaks
 *
 * No HTML pass-through, no URL auto-linking, no scripts. Every emitted node
 * is React text/elements, so there is no XSS surface. Pass `className` to
 * color/size the rendered text (defaults to subdued ink at 13px).
 */
import { cn } from "@/lib/utils";

interface MarkdownLiteProps {
  text: string;
  className?: string;
}

export function MarkdownLite({ text, className }: MarkdownLiteProps) {
  const lines = text.split(/\r?\n/);
  type Block =
    | { kind: "p"; text: string }
    | { kind: "ul"; items: string[] }
    | { kind: "blank" };

  const blocks: Block[] = [];
  let buf: string[] = [];
  let listBuf: string[] = [];

  const flushP = () => {
    if (buf.length) {
      blocks.push({ kind: "p", text: buf.join(" ") });
      buf = [];
    }
  };
  const flushUl = () => {
    if (listBuf.length) {
      blocks.push({ kind: "ul", items: listBuf });
      listBuf = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushP();
      flushUl();
      blocks.push({ kind: "blank" });
    } else if (/^[-*]\s+/.test(line)) {
      flushP();
      listBuf.push(line.replace(/^[-*]\s+/, ""));
    } else {
      flushUl();
      buf.push(line);
    }
  }
  flushP();
  flushUl();

  return (
    <div
      className={cn(
        "space-y-2 text-[13px] text-text leading-relaxed",
        className,
      )}
    >
      {blocks.map((b, i) => {
        if (b.kind === "blank") return null;
        if (b.kind === "ul") {
          return (
            <ul key={i} className="list-disc list-inside space-y-0.5">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{renderInline(b.text)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Token pattern matches **...** OR *...* (non-empty, no newlines).
  const re = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
  const parts = text.split(re).filter((p) => p !== "");
  return parts.map((part, i) => {
    if (/^\*\*[^*\n]+\*\*$/.test(part)) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (/^\*[^*\n]+\*$/.test(part)) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}
