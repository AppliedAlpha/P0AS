export async function api(path, body) {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', cache: 'no-store', ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  let data;
  try { data = await response.json(); } catch { throw new Error('서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.'); }
  if (!response.ok) { const error = new Error(data.error || '요청을 처리하지 못했습니다.'); error.code = data.code; error.status = response.status; throw error; }
  return data;
}
export const typeLabels = { FIELD: '현장 출석', MANUAL: '수동 승인', ASSIGNMENT: '과제 인정', NONE: '미출석' };
export const stateLabels = { PRE: '시작 전', OPEN: '출석 진행 중', CLOSED: '출석 종료' };
export function formatTime(value) { return value ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '—'; }
export function downloadFile(name, text, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csvCell(value) { const text = String(value ?? ''); return '"' + (/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"'; }
export function visibleName(student, showNames) { return showNames ? student.name || student.name_mask : student.name_mask; }
export function filterStudents(students, { query = '', filter = 'all', attendanceType = 'all', sortBy = 'id', direction = 'asc' } = {}) {
  const collator = new Intl.Collator('ko', { numeric: true });
  return students.filter(student => {
    if (query && !`${student.id} ${student.name || ''} ${student.name_mask}`.includes(query)) return false;
    if (filter === 'attended' && (!student.is_attended || attendanceType !== 'all' && student.attendance_type !== attendanceType)) return false;
    if (filter === 'absent' && student.is_attended) return false;
    if (filter === 'locked' && student.trial_count < 3) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'attended_at') {
      if (!a.attended_at && !b.attended_at) return collator.compare(a.id, b.id);
      if (!a.attended_at) return 1;
      if (!b.attended_at) return -1;
    }
    const difference = collator.compare(a[sortBy] || '', b[sortBy] || '');
    return (direction === 'asc' ? difference : -difference) || collator.compare(a.id, b.id);
  });
}
export function exportStudents(students, showNames = false) {
  const rows = [['학번', showNames ? '성명' : '성명(마스킹)', '출석 유형', '점수', '처리 시각'], ...students.map(s => [s.id, visibleName(s, showNames), typeLabels[s.attendance_type] || s.attendance_type, s.score, formatTime(s.attended_at)])];
  downloadFile('p0as-attendance.csv', '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}
export function parseRoster(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  const raw = text.replace(/^\uFEFF/, '');
  for (let i = 0; i <= raw.length; i++) {
    const c = raw[i];
    if (c === '"') { if (quoted && raw[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === ',' || c === '\n' || c === undefined)) { row.push(cell.trim()); cell = ''; if (c !== ',') { if (row.some(Boolean)) rows.push(row); row = []; } }
    else if (c !== '\r' || quoted) cell += c;
  }
  if (quoted) throw new Error('CSV의 따옴표가 닫히지 않았습니다.');
  if (['student_id', '학번'].includes(rows[0]?.[0])) rows.shift();
  if (rows.some(row => row.length !== 2)) throw new Error('학번,이름 순서로 두 열을 입력해주세요.');
  return rows.map(([studentId, name]) => ({ studentId, name }));
}
