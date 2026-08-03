"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Lightweight markdown for chat bubbles (bold, italic, code, lists, links). */
export function SimpleMarkdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let listBuf: string[] = [];
  let key = 0;

  const flushList = () => {
    if (!listBuf.length) return;
    blocks.push(
      <ul key={`ul-${key++}`} className="my-1.5 list-disc space-y-0.5 pl-4">
        {listBuf.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>
    );
    listBuf = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*[-*•]\s+/.test(line)) {
      listBuf.push(line.replace(/^\s*[-*•]\s+/, ""));
      continue;
    }
    flushList();
    if (!line.trim()) {
      blocks.push(<div key={`br-${key++}`} className="h-2" />);
      continue;
    }
    if (/^###\s+/.test(line)) {
      blocks.push(
        <div key={key++} className="mt-2 text-[13px] font-bold text-white">
          {inline(line.replace(/^###\s+/, ""))}
        </div>
      );
      continue;
    }
    if (/^##\s+/.test(line)) {
      blocks.push(
        <div key={key++} className="mt-2 text-sm font-bold text-white">
          {inline(line.replace(/^##\s+/, ""))}
        </div>
      );
      continue;
    }
    blocks.push(
      <p key={key++} className="my-0.5 leading-relaxed">
        {inline(line)}
      </p>
    );
  }
  flushList();

  return <div className={cn("text-[13px] leading-relaxed text-white/95", className)}>{blocks}</div>;
}

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // **bold**, *italic*, `code`, [label](url)
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={i++} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={i++} className="italic text-white/90">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={i++} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[11px]">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[")) {
      const mm = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (mm) {
        nodes.push(
          <a
            key={i++}
            href={mm[2]}
            target="_blank"
            rel="noreferrer"
            className="text-fuchsia-300 underline underline-offset-2 hover:text-fuchsia-200"
          >
            {mm[1]}
          </a>
        );
      }
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
