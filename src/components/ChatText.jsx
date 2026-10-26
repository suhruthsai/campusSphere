// Renders the AI's replies: paragraphs, bullet / numbered lists, simple tables, **bold** and `code`.
// Builds React elements (no HTML injection), so model output can't add markup or scripts.

function inline(text, key = 0) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={`${key}-${i}`} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={`${key}-${i}`} className="rounded bg-white/10 px-1 font-mono text-[0.92em]">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export default function ChatText({ text }) {
  const lines = String(text || '').split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*\|.*\|\s*$/.test(line)) {                       // table: consecutive | rows
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      i -= 1;
      const body = rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map(cells);
      const [head, ...rest] = body;
      blocks.push(
        <div key={blocks.length} className="my-1 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[0.92em]">
            <thead><tr>{head.map((c, j) => <th key={j} className="border-b border-white/15 px-1.5 py-1 font-semibold text-white">{inline(c, j)}</th>)}</tr></thead>
            <tbody>{rest.map((r, k) => (
              <tr key={k}>{r.map((c, j) => <td key={j} className="border-b border-white/5 px-1.5 py-1 align-top">{inline(c, j)}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>,
      );
    } else if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {        // list: consecutive items
      const ordered = /^\s*\d+[.)]/.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        items.push({ text: lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ''), nested: /^\s{2,}/.test(lines[i]) });
        i += 1;
      }
      i -= 1;
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={blocks.length} className={`my-1 space-y-0.5 pl-5 ${ordered ? 'list-decimal' : 'list-disc'}`}>
          {items.map((it, k) => <li key={k} className={it.nested ? 'ml-4' : ''}>{inline(it.text, k)}</li>)}
        </List>,
      );
    } else if (/^#{1,4}\s+/.test(line)) {
      blocks.push(<p key={blocks.length} className="mt-1 font-semibold text-white">{inline(line.replace(/^#+\s+/, ''))}</p>);
    } else if (line.trim()) {
      blocks.push(<p key={blocks.length} className={blocks.length ? 'mt-1' : ''}>{inline(line)}</p>);
    }
  }
  return <div className="break-words">{blocks}</div>;
}
