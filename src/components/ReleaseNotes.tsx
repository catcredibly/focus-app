import { Fragment, type ReactNode } from "react";

import { noteTokens } from "../notes";
import { openExternalUrl } from "../externalLinks";
/** React escapes text; raw HTML is never interpreted. */
function inline(text: string): ReactNode[] {
  return noteTokens(text).map((token, index) =>
    token.url ? (
      <a
        key={index}
        href={token.url}
        onClick={(event) => {
          event.preventDefault();
          void openExternalUrl(token.url!).catch(console.error);
        }}
      >
        {inline(token.label!)}
      </a>
    ) : (
      <Fragment key={index}>
        {token.raw.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g).map((part, key) => {
          if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__")))
            return <strong key={key}>{part.slice(2, -2)}</strong>;
          if (part.startsWith("`") && part.endsWith("`")) return <code key={key}>{part.slice(1, -1)}</code>;
          if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_")))
            return <em key={key}>{part.slice(1, -1)}</em>;
          return <Fragment key={key}>{part}</Fragment>;
        })}
      </Fragment>
    ),
  );
}
export function ReleaseNotes({ notes }: { notes: string }) {
  const blocks: ReactNode[] = [],
    lines = notes.split("\n");
  for (let i = 0; i < lines.length;) {
    if (!lines[i].trim()) {
      i++;
      continue;
    }
    const heading = /^#{1,6}\s+(.+)$/.exec(lines[i]);
    if (heading) {
      blocks.push(<h4 key={i}>{inline(heading[1])}</h4>);
      i++;
      continue;
    }
    const ordered = /^\s*\d+\.\s+/.test(lines[i]);
    const marker = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*+]\s+/;
    if (marker.test(lines[i])) {
      const start = i,
        items: ReactNode[] = [];
      while (i < lines.length && marker.test(lines[i])) {
        items.push(<li key={i}>{inline(lines[i].replace(marker, ""))}</li>);
        i++;
      }
      blocks.push(ordered ? <ol key={start}>{items}</ol> : <ul key={start}>{items}</ul>);
      continue;
    }
    const start = i,
      paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(?:#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s)/.test(lines[i]))
      paragraph.push(lines[i++]);
    blocks.push(<p key={start}>{inline(paragraph.join("\n"))}</p>);
  }
  return <>{blocks}</>;
}
