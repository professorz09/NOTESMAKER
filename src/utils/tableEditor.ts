/**
 * Manual (non-AI) table structure edits for the in-editor table editor —
 * column width resize, insert/delete row, insert/delete column. Pure DOM
 * helpers that operate directly on the live contentEditable table so
 * changes are instant; the app's own history/autosave picks up the result
 * the same way it picks up any other editorRef.innerHTML change.
 *
 * Deliberately simple: treats every row as a flat grid (colspan is summed
 * for counting but not tracked cell-by-cell for insert/delete), which
 * covers the vast majority of AI-generated tables. A table with real
 * rowspan/colspan merges may behave imperfectly — acceptable trade-off for
 * a lightweight manual editor sitting on top of AI-generated content.
 */

export function getColumnCount(table: HTMLTableElement): number {
  let max = 0;
  table.querySelectorAll('tr').forEach(tr => {
    let count = 0;
    tr.querySelectorAll('th, td').forEach(cell => {
      count += parseInt(cell.getAttribute('colspan') || '1', 10);
    });
    if (count > max) max = count;
  });
  return max || 1;
}

/** Ensure a <colgroup> exists with one <col> per column, seeded from the
 *  CURRENTLY RENDERED widths (so adding it doesn't visually jump the table)
 *  when created fresh; a colgroup that already matches the column count is
 *  left untouched. */
export function ensureColgroup(table: HTMLTableElement): HTMLTableColElement[] {
  const n = getColumnCount(table);
  let colgroup = table.querySelector('colgroup');
  const existing = colgroup ? Array.from(colgroup.querySelectorAll('col')) : [];
  if (colgroup && existing.length === n) return existing;

  const tableWidth = table.getBoundingClientRect().width || 1;
  const widths = new Array(n).fill(100 / n);
  const headerRow = table.rows[0];
  if (headerRow && !colgroup) {
    // Measure real rendered widths before we pin them down, so the table's
    // appearance doesn't change the moment a colgroup is introduced.
    let col = 0;
    Array.from(headerRow.cells).forEach(cell => {
      const span = parseInt(cell.getAttribute('colspan') || '1', 10);
      const pct = (cell.getBoundingClientRect().width / tableWidth) * 100 / span;
      for (let i = 0; i < span && col + i < n; i++) widths[col + i] = pct;
      col += span;
    });
  }

  if (!colgroup) {
    colgroup = document.createElement('colgroup');
    table.insertBefore(colgroup, table.firstChild);
  }
  colgroup.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const col = document.createElement('col');
    col.style.width = `${widths[i].toFixed(3)}%`;
    colgroup.appendChild(col);
  }
  return Array.from(colgroup.querySelectorAll('col'));
}

/** Drag-resize: borrows/gives width between column `colIndex` and its right
 *  neighbor so the table's total width never changes. */
export function resizeColumn(table: HTMLTableElement, colIndex: number, deltaPercent: number): void {
  const cols = ensureColgroup(table);
  if (colIndex < 0 || colIndex >= cols.length - 1) return;
  const n = cols.length;
  const fallback = 100 / n;
  const cur = parseFloat(cols[colIndex].style.width) || fallback;
  const next = parseFloat(cols[colIndex + 1].style.width) || fallback;
  const MIN = 6; // percent — keep every column usably wide
  let d = deltaPercent;
  if (cur + d < MIN) d = MIN - cur;
  if (next - d < MIN) d = next - MIN;
  cols[colIndex].style.width = `${(cur + d).toFixed(3)}%`;
  cols[colIndex + 1].style.width = `${(next - d).toFixed(3)}%`;
  table.classList.add('table-resized');
}

/** Insert a new empty data row. `afterRow` must be a <tbody> row (inserting
 *  relative to a header row isn't supported — new rows always land in the
 *  body); pass null to append at the end of the body. */
export function insertRow(table: HTMLTableElement, afterRow: HTMLTableRowElement | null): HTMLTableRowElement {
  let tbody = table.querySelector('tbody');
  if (!tbody) {
    tbody = document.createElement('tbody');
    const tfoot = table.querySelector('tfoot');
    table.insertBefore(tbody, tfoot || null);
  }
  const n = getColumnCount(table);
  const tr = document.createElement('tr');
  for (let i = 0; i < n; i++) {
    const td = document.createElement('td');
    td.innerHTML = '&nbsp;';
    tr.appendChild(td);
  }
  if (afterRow && afterRow.parentElement === tbody) afterRow.insertAdjacentElement('afterend', tr);
  else tbody.appendChild(tr);
  return tr;
}

/** Deletes a <tbody> row. Refuses on a header row or the last remaining
 *  body row (a table needs at least one data row). Returns whether it ran. */
export function deleteRow(row: HTMLTableRowElement): boolean {
  const tbody = row.parentElement;
  if (!tbody || tbody.tagName !== 'TBODY') return false;
  if (tbody.querySelectorAll('tr').length <= 1) return false;
  row.remove();
  return true;
}

function cellsInRow(row: Element): Element[] {
  return Array.from(row.querySelectorAll(':scope > th, :scope > td'));
}

/** Inserts a new column (an empty <td> in every body row, an empty <th> in
 *  every header row) to the left or right of `colIndex`, and grows the
 *  colgroup (if present) to match, redistributing widths equally. */
export function insertColumn(table: HTMLTableElement, colIndex: number, position: 'left' | 'right'): void {
  const insertAt = position === 'left' ? colIndex : colIndex + 1;
  table.querySelectorAll('tr').forEach(tr => {
    const cells = cellsInRow(tr);
    const isHeaderRow = tr.parentElement?.tagName === 'THEAD';
    const newCell = document.createElement(isHeaderRow ? 'th' : 'td');
    newCell.innerHTML = isHeaderRow ? 'New' : '&nbsp;';
    if (insertAt >= cells.length || !cells[insertAt]) tr.appendChild(newCell);
    else cells[insertAt].insertAdjacentElement('beforebegin', newCell);
  });

  const colgroup = table.querySelector('colgroup');
  if (colgroup) {
    const cols = Array.from(colgroup.querySelectorAll('col'));
    const newCol = document.createElement('col');
    if (insertAt >= cols.length || !cols[insertAt]) colgroup.appendChild(newCol);
    else cols[insertAt].insertAdjacentElement('beforebegin', newCol);
    const all = colgroup.querySelectorAll('col');
    const pct = (100 / all.length).toFixed(3);
    all.forEach(c => { (c as HTMLElement).style.width = `${pct}%`; });
  }
  table.classList.add('table-resized');
}

/** Deletes the column at `colIndex` from every row (and the colgroup, if
 *  present). Refuses if it's the table's last remaining column. */
export function deleteColumn(table: HTMLTableElement, colIndex: number): boolean {
  if (getColumnCount(table) <= 1) return false;
  table.querySelectorAll('tr').forEach(tr => {
    const cells = cellsInRow(tr);
    cells[colIndex]?.remove();
  });
  const colgroup = table.querySelector('colgroup');
  if (colgroup) {
    const cols = Array.from(colgroup.querySelectorAll('col'));
    cols[colIndex]?.remove();
    const remaining = colgroup.querySelectorAll('col');
    if (remaining.length) {
      const pct = (100 / remaining.length).toFixed(3);
      remaining.forEach(c => { (c as HTMLElement).style.width = `${pct}%`; });
    }
  }
  return true;
}
