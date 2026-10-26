import { useMemo, useState } from 'react';
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpDown, Check, Eye, EyeOff, FileUp, LockKeyhole, Search } from 'lucide-react';
import { Alert, Button } from './components';
import { exportStudents, filterStudents, formatTime, parseRoster, typeLabels, visibleName } from './lib';

export default function StudentRoster({ students, busy, onAction }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [attendanceType, setAttendanceType] = useState('all');
  const [sort, setSort] = useState({ sortBy: 'id', direction: 'asc' });
  const [showNames, setShowNames] = useState(false);
  const [importing, setImporting] = useState(false);
  const filtered = useMemo(() => filterStudents(students, { query, filter, attendanceType, ...sort }), [students, query, filter, attendanceType, sort]);
  function sortColumn(sortBy) { setSort(previous => ({ sortBy, direction: previous.sortBy === sortBy && previous.direction === 'asc' ? 'desc' : 'asc' })); }
  function sortIcon(column) { return sort.sortBy !== column ? <ArrowUpDown size={13} /> : sort.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />; }
  function ariaSort(column) { return sort.sortBy === column ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'; }
  const attended = students.filter(student => student.is_attended).length;
  return <section className="roster-workspace">
    <div className="attendance-summary"><p><strong>{attended}명</strong> 출석<span>/ 전체 {students.length}명</span></p></div>
    <div className="roster-section">
      <div className="table-toolbar"><div className="filter-tabs" aria-label="학생 필터">{[['all', '전체'], ['attended', '출석'], ['absent', '미출석'], ['locked', '잠금']].map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div><div className="toolbar-actions"><Button className="button-secondary button-small" onClick={() => setImporting(value => !value)}><FileUp size={15} />명단 등록</Button><button className="icon-button" aria-label="표시된 명단 CSV 다운로드" onClick={() => exportStudents(filtered, showNames)}><ArrowDownToLine size={17} /></button></div></div>
      {importing && <RosterImport busy={busy === 'import'} onCancel={() => setImporting(false)} onImport={async rows => { const result = await onAction('import', '/admin/students', { students: rows }, '명단을 등록했습니다.'); if (result) setImporting(false); }} />}
      <div className="roster-controls"><div className="search-field"><Search size={17} /><input aria-label="학번 또는 이름 검색" placeholder="학번 또는 이름" value={query} onChange={event => setQuery(event.target.value)} /><span>{filtered.length}명</span></div><button className="button button-ghost button-small" aria-pressed={showNames} onClick={() => setShowNames(value => !value)}>{showNames ? <EyeOff size={15} /> : <Eye size={15} />}{showNames ? '이름 가리기' : '이름 표시'}</button></div>
      {filter === 'attended' && <div className="attendance-type-filter"><label htmlFor="attendance-type">출석 유형</label><select id="attendance-type" value={attendanceType} onChange={event => setAttendanceType(event.target.value)}><option value="all">모두</option>{['FIELD', 'ASSIGNMENT', 'MANUAL'].map(type => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></div>}
      <div className="table-scroll"><table className="student-table"><thead><tr><th scope="col" aria-sort={ariaSort('id')}><button className="sort-button" onClick={() => sortColumn('id')}>학번{sortIcon('id')}</button></th><th scope="col">이름</th><th scope="col">출석 유형</th><th scope="col">점수</th><th scope="col" aria-sort={ariaSort('attended_at')}><button className="sort-button" onClick={() => sortColumn('attended_at')}>처리 시각{sortIcon('attended_at')}</button></th><th scope="col"><span className="sr-only">학생 관리</span></th></tr></thead><tbody>{filtered.map(student => <tr key={student.id}><td className="numeric student-id">{student.id}</td><td><strong>{visibleName(student, showNames)}</strong></td><td><span className={`attendance-label ${student.is_attended ? 'is-attended' : student.trial_count >= 3 ? 'is-locked' : ''}`}>{student.is_attended ? <Check size={13} /> : student.trial_count >= 3 ? <LockKeyhole size={12} /> : null}{student.trial_count >= 3 && !student.is_attended ? '입력 잠금' : typeLabels[student.attendance_type]}</span></td><td className="numeric">{student.score}</td><td className="time-cell">{formatTime(student.attended_at)}</td><td><div className="row-actions">{!student.is_attended && <><button disabled={!!busy} onClick={() => onAction(student.id, '/admin/approve', { studentId: student.id, type: 'MANUAL' }, '수동 승인했습니다.')}>수동</button><button disabled={!!busy} onClick={() => onAction(student.id, '/admin/approve', { studentId: student.id, type: 'ASSIGNMENT' }, '과제 인정했습니다.')}>과제</button></>}{student.trial_count > 0 && <button className="unlock-action" disabled={!!busy} onClick={() => onAction(student.id, '/admin/unlock', { studentId: student.id }, '잠금을 해제했습니다.')}>잠금 해제</button>}</div></td></tr>)}</tbody></table></div>
      {!filtered.length && <div className="empty-state"><Search size={25} /><h3>{students.length ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}</h3></div>}
    </div>
  </section>;
}

function RosterImport({ busy, onImport, onCancel }) {
  const [text, setText] = useState(''); const [error, setError] = useState('');
  return <form className="inline-panel" onSubmit={event => { event.preventDefault(); try { setError(''); onImport(parseRoster(text)); } catch (error) { setError(error.message); } }}><h3>명단 등록</h3><label className="sr-only" htmlFor="roster-input">명단 CSV</label><textarea id="roster-input" rows={5} placeholder={'학번,이름'} value={text} onChange={event => setText(event.target.value)} required /><label className="file-input"><FileUp size={15} />CSV 파일<input type="file" accept=".csv,text/csv" onChange={async event => { if (event.target.files[0]) setText(await event.target.files[0].text()); }} /></label>{error && <Alert>{error}</Alert>}<div className="inline-actions"><Button busy={busy} className="button-primary button-small">등록하기</Button><Button type="button" className="button-ghost button-small" onClick={onCancel}>취소</Button></div></form>;
}
