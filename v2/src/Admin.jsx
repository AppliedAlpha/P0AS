import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Clock3, ExternalLink, LogOut, RefreshCw, Settings2, ShieldCheck, Users, KeyRound, X, Check, ClipboardList } from 'lucide-react';
import { Alert, Brand, Button } from './components';
import { api, formatTime } from './lib';
import StudentRoster from './StudentRoster';
import TokenManager from './TokenManager';
import Settings from './Settings';

const views = [{ key: 'students', label: '학생 명단', Icon: Users }, { key: 'tokens', label: '출석 토큰', Icon: KeyRound }, { key: 'settings', label: '운영 설정', Icon: Settings2 }];

export default function Admin({ config }) {
  const [data, setData] = useState(null);
  const [authError, setAuthError] = useState('');
  const [view, setView] = useState('students');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(() => api('/admin/overview').then(result => { setData(result); setAuthError(''); }).catch(error => { setAuthError(error.message); if (error.status === 401 || error.status === 403) setData(null); }), []);
  useEffect(() => { load(); const timer = setInterval(load, 10000); return () => clearInterval(timer); }, [load]);
  async function action(key, path, body, message) {
    setBusy(key); setNotice(null);
    try { const result = await api(path, body); await load(); if (message) setNotice({ text: typeof message === 'function' ? message(result) : message }); return result; }
    catch (error) { setNotice({ error: true, text: error.message }); return null; }
    finally { setBusy(''); }
  }
  async function logout() {
    try { await api('/logout', {}); if (!config.local) location.href = '/cdn-cgi/access/logout'; else setData(null); }
    catch (error) { setNotice({ error: true, text: error.message }); }
  }
  function navigate(key) { setView(key); setNotice(null); }
  if (!data) return <div className="admin-login"><header><Brand admin /><a className="text-link" href="/"><ArrowLeft size={16} />학생 화면</a></header><main><span className="login-symbol"><ShieldCheck size={32} strokeWidth={1.5} /></span><h1>관리자 로그인</h1>{authError && authError !== '인증을 다시 진행해주세요.' && <p className="login-hint">{authError}</p>}{config.local ? <Button busy={busy === 'login'} onClick={() => action('login', '/admin/local-login', {}, '')}>관리자 로그인<ArrowRight size={17} /></Button> : <a className="button button-primary" href="/api/admin/login">관리자 로그인<ArrowRight size={17} /></a>}</main></div>;
  const title = views.find(item => item.key === view).label;
  return <div className="admin-shell">
    <aside className="admin-sidebar"><Brand admin /><div className="sidebar-event"><strong>{data.settings.title}</strong></div><nav aria-label="관리 메뉴">{views.map(({ key, label, Icon }) => <button key={key} className={view === key ? 'active' : ''} aria-current={view === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={18} />{label}{key === 'students' && <span>{data.students.length}</span>}</button>)}</nav><div className="sidebar-bottom"><a href="/" target="_blank" rel="noreferrer"><ExternalLink size={16} />학생 화면</a><button onClick={logout}><LogOut size={16} />로그아웃</button></div></aside>
    <div className="admin-body"><header className="admin-topbar"><span className="mobile-brand">P0AS</span><div><button className="icon-button" aria-label="현황 새로고침" disabled={refreshing} onClick={async () => { setRefreshing(true); await load(); setRefreshing(false); }}><RefreshCw size={16} className={refreshing ? 'spin' : ''} /></button><button className="admin-avatar" aria-label="관리자 로그아웃" title="로그아웃" onClick={logout}><LogOut size={14} /></button></div></header>
      <nav className="admin-mobile-nav" aria-label="모바일 관리 메뉴">{views.map(({ key, label }) => <button key={key} aria-current={view === key ? 'page' : undefined} onClick={() => navigate(key)}>{label}</button>)}</nav>
      <main className="admin-main" id="main"><div className="admin-title-row"><h1>{title}</h1></div>
        {notice && <div className="notice-row"><Alert success={!notice.error}>{notice.text}</Alert><button className="icon-button" aria-label="알림 닫기" onClick={() => setNotice(null)}><X size={16} /></button></div>}
        {authError && <Alert>{authError}</Alert>}
        {view === 'students' && <div className="roster-layout"><StudentRoster students={data.students} busy={busy} onAction={action} /><Activity logs={data.logs} /></div>}
        {view === 'tokens' && <TokenManager tokens={data.tokens} batches={data.batches} title={data.settings.title} busy={busy} onAction={action} />}
        {view === 'settings' && <Settings key={JSON.stringify(data.settings)} settings={data.settings} busy={busy} onSave={settings => action('settings', '/admin/settings', settings, '저장했습니다.')} onReset={() => action('reset', '/admin/reset', { confirm: true }, '모두 초기화했습니다.')} />}
      </main>
    </div>
  </div>;
}

function Activity({ logs }) {
  return <aside className="activity-panel"><div className="section-heading"><h2><Clock3 size={16} />최근 활동</h2></div><ol>{logs.map(log => <li key={log.id}><span className={`activity-mark activity-${log.type.toLowerCase()}`}>{log.type === 'SUCCESS' ? <Check size={12} /> : log.type === 'FAILURE' ? <X size={12} /> : <ClipboardList size={12} />}</span><div><p>{log.description}</p>{log.student_id && <span className="activity-student">{log.student_id}</span>}<time dateTime={log.created_at}>{formatTime(log.created_at)}</time></div></li>)}</ol>{!logs.length && <p className="activity-empty">기록 없음</p>}</aside>;
}
