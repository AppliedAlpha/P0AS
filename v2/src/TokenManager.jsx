import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpDown, Plus, Printer, Search } from 'lucide-react';
import { Alert, Button } from './components';
import { downloadFile, filterTokens, formatTime } from './lib';
import TokenPrintSheet from './TokenPrintSheet';

export default function TokenManager({ tokens, batches, title, busy, onAction }) {
  const [count, setCount] = useState(30); const [label, setLabel] = useState('현장 배부용');
  const [query, setQuery] = useState(''); const [selected, setSelected] = useState(new Set()); const [pending, setPending] = useState(null);
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState({ sortBy: 'code', direction: 'asc' });
  const selectAllRef = useRef(null); const dialog = useRef(null);
  const sheetRef = useRef(null);
  const [printing, setPrinting] = useState(false); const [printError, setPrintError] = useState('');
  const shown = useMemo(() => filterTokens(tokens, { query, status, ...sort }), [tokens, query, status, sort]);
  const selectedIds = shown.filter(token => selected.has(token.id)).map(token => token.id);
  const checkedCount = shown.filter(token => selected.has(token.id)).length;
  const printable = shown.filter(token => token.code && (!selectedIds.length || selected.has(token.id)));
  useEffect(() => { if (selectAllRef.current) selectAllRef.current.indeterminate = checkedCount > 0 && checkedCount < shown.length; }, [checkedCount, shown.length]);
  useEffect(() => { if (pending && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [pending]);
  function toggle(id) { setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function toggleAll() { setSelected(previous => { const next = new Set(previous); for (const token of shown) { if (checkedCount === shown.length) next.delete(token.id); else next.add(token.id); } return next; }); }
  function sortColumn(sortBy) { setSort(previous => ({ sortBy, direction: previous.sortBy === sortBy && previous.direction === 'asc' ? 'desc' : 'asc' })); }
  function sortIcon(column) { return sort.sortBy !== column ? <ArrowUpDown size={13} /> : sort.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />; }
  function ariaSort(column) { return sort.sortBy === column ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'; }
  async function confirm() {
    const result = await onAction('manage', '/admin/tokens/manage', { action: pending.action, scope: pending.scope, ...(pending.scope === 'selected' ? { ids: selectedIds } : {}) }, result => `토큰 ${result.count}개를 ${pending.action === 'reset' ? '초기화' : '삭제'}했습니다.`);
    if (result) { setSelected(new Set()); dialog.current.close(); setPending(null); }
  }
  async function printTokens() {
    setPrinting(true); setPrintError('');
    try { await Promise.all([...sheetRef.current.querySelectorAll('img')].map(image => image.decode())); window.print(); }
    catch { setPrintError('QR코드를 불러오지 못했습니다. 새로고침 후 다시 인쇄해주세요.'); }
    finally { setPrinting(false); }
  }
  return <div className="token-workspace">
    <div className="attendance-summary"><p><strong>{tokens.filter(token => !token.used_by).length}개</strong> 배부 가능<span>/ 전체 {tokens.length}개</span></p></div>
    <section className="token-issue"><form onSubmit={async event => { event.preventDefault(); await onAction('issue', '/admin/tokens', { count: Number(count), label }, result => `${result.codes.length}개 발급했습니다.`); }}><div className="field"><label htmlFor="batch-label">묶음 이름</label><input id="batch-label" required maxLength={60} value={label} onChange={event => setLabel(event.target.value)} /></div><div className="field count-field"><label htmlFor="token-count">수량</label><input id="token-count" type="number" min={1} max={250} required value={count} onChange={event => setCount(event.target.value)} /></div><Button busy={busy === 'issue'} disabled={!!busy}><Plus size={17} />발급</Button></form></section>
    {printError && <Alert>{printError}</Alert>}
    <section className="token-list"><div className="table-toolbar"><div className="filter-tabs" aria-label="토큰 상태">{[['all', '전체'], ['unused', '배부 가능'], ['used', '사용 완료']].map(([key, label]) => <button key={key} aria-pressed={status === key} onClick={() => { setStatus(key); setSelected(new Set()); }}>{label}</button>)}</div><div className="toolbar-actions"><button className="icon-button" aria-label="토큰 다운로드" disabled={!printable.length} onClick={() => downloadFile('p0as-tokens.txt', printable.map(token => token.code).join('\n'))}><ArrowDownToLine size={17} /></button><button className="icon-button" aria-label="토큰 인쇄" disabled={!printable.length || printing} onClick={printTokens}><Printer size={17} /></button></div></div>
      <div className="token-toolbar"><div className="search-field"><Search size={17} /><input aria-label="토큰 또는 학번 검색" placeholder="토큰 또는 학번" value={query} onChange={event => { setQuery(event.target.value); setSelected(new Set()); }} /></div></div>
      <div className="token-management"><span>{selectedIds.length ? `${selectedIds.length}개 선택` : `${shown.length}개`}</span><Button className="button-secondary button-small" disabled={!selectedIds.length || !!busy} onClick={() => setPending({ action: 'delete', scope: 'selected', count: selectedIds.length })}>선택 삭제</Button><Button className="button-secondary button-small" disabled={!tokens.length || !!busy} onClick={() => setPending({ action: 'reset', scope: 'all', count: tokens.length })}>전체 초기화</Button><Button className="button-ghost button-small danger-text" disabled={!tokens.length || !!busy} onClick={() => setPending({ action: 'delete', scope: 'all', count: tokens.length })}>전체 삭제</Button></div>
      <div className="table-scroll" role="region" aria-label="출석 토큰 표" tabIndex={0}><table className="token-table"><thead><tr><th scope="col" className="checkbox-cell"><input ref={selectAllRef} type="checkbox" aria-label="표시된 토큰 모두 선택" checked={shown.length > 0 && checkedCount === shown.length} onChange={toggleAll} disabled={!shown.length} /></th><th scope="col" aria-sort={ariaSort('code')}><button className="sort-button" onClick={() => sortColumn('code')}>토큰{sortIcon('code')}</button></th><th scope="col">묶음</th><th scope="col">상태</th><th scope="col" aria-sort={ariaSort('used_by')}><button className="sort-button" onClick={() => sortColumn('used_by')}>사용 학번{sortIcon('used_by')}</button></th><th scope="col" aria-sort={ariaSort('used_at')}><button className="sort-button" onClick={() => sortColumn('used_at')}>처리 시각{sortIcon('used_at')}</button></th></tr></thead><tbody>{shown.map(token => <tr key={token.id} className={selected.has(token.id) ? 'selected-row' : ''}><td className="checkbox-cell"><input type="checkbox" aria-label={`토큰 ${token.code || token.hint} 선택`} checked={selected.has(token.id)} onChange={() => toggle(token.id)} /></td><td className="token-code numeric">{token.code || <span className="legacy-token">재발급 필요</span>}</td><td>{batches.find(batch => batch.id === token.batch_id)?.label}</td><td><span className={`attendance-label ${token.used_by ? 'is-attended' : ''}`}>{token.used_by ? '사용 완료' : '배부 가능'}</span></td><td className="numeric">{token.used_by || '—'}</td><td className="time-cell">{formatTime(token.used_at)}</td></tr>)}</tbody></table></div>
      {!shown.length && <div className="empty-state"><h3>{tokens.length ? '조건에 맞는 토큰이 없습니다.' : '발급된 토큰이 없습니다.'}</h3></div>}
    </section>
    <dialog ref={dialog} className="confirm-dialog" aria-labelledby="token-action-title" onClose={() => setPending(null)}><h2 id="token-action-title">토큰 {pending?.count}개 {pending?.action === 'reset' ? '초기화' : '삭제'}</h2><p>{pending?.action === 'reset' ? '전체 토큰의 사용 상태를 초기화합니다.' : pending?.scope === 'all' ? '전체 토큰을 삭제합니다. 되돌릴 수 없습니다.' : '선택한 토큰을 삭제합니다. 되돌릴 수 없습니다.'}<br />기존 학생의 출결 기록은 유지됩니다.</p><div className="inline-actions"><Button className="button-secondary" disabled={!!busy} onClick={() => dialog.current.close()}>취소</Button><Button className={pending?.action === 'delete' ? 'button-danger' : 'button-primary'} busy={busy === 'manage'} onClick={confirm}>{pending?.action === 'reset' ? '초기화' : '삭제'}</Button></div></dialog>
    <TokenPrintSheet tokens={printable} title={title} sheetRef={sheetRef} />
  </div>;
}
