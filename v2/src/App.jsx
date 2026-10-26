import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, LockKeyhole } from 'lucide-react';
import { api, formatTime, typeLabels } from './lib';
import { Alert, Brand, Button, Field } from './components';
import PrivacyConsent from './PrivacyConsent';

const Admin = lazy(() => import('./Admin'));
function PageLoading() { return <div className="page-loading" role="status"><Brand /><div className="skeleton" /><p>불러오는 중…</p></div>; }

export default function App() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true; let loaded = false;
    const refresh = () => api('/config').then(data => { if (active) { loaded = true; setConfig(data); setError(''); } }).catch(error => { if (active && !loaded) setError(error.message); });
    refresh(); const timer = setInterval(refresh, 10000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  if (error) return <div className="page-loading"><Brand /><Alert>{error}</Alert><Button onClick={() => location.reload()}>다시 연결</Button></div>;
  if (!config) return <PageLoading />;
  if (location.pathname.startsWith('/manage')) return <Suspense fallback={<PageLoading />}><Admin config={config} /></Suspense>;
  return <Student config={config} lookup={location.pathname === '/check'} />;
}

function Student({ config, lookup }) {
  const [form, setForm] = useState({ studentId: '', name: '', token: '' });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [locked, setLocked] = useState(false);
  const update = key => event => setForm(previous => ({ ...previous, [key]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const identity = await api('/session', { studentId: form.studentId, name: form.name, consent });
      const data = lookup ? identity : await api('/attendance', { token: form.token, consent });
      setResult(data.student);
    } catch (error) { setError(error.message); if (error.code === 'LOCKED') setLocked(true); }
    finally { setBusy(false); }
  }
  async function reset() {
    try { await api('/logout', {}); setResult(null); setForm({ studentId: '', name: '', token: '' }); setConsent(false); setLocked(false); setError(''); }
    catch (error) { setError(error.message); }
  }
  return <div className="student-page">
    <header className="student-header"><Brand /></header>
    <main id="main" className="student-layout">
      <h1 className="event-title">{config.title}</h1>
      <nav className="student-tabs" aria-label="출결 메뉴"><a href="/" aria-current={!lookup ? 'page' : undefined}>출석하기</a><a href="/check" aria-current={lookup ? 'page' : undefined}>결과 조회</a></nav>
      <section className="student-workspace" aria-label={lookup ? '출석 결과 조회' : '출석 등록'}>
        {result ? <Result student={result} onReset={reset} /> : <>
          <h2 className="form-title">{lookup ? '출석 결과 조회' : '현장 출석'}</h2>
          {!lookup && config.state !== 'OPEN' ? <div className="closed-state"><LockKeyhole size={32} strokeWidth={1.5} /><h3>{config.state === 'PRE' ? '출석 시작 전입니다.' : '출석이 종료되었습니다.'}</h3><Button onClick={() => { location.href = config.state === 'PRE' ? '/' : '/check'; }}>{config.state === 'PRE' ? '새로고침' : '결과 조회'}<ArrowRight size={17} /></Button></div> : <form onSubmit={submit} className="attendance-form">
            <Field id="student-id" label="학번" autoComplete="username" inputMode="numeric" required minLength={4} maxLength={24} value={form.studentId} onChange={update('studentId')} disabled={busy || locked} />
            <Field id="student-name" label="이름" autoComplete="name" required maxLength={40} value={form.name} onChange={update('name')} disabled={busy || locked} />
            {!lookup && <div className="token-field"><label htmlFor="attendance-token">출석 토큰</label><input id="attendance-token" className="token-input" inputMode="numeric" autoComplete="off" placeholder="000000" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={form.token} onChange={event => setForm(previous => ({ ...previous, token: event.target.value.replace(/\D/g, '') }))} disabled={busy || locked} /></div>}
            <PrivacyConsent checked={consent} onChange={setConsent} disabled={busy || locked} />
            {error && <Alert>{error}</Alert>}
            <Button className="button-primary button-full" busy={busy} disabled={locked || !consent}>{busy ? '처리 중…' : locked ? '조교에게 문의해주세요' : lookup ? '출석 결과 확인' : '출석 완료하기'}{!busy && !locked && <ArrowRight size={18} />}</Button>
          </form>}
        </>}
      </section>
    </main>
  </div>;
}

function Result({ student, onReset }) {
  return <div className="result-view" aria-live="polite"><span className={`result-symbol ${student.is_attended ? '' : 'result-pending'}`}>{student.is_attended ? <Check size={32} /> : <ClipboardCheck size={32} />}</span><h2>{student.is_attended ? '출석이 확인되었습니다.' : '출석 기록이 없습니다.'}</h2><dl className="receipt"><div><dt>학번</dt><dd>{student.id}</dd></div><div><dt>출석 유형</dt><dd>{typeLabels[student.attendance_type]}</dd></div><div><dt>점수</dt><dd>{student.score}점</dd></div><div><dt>처리 시각</dt><dd>{formatTime(student.attended_at)}</dd></div></dl><Button className="button-secondary button-full" onClick={onReset}><ArrowLeft size={17} />다른 정보로 확인</Button></div>;
}
