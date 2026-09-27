import { Fragment, type ReactNode } from "react";

/** Deliberately small Markdown subset. React escapes text; raw HTML is never used. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^\s)]+\))/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(part);
    if (link && /^https?:\/\//i.test(link[2]))
      return (
        <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer">
          {link[1]}
        </a>
      );
    return <Fragment key={index}>{part}</Fragment>;
  });
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
