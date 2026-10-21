export type Delimiter = ',' | '\t' | ';';

export function parseDelimited(source: string, delimiter: Delimiter): string[][] {
  const text = source.startsWith('﻿') ? source.slice(1) : source;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let index = 0;
  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  while (index < text.length) {
    const char = text.charAt(index);
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 2;
        continue;
      }
      if (char === '"') quoted = false;
      else field += char;
      index += 1;
      continue;
    }
    if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) endField();
    else if (char === '\r' && text[index + 1] === '\n') {
      endRow();
      index += 1;
    } else if (char === '\n' || char === '\r') endRow();
    else field += char;
    index += 1;
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

function quote(field: string, delimiter: Delimiter): string {
  const needs = field.includes(delimiter) || /["\r\n]/.test(field);
  return needs ? `"${field.replaceAll('"', '""')}"` : field;
}

export function toDelimited(rows: readonly (readonly string[])[], delimiter: Delimiter): string {
  return rows.map((row) => row.map((field) => quote(field, delimiter)).join(delimiter)).join('\r\n');
}
