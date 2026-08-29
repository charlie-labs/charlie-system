import type { SourceFragment } from '../../lib/artifacts/document/contract.js';

export function renderFragments(fragments: readonly SourceFragment[]): string {
  return fragments
    .map((fragment) => renderFragment(fragment))
    .filter((block) => block !== '')
    .join('\n\n');
}

function renderFragment(fragment: SourceFragment): string {
  switch (fragment.kind) {
    case 'prose':
      return fragment.text;
    case 'list':
      return renderList(fragment);
    case 'code':
      return renderCode(fragment);
    case 'table':
      return renderTable(fragment.rows);
    case 'blockquote':
      return renderFragments(fragment.fragments)
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
  }
  return unreachable(fragment);
}

function renderList(
  fragment: Extract<SourceFragment, { readonly kind: 'list' }>
): string {
  return fragment.items
    .map((item, index) => {
      const marker = fragment.ordered
        ? `${(fragment.start ?? 1) + index}.`
        : '-';
      const check = checkMarker(item.checked);
      const lines = renderFragments(item.fragments).split('\n');
      const first = lines[0] ?? '';
      return [
        `${marker} ${check}${first}`,
        ...lines.slice(1).map((line) => `   ${line}`),
      ].join('\n');
    })
    .join('\n');
}

function checkMarker(checked: boolean | undefined): string {
  if (checked === undefined) return '';
  return checked ? '[x] ' : '[ ] ';
}

function renderCode(
  fragment: Extract<SourceFragment, { readonly kind: 'code' }>
): string {
  const fence = fragment.code.includes('```') ? '~~~~' : '```';
  const info = [fragment.language, fragment.metadata]
    .filter((value) => value !== undefined && value !== '')
    .join(' ');
  return `${fence}${info}\n${fragment.code}\n${fence}`;
}

function renderTable(rows: readonly (readonly string[])[]): string {
  const header = rows[0];
  if (header === undefined) return '';
  const separator = header.map(() => '---');
  return [header, separator, ...rows.slice(1)]
    .map(
      (row) =>
        `| ${row.map((cell) => cell.replaceAll('|', '\\|')).join(' | ')} |`
    )
    .join('\n');
}

function unreachable(value: never): never {
  throw new Error(`unsupported source fragment: ${String(value)}`);
}
