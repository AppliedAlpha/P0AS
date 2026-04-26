import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, getDoc, updateDoc, collection,
  onSnapshot, query, runTransaction, serverTimestamp, setDoc
} from 'firebase/firestore';
import {
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken,
  GoogleAuthProvider, signInWithPopup, signOut
} from 'firebase/auth';
import {
  CheckCircle2, AlertCircle, Lock, ShieldCheck,
  User, Key, LogOut, Download, Search, RefreshCw, LayoutDashboard, ClipboardCheck, Info, X, Bell, Clock, Award, ChevronRight, Tickets, FileText, UserCheck, ShieldAlert, LogIn, Copy, Terminal
} from 'lucide-react';

// --- Safe Environment Variable Access ---
const safeEnv = (key, fallback = "") => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) { }
  return fallback;
};

const firebaseConfig = typeof __firebase_config !== 'undefined'
  ? JSON.parse(__firebase_config)
  : {
    apiKey: safeEnv("VITE_FIREBASE_API_KEY"),
    authDomain: safeEnv("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: safeEnv("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: safeEnv("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: safeEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: safeEnv("VITE_FIREBASE_APP_ID")
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = typeof __app_id !== 'undefined' ? __app_id : safeEnv("VITE_APP_ID", "p0as");
const NAME_SALT = safeEnv("VITE_NAME_SALT", "APPLIEDALPHA_020823");

// --- Constants & Utils ---
const ATTENDANCE_LABELS = {
  'FIELD': '현장 출석', 'ASSIGNMENT': '과제 인정', 'MANUAL': '수동 출석(조교 확인)',
  'ABSENT': '미출석', 'LATE': '지각', 'EXCUSED': '공결(사유 인정)',
  'PENDING': '확인 중', 'NONE': '기록 없음'
};

const ATTENDANCE_THEME = {
  'FIELD': { color: 'text-green-700 bg-green-50 border-green-200', icon: <UserCheck className="w-3.5 h-3.5" /> },
  'ASSIGNMENT': { color: 'text-blue-700 bg-blue-50 border-blue-200', icon: <FileText className="w-3.5 h-3.5" /> },
  'MANUAL': { color: 'text-purple-700 bg-purple-50 border-purple-200', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  'ABSENT': { color: 'text-red-700 bg-red-50 border-red-200', icon: <X className="w-3.5 h-3.5" /> },
  'LATE': { color: 'text-yellow-700 bg-yellow-50 border-yellow-200', icon: <Clock className="w-3.5 h-3.5" /> },
  'EXCUSED': { color: 'text-slate-700 bg-slate-50 border-slate-200', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  'PENDING': { color: 'text-orange-700 bg-orange-50 border-orange-200', icon: <Clock className="w-3.5 h-3.5" /> },
  'NONE': { color: 'text-gray-400 bg-transparent border-gray-100', icon: <AlertCircle className="w-3.5 h-3.5" /> }
};

const generateHash = async (text) => {
  const msgUint8 = new TextEncoder().encode(text + NAME_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const formatTime = (timestamp, full = true) => {
  if (!timestamp) return "-";
  const date = timestamp.toDate();
  return full ? date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

const formatBoldText = (text) => {
  if (!text) return "";
  return text.split(/(\*\*.*?\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**')) ? <b key={i}>{part.slice(2, -2)}</b> : part);
};

const THROTTLE_TIME = 2000;
const checkRateLimit = (actionKey) => {
  const now = Date.now();
  const storageKey = `p0as_last_action_${actionKey}`;
  const lastAction = localStorage.getItem(storageKey);
  if (lastAction && now - parseInt(lastAction) < THROTTLE_TIME) {
    throw new Error(`요청이 너무 빠릅니다. **${Math.ceil((THROTTLE_TIME - (now - parseInt(lastAction))) / 1000)}초** 뒤에 다시 시도하세요.`);
  }
  localStorage.setItem(storageKey, now.toString());
};

const StatusBadge = ({ type }) => {
  const upperType = type?.toUpperCase() || 'NONE';
  const label = ATTENDANCE_LABELS[upperType] || ATTENDANCE_LABELS['NONE'];
  const theme = ATTENDANCE_THEME[upperType] || ATTENDANCE_THEME['NONE'];
  return (
    <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold shadow-sm ${theme.color}`}>
      {theme.icon} {label}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [systemStatus, setSystemStatus] = useState('PRE');
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth Error:", err); }
    };
    initAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (curr) => {
      setUser(curr);
      setLoading(false);
    });
    const handleLoc = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handleLoc);
    return () => { unsubscribeAuth(); window.removeEventListener('popstate', handleLoc); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'attendance_status');
    const unsub = onSnapshot(ref, (snap) => { if (snap.exists()) setSystemStatus(snap.data().value); });
    return () => unsub();
  }, [user]);

  if (loading) return <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-500 font-medium text-sm text-center"><RefreshCw className="w-8 h-8 animate-spin mb-4 text-indigo-500 mx-auto" /><p className="font-bold tracking-tight">강의 데이터를 동기화하고 있습니다...</p></div>;
  if (path === '/manage') return <AdminDashboard systemStatus={systemStatus} user={user} onExit={() => { window.location.href = '/'; }} />;
  if (path === '/check') return <CheckView onBack={() => { window.location.href = '/'; }} />;

  return (<div className="min-h-[100dvh] bg-slate-50 text-slate-900 overflow-x-hidden p0as-root"><StudentView systemStatus={systemStatus} /><GlobalStyle /></div>);
}

// --- Student View ---
function StudentView({ systemStatus: currentSystemStatus }) {
  const [step, setStep] = useState('input');
  const [form, setForm] = useState({ studentId: '', name: '', token: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultData, setResultData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      checkRateLimit('submit');
      const sRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'attendance_status');
      const sSnap = await getDoc(sRef);
      if (!sSnap.exists() || sSnap.data().value !== 'OPEN') throw new Error('현재는 출결이 진행 중인 상태가 아닙니다.');

      const sid = form.studentId.trim();
      const nm = form.name.trim();
      const tk = form.token.trim();
      if (!/^\d+$/.test(sid) || sid.length < 5) throw new Error('유효한 학번 형식이 아닙니다.');

      const studentRef = doc(db, 'artifacts', appId, 'public', 'data', 'students', sid);
      const studentSnap = await getDoc(studentRef);
      const h = await generateHash(nm);
      if (!studentSnap.exists() || studentSnap.data().name_hash !== h) throw new Error('학번 혹은 이름을 다시 확인해주세요.');

      const sData = studentSnap.data();
      if (sData.trial_count >= 3) { setStep('locked'); return; }
      if (sData.is_attended) throw new Error('이미 출결 처리된 학생입니다.');

      const tokenRef = doc(db, 'artifacts', appId, 'public', 'data', 'tokens', tk);
      const res = await runTransaction(db, async (tx) => {
        const tSnap = await tx.get(tokenRef);
        if (!tSnap.exists() || tSnap.data().is_used) {
          const nt = (sData.trial_count || 0) + 1;
          tx.update(studentRef, { trial_count: nt });
          tx.set(doc(collection(db, 'artifacts', appId, 'public', 'data', 'logs')), { studentId: sid, type: 'FAILURE', time: serverTimestamp(), desc: `인증 실패 (${tk}) - ${nt}/3` });
          return { success: false, nt };
        }
        tx.update(studentRef, { is_attended: true, score: 5, attendance_type: 'FIELD', attended_at: serverTimestamp() });
        tx.update(tokenRef, { is_used: true, used_by: sid, used_at: serverTimestamp() });
        tx.set(doc(collection(db, 'artifacts', appId, 'public', 'data', 'logs')), { studentId: sid, type: 'SUCCESS', time: serverTimestamp(), desc: `출석 성공 (토큰: ${tk})` });
        return { success: true };
      });

      if (!res.success) throw new Error(`유효하지 않은 토큰입니다. (**${res.nt}/3회** 실패)`);
      setResultData({ ...sData, is_attended: true, attendance_type: 'FIELD', score: 5, student_id: sid });
      setStep('success');
    } catch (err) {
      setError(err.code === 'permission-denied' ? "서버 권한이 없습니다. 관리자 설정을 확인하세요." : err.message);
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="max-w-md mx-auto h-[100dvh] px-6 flex flex-col justify-center py-4">
      <div className="text-center mb-4 shrink-0 font-bold">
        <div className="inline-block p-2.5 bg-indigo-600 rounded-2xl mb-2 shadow-lg shadow-indigo-100"><ShieldCheck className="w-6 h-6 text-white" /></div>
        <h1 className="text-xl font-black text-slate-800 tracking-tight">K-MOOC 특강 출결</h1>
      </div>
      {currentSystemStatus === 'OPEN' ? (
        <div className="shrink-0 font-bold">
          {step === 'input' && (
            <div className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-slate-200">
              <div className="mb-3 p-1.5 rounded-lg text-center font-black text-[10px] uppercase tracking-[0.1em] border bg-green-50 text-green-600 border-green-100 font-bold">출석 진행 중</div>
              <form onSubmit={handleSubmit} className="space-y-2.5">
                <InputGroup label="Student ID" icon={<User className="w-4 h-4" />} value={form.studentId} onChange={v => setForm({ ...form, studentId: v })} placeholder="학번 입력" />
                <InputGroup label="Name" icon={<ShieldCheck className="w-4 h-4" />} value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="성명 입력" />
                <InputGroup label="Token Code" icon={<Key className="w-4 h-4" />} value={form.token} onChange={v => setForm({ ...form, token: v.replace(/[^0-9]/g, '') })} placeholder="000000" isToken />
                {error && <ErrorMessage message={error} />}
                <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-200 text-white font-black py-3 rounded-xl transition-all shadow-lg active:scale-[0.98]">{isSubmitting ? '처리 중...' : '출석 완료'}</button>
              </form>
            </div>
          )}
          {step === 'success' && <SuccessCard resultData={resultData} onReset={() => setStep('input')} />}
          {step === 'locked' && <LockedCard onReset={() => setStep('input')} />}
        </div>
      ) : (
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 text-center animate-in fade-in slide-in-from-bottom-4 duration-500 shrink-0 font-bold">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4"><Info className="w-6 h-6 text-slate-400" /></div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">{currentSystemStatus === 'PRE' ? '출결 시작 전' : '출결 종료'}</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed font-medium font-bold">{currentSystemStatus === 'PRE' ? '강의 시작 후 토큰을 배부받아 등록하세요.' : '현재는 결과 조회만 가능합니다.'}</p>
          <button onClick={() => { window.location.href = '/check'; }} className="w-full bg-indigo-50 text-indigo-600 font-black py-3.5 rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 shadow-sm font-bold font-bold">결과 조회하기 <ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
      <footer className="mt-4 text-center shrink-0 font-bold"><button onClick={() => { window.location.href = '/check'; }} className="px-6 py-2 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-all text-[11px] border border-slate-200 shadow-sm font-bold">내 출결 확인하기</button></footer>
    </div>
  );
}

// --- Check View ---
function CheckView({ onBack }) {
  const [form, setForm] = useState({ studentId: '', name: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleLookup = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setError('');
    try {
      checkRateLimit('lookup');
      const sid = form.studentId.trim();
      const nm = form.name.trim();
      if (sid.length < 5) throw new Error("학번이 너무 짧습니다.");
      const sRef = doc(db, 'artifacts', appId, 'public', 'data', 'students', sid);
      const sSnap = await getDoc(sRef);
      const h = await generateHash(nm);
      if (!studentSnap.exists() || studentSnap.data().name_hash !== h) throw new Error('정보가 일치하지 않습니다.');
      setResult(sSnap.data());
      setStatus('found');
    } catch (err) { setError(err.message); setStatus('idle'); }
  };

  return (
    <div className="max-w-md mx-auto h-[100dvh] px-6 flex flex-col justify-center py-6 font-bold">
      <div className="text-center mb-8 shrink-0 font-bold font-bold">
        <div className="inline-block p-3.5 bg-slate-100 rounded-3xl mb-3"><ClipboardCheck className="w-7 h-7 text-slate-600" /></div>
        <h1 className="text-2xl font-black tracking-tight text-slate-800">결과 조회</h1>
        <p className="text-sm text-slate-400 mt-1 font-bold">학번과 성명을 입력하세요.</p>
      </div>
      {status === 'found' ? (
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border-4 border-indigo-50 animate-in zoom-in duration-300 text-center shrink-0 font-bold">
          <span className={`inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 ${result.is_attended ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-400'}`}>{result.is_attended ? 'Confirmed' : 'Not Attended'}</span>
          <h2 className="text-2xl font-black text-slate-800 mb-6 font-bold font-bold">{result.name} 학생</h2>
          <div className="space-y-2 mb-8 text-left">
            <ResultRow label="출석 점수" value={`${result.score}점`} isBold />
            <ResultRow label="유형" value={<StatusBadge type={result.attendance_type} />} />
            <ResultRow label="시각" value={formatTime(result.attended_at)} />
          </div>
          <button onClick={onBack} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all font-bold">돌아가기</button>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-200 shrink-0 font-bold font-bold">
          <form onSubmit={handleLookup} className="space-y-4">
            <InputGroup label="Student ID" icon={<User className="w-4 h-4" />} value={form.studentId} onChange={v => setForm({ ...form, studentId: v })} placeholder="학번 입력" />
            <InputGroup label="Name" icon={<ShieldCheck className="w-4 h-4" />} value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="성명 입력" />
            {error && <ErrorMessage message={error} />}
            <button type="submit" disabled={status === 'loading'} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl shadow-xl mt-2 font-bold">{status === 'loading' ? '조회 중...' : '결과 조회하기'}</button>
            <button type="button" onClick={onBack} className="w-full text-xs font-bold text-slate-400 py-3 uppercase tracking-widest font-bold">이전으로</button>
          </form>
        </div>
      )}
      <GlobalStyle />
    </div>
  );
}

// --- Admin Dashboard (향상된 보안 대응 버전) ---
function AdminDashboard({ onExit, systemStatus, user }) {
  const [students, setStudents] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [activeView, setActiveView] = useState('STUDENTS');
  const [activeTab, setActiveTab] = useState('ALL');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [hasPermission, setHasPermission] = useState(true);

  const handleAdminLogin = async () => {
    const provider = new GoogleAuthProvider();
    // 팝업 시 캐시 충돌 방지를 위해 강제 선택 유도
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      setToast({ show: true, message: `안녕하세요, **${result.user.displayName}**님!`, type: 'success' });
      setHasPermission(true);
    } catch (err) {
      setToast({ show: true, message: "인증 실패: " + err.message, type: 'error' });
    }
  };

  useEffect(() => {
    // [중요] 익명 사용자인 경우 쿼리를 원천 차단하여 에러 스트림 발생 방지
    if (!user || user.isAnonymous) return;

    // 인증 정보가 Firestore 내부 엔진에 전파되는 시간을 벌어줌 (Race condition 방지)
    const timer = setTimeout(() => {
      console.log("🛠️ Firestore Listeners 연결 시도 중... UID:", user.uid);

      const unsubS = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'students'),
        (snap) => {
          setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          setHasPermission(true);
        },
        (err) => {
          console.error("❌ 학생 데이터 로드 권한 거부됨:", err);
          if (err.code === 'permission-denied') setHasPermission(false);
        }
      );

      const unsubT = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tokens'),
        (snap) => setTokens(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
        (err) => console.error("❌ 토큰 데이터 로드 권한 거부됨:", err)
      );

      const unsubL = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'logs'),
        (snap) => {
          const sorted = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (b.time?.seconds || 0) - (a.time?.seconds || 0));
          setLogs(sorted);
        },
        (err) => console.error("❌ 로그 데이터 로드 권한 거부됨:", err)
      );

      return () => { unsubS(); unsubT(); unsubL(); };
    }, 500); // 0.5초의 유예 시간을 줌

    return () => clearTimeout(timer);
  }, [user]);

  const updateSystemStatus = async (s) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'attendance_status'), { value: s });
      setToast({ show: true, message: `시스템이 **${s}** 상태로 변경됨`, type: 'success' });
    } catch (err) { setToast({ show: true, message: "명령 실행 권한이 없습니다.", type: 'error' }); }
  };

  const manualApprove = async (sId, t) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', sId), { is_attended: true, score: 5, attendance_type: t.toUpperCase(), attended_at: serverTimestamp() });
      await setDoc(doc(collection(db, 'artifacts', appId, 'public', 'data', 'logs')), { studentId: sId, type: 'MANUAL', time: serverTimestamp(), desc: `관리자 강제 승인 (${t})` });
      setToast({ show: true, message: `**${sId}** 학생 승인 완료`, type: 'success' });
    } catch (err) { setToast({ show: true, message: "수정 권한이 없습니다.", type: 'error' }); }
  };

  const resetLock = async (sId) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', sId), { trial_count: 0 });
      setToast({ show: true, message: `**${sId}** 잠금 해제됨`, type: 'success' });
    } catch (err) { setToast({ show: true, message: "수정 권한이 없습니다.", type: 'error' }); }
  };

  const filteredStudents = useMemo(() => students.filter(s => { const match = (s.student_id || "").includes(searchTerm) || (s.name || "").includes(searchTerm); return activeTab === 'LOCKED' ? match && s.trial_count >= 3 : activeTab === 'ATTENDED' ? match && s.is_attended : match; }), [students, searchTerm, activeTab]);
  const filteredTokens = useMemo(() => tokens.filter(t => (t.id || "").includes(searchTerm) || (t.used_by || "").includes(searchTerm)).sort((a, b) => b.is_used - a.is_used), [tokens, searchTerm]);
  const filteredLogs = useMemo(() => logs.filter(log => (log.studentId || "").toLowerCase().includes(logSearchTerm.toLowerCase())).slice(0, 50), [logs, logSearchTerm]);

  const exportCSV = () => {
    const h = "\ufeff학번,성명,출석여부,유형,점수,인증시간\n";
    const b = students.map(s => `${s.student_id},${s.name},${s.is_attended ? 'O' : 'X'},${ATTENDANCE_LABELS[s.attendance_type?.toUpperCase()] || s.attendance_type},${s.score},${s.attended_at?.toDate()?.toLocaleString() || '-'}`).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([h + b], { type: 'text/csv;charset=utf-8;' })); link.download = `p0as_report.csv`; link.click();
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 relative font-sans p0as-root font-bold">
      {toast.show && <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-10 duration-300"><div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${toast.type === 'success' ? 'bg-indigo-900 text-white border-indigo-800' : 'bg-red-600 text-white border-red-500'}`}><Bell className="w-4 h-4" /><div className="text-sm font-medium">{formatBoldText(toast.message)}</div></div></div>}

      <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shadow-sm z-20 shrink-0 font-bold">
        <div className="flex items-center gap-4"><div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg"><LayoutDashboard className="w-5 h-5" /></div><div><h1 className="font-black text-xl text-slate-800 uppercase leading-none tracking-tighter font-bold">p0as ADMIN</h1><div className="flex items-center gap-1.5 mt-1">{(!user || user.isAnonymous) ? <span className="text-[9px] text-orange-500 font-bold bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 italic">Auth Required</span> : !hasPermission ? <span className="text-[9px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-100 italic font-black uppercase">Unauthorized</span> : <span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-tighter font-bold">Identity Verified</span>}</div></div></div>
        <div className="flex items-center gap-6">{(!user || user.isAnonymous) && <button onClick={handleAdminLogin} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-xl text-[10px] font-black shadow-lg hover:bg-indigo-700 transition-all shadow-indigo-100 font-bold"><LogIn className="w-3 h-3" /> 관리자 구글 로그인</button>}<div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50">{['STUDENTS', 'TOKENS'].map(v => <button key={v} onClick={() => setActiveView(v)} className={`px-5 py-1.5 text-[10px] font-black rounded-xl transition-all ${activeView === v ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>{v === 'STUDENTS' ? '학생 명단' : '토큰 현황'}</button>)}</div><div className="w-px h-6 bg-slate-200 mx-2"></div><div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50">{['PRE', 'OPEN', 'CLOSED'].map(s => <button key={s} onClick={() => updateSystemStatus(s)} className={`px-5 py-1.5 text-[10px] font-black rounded-xl transition-all ${systemStatus === s ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>{s}</button>)}</div><button onClick={() => signOut(auth).then(() => onExit())} className="p-3 text-slate-300 hover:text-red-500 transition-colors font-bold"><LogOut className="w-5 h-5" /></button></div>
      </header>

      <main className="flex-1 flex overflow-hidden font-bold">
        {(!user || user.isAnonymous) ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-8 animate-in fade-in duration-500 font-bold"><Lock className="w-16 h-16 mb-4 opacity-20 text-slate-400 mx-auto" /><h3 className="text-xl font-bold text-slate-600 mb-2 tracking-tight font-bold">데이터 접근 제한</h3><p className="max-w-xs text-sm text-slate-400 mb-6 leading-relaxed font-bold">정상적인 데이터 조회를 위해<br /><b>구글 관리자 로그인</b>이 반드시 필요합니다.</p><button onClick={handleAdminLogin} className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-black text-sm shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 mx-auto font-bold"><LogIn className="w-4 h-4" /> 구글 로그인하기</button></div>
        ) : !hasPermission ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-8 animate-in zoom-in duration-500 text-center font-bold"><ShieldAlert className="w-20 h-20 mb-6 text-red-500 mx-auto drop-shadow-lg" /><h3 className="text-2xl font-black text-slate-800 mb-2 font-bold tracking-tighter">권한이 없는 계정입니다</h3><div className="bg-white p-8 rounded-[2.5rem] border-2 border-red-50 shadow-xl mb-8 max-w-sm mx-auto"><div className="flex items-center gap-2 justify-center text-slate-400 mb-4 font-bold"><Terminal className="w-4 h-4" /><p className="text-[10px] uppercase tracking-widest font-black">Admin Access Key (UID)</p></div><div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between gap-3 border border-slate-100 shadow-inner group"><code className="text-[11px] font-mono font-black text-red-600 truncate">{user.uid}</code><button onClick={() => { navigator.clipboard.writeText(user.uid); setToast({ show: true, message: "UID가 복사되었습니다.", type: 'success' }); }} className="p-2 hover:bg-white rounded-xl text-slate-400 group-hover:text-indigo-500 transition-all font-bold"><Copy className="w-4 h-4" /></button></div><p className="text-[11px] text-slate-400 mt-6 leading-relaxed font-bold italic">위의 UID를 복사하여 Firestore 보안 규칙의<br /><span className="text-red-400 font-black">isAdmin()</span> 부분에 정확히 업데이트하세요.</p></div><div className="flex flex-col gap-4 items-center"><div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex gap-3 text-left max-w-xs animate-pulse"><AlertCircle className="w-5 h-5 text-orange-400 shrink-0" /><p className="text-[10px] text-orange-700 leading-normal font-bold">참고: 광고 차단 확장 프로그램(AdBlock)이 켜져 있으면 로그인이 되어도 데이터 로드가 차단될 수 있습니다.</p></div><button onClick={() => signOut(auth)} className="text-slate-400 font-black text-xs border-b border-slate-200 pb-1 hover:text-slate-800 transition-all uppercase tracking-widest font-bold">다른 계정으로 로그인</button></div></div>
        ) : (
          <section className="flex-1 flex flex-col p-8 overflow-hidden font-bold">
            <div className="flex gap-4 mb-6 bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm shrink-0 font-bold"><div className="relative flex-1"><Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" /><input type="text" placeholder={activeView === 'STUDENTS' ? "학번 혹은 성명 검색..." : "토큰 번호 혹은 사용자 검색..."} className="w-full pl-12 pr-6 py-3 bg-slate-50/50 rounded-2xl border-none focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-bold font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>{activeView === 'STUDENTS' && <div className="flex gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-100">{['ALL', 'ATTENDED', 'LOCKED'].map(t => <button key={t} onClick={() => setActiveTab(t)} className={`px-5 py-2 text-[10px] font-black rounded-xl transition-all ${activeTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>{t}</button>)}</div>}<button onClick={exportCSV} className="px-6 py-2 bg-green-600 text-white text-[10px] font-black rounded-xl flex items-center gap-2 hover:bg-green-700 active:scale-95 shadow-lg shadow-green-100 transition-all font-bold"><Download className="w-4 h-4" /> EXPORT CSV</button></div>

            <div className="bg-white border rounded-[2.5rem] overflow-hidden flex-1 flex flex-col shadow-sm border-slate-200/60 font-bold"><div className="overflow-y-auto custom-scrollbar font-bold">{activeView === 'STUDENTS' ? (
              <table className="w-full text-left text-sm border-collapse"><thead className="bg-slate-50/80 backdrop-blur text-slate-400 font-bold text-[10px] tracking-widest sticky top-0 border-b z-10 uppercase"><tr><th className="px-8 py-5">학번</th><th className="px-8 py-5">성명</th><th className="px-8 py-5">상태</th><th className="px-8 py-5 text-center font-black">점수</th><th className="px-8 py-5 text-center font-black">시도</th><th className="px-8 py-5 text-right font-black">관리</th></tr></thead><tbody className="divide-y divide-slate-50 font-bold">{filteredStudents.map(s => (<tr key={s.id} className={`group hover:bg-slate-50/80 transition-all ${s.trial_count >= 3 ? 'bg-red-50/30' : ''}`}><td className="px-8 py-4 font-mono font-bold text-slate-500">{s.student_id}</td><td className="px-8 py-4 font-bold text-slate-700">{s.name}</td><td className="px-8 py-4"><StatusBadge type={s.attendance_type} /></td><td className="px-8 py-4 text-center font-black text-indigo-600">{s.score}</td><td className="px-8 py-4 text-center font-black text-slate-300 italic font-bold">{s.trial_count}</td><td className="px-8 py-4 text-right space-x-2 font-bold font-bold">{!s.is_attended ? (<div className="inline-flex gap-1 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0 translate-x-2 font-bold"><button onClick={() => manualApprove(s.id, 'manual')} className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-colors font-bold">수동</button><button onClick={() => manualApprove(s.id, 'assignment')} className="text-[9px] font-black bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors font-bold">과제</button></div>) : <span className="text-[10px] font-mono text-slate-300 font-bold">{formatTime(s.attended_at, false)}</span>}{s.trial_count > 0 && <button onClick={() => resetLock(s.id)} className="p-2 text-red-300 hover:text-red-500 transition-colors font-bold"><RefreshCw className="w-3.5 h-3.5" /></button>}</td></tr>))}</tbody></table>
            ) : (
              <table className="w-full text-left text-sm border-collapse"><thead className="bg-slate-50 text-slate-400 font-bold text-[10px] tracking-widest sticky top-0 border-b z-10 uppercase font-bold"><tr><th className="px-8 py-5">토큰 번호</th><th className="px-8 py-5">상태</th><th className="px-8 py-5">사용자(학번)</th><th className="px-8 py-5 text-right font-black font-bold">사용 시각</th></tr></thead><tbody className="divide-y divide-slate-50 font-bold font-bold">{filteredTokens.map(t => (<tr key={t.id} className="hover:bg-slate-50/80 transition-colors font-bold"><td className="px-8 py-4 font-mono font-black text-indigo-600 tracking-widest font-bold">{t.id}</td><td className="px-8 py-4 font-bold"><span className={`inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase font-bold ${t.is_used ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>{t.is_used ? 'Used' : 'Unused'}</span></td><td className="px-8 py-4 font-bold text-slate-700 italic font-bold">{t.used_by || "-"}</td><td className="px-8 py-4 text-right font-mono text-xs text-slate-300 font-bold">{formatTime(t.used_at)}</td></tr>))}</tbody></table>
            )}</div></div>
          </section>
        )}

        <aside className="w-96 bg-white border-l border-slate-200 flex flex-col shrink-0 font-bold font-bold font-bold font-bold font-bold">
          <div className="p-8 border-b border-slate-100 shrink-0 font-bold"><div><h3 className="font-black text-slate-800 flex items-center gap-3 leading-none font-bold"><span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>Live Activity</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5 leading-none font-black italic font-bold">Real-time system events</p></div><div className="relative mt-4 font-bold font-bold"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 font-bold" /><input type="text" placeholder="학번으로 로그 필터링..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] focus:bg-white outline-none font-bold shadow-inner font-bold" value={logSearchTerm} onChange={e => setLogSearchTerm(e.target.value)} /></div></div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/10 font-bold font-bold">
            {filteredLogs.map(log => (<div key={log.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm animate-in slide-in-from-right-4 hover:shadow-md transition-shadow font-bold"><div className="flex justify-between items-start mb-2 text-slate-800 font-bold"><span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter font-bold ${log.type === 'SUCCESS' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>{log.type}</span><span className="text-[10px] font-mono text-slate-300 font-bold font-bold font-bold font-bold font-bold">{formatTime(log.time, false)}</span></div><p className="text-xs font-black tracking-tight font-bold font-bold font-bold font-bold font-bold">{log.studentId}</p><p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-bold italic font-bold font-bold font-bold font-bold font-bold">{log.desc}</p></div>))}
          </div>
          <div className="p-8 bg-slate-900 text-white rounded-t-[3rem] shrink-0 shadow-2xl font-bold font-bold">
            <div className="grid grid-cols-2 gap-4 mb-4 font-bold font-bold"><div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 leading-none font-bold">Attendance Rate</p><p className="text-2xl font-black text-indigo-400 leading-none font-bold font-bold font-bold font-bold font-bold">{Math.round((students.filter(s => s.is_attended).length / (students.length || 1)) * 100)}%</p></div><div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 leading-none font-bold">Tokens Used</p><p className="text-2xl font-black text-indigo-400 leading-none font-bold font-bold font-bold font-bold font-bold">{tokens.filter(t => t.is_used).length} / {tokens.length}</p></div></div>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden font-bold"><div className="h-full bg-indigo-500 animate-pulse w-full shadow-[0_0_8px_rgba(99,102,241,0.6)] font-bold"></div></div>
          </div>
        </aside>
      </main>
      <GlobalStyle />
    </div>
  );
}

const GlobalStyle = () => (<style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap'); .p0as-root, .p0as-root *, body, html { font-family: 'Gowun Batang', serif !important; } .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; } input, button, select, textarea { font-family: 'Gowun Batang', serif !important; } b, strong { font-weight: 700; }` }} />);
const InputGroup = ({ label, icon, value, onChange, placeholder, isToken = false }) => (<div><label className="block text-[9px] font-black text-slate-400 uppercase ml-1 mb-1 tracking-widest font-bold">{label}</label><div className="relative font-bold"><div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none font-bold">{icon}</div><input type="text" required placeholder={placeholder} className={`w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-bold ${isToken ? 'text-center tracking-[0.5em] font-mono text-lg font-black' : 'text-sm'}`} value={value} onChange={e => onChange(e.target.value)} /></div></div>);
const ErrorMessage = ({ message }) => (<div className="flex items-center gap-2.5 text-[11px] text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100 animate-in slide-in-from-top-2 shadow-sm font-bold font-bold font-bold font-bold font-bold"><AlertCircle className="w-3.5 h-3.5 shrink-0 font-bold" /><p className="leading-tight font-bold font-bold">{formatBoldText(message)}</p></div>);
const SuccessCard = ({ resultData, onReset }) => (<div className="p-8 rounded-[2rem] text-center shadow-2xl border-4 border-green-100 bg-green-50 animate-in zoom-in duration-500 flex flex-col items-center shrink-0 font-bold"><CheckCircle2 className="w-16 h-16 mb-4 text-green-500 drop-shadow-sm font-bold" /><h2 className="text-xl font-black text-slate-800 mb-6 tracking-tight font-bold">출석이 <b>완료</b>되었습니다!</h2><div className="bg-white/80 py-4 px-8 rounded-3xl mb-8 shadow-sm border border-white/50 w-full max-w-xs flex flex-col items-center font-bold font-bold font-bold font-bold font-bold"><p className="text-slate-800 font-black text-xl font-bold font-bold font-bold font-bold font-bold">{resultData.name} 학생</p><p className="text-xs text-slate-400 font-mono mt-1 tracking-wider font-bold italic font-bold font-bold font-bold font-bold font-bold">{resultData.student_id}</p></div><div className="w-full max-w-xs font-bold font-bold font-bold font-bold font-bold"><button onClick={onReset} className="w-full py-3.5 bg-white text-slate-400 font-black text-[10px] rounded-xl hover:text-slate-600 transition-colors uppercase tracking-[0.2em] border border-slate-100 shadow-sm font-bold">← 메인으로 돌아가기</button></div></div>);
const LockedCard = ({ onReset }) => (<div className="bg-white p-8 rounded-[2.5rem] text-center shadow-2xl border border-red-100 animate-in shake duration-500 shrink-0 font-bold"><Lock className="w-16 h-16 mx-auto mb-4 text-red-500 font-bold" /><h2 className="text-xl font-black text-red-600 mb-4 tracking-tight font-bold font-bold font-bold font-bold font-bold">접근 <b>차단</b></h2><p className="text-sm text-slate-500 mb-8 leading-relaxed font-bold italic font-bold font-bold font-bold font-bold font-bold">정보가 <b>3회 이상</b> 일치하지 않습니다.<br />조교에게 본인 확인 후 조치를 받으세요.</p><button onClick={onReset} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 border-b border-slate-200 pb-1 italic transition-colors font-bold font-bold font-bold font-bold font-bold">다시 시도</button></div>);
const ResultRow = ({ label, value, isBold = false }) => (<div className="flex justify-between items-center px-2 py-2 border-b border-slate-50 last:border-0 font-bold"><span className="text-xs text-slate-400 font-bold font-bold font-bold font-bold font-bold">{label}</span><div className={`text-sm ${isBold ? 'font-black text-indigo-600 tracking-tight' : 'font-bold text-slate-700'} font-bold font-bold font-bold font-bold font-bold`}>{value}</div></div>);