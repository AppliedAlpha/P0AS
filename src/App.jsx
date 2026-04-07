import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, getDoc, updateDoc, collection,
  onSnapshot, query, runTransaction, serverTimestamp, setDoc
} from 'firebase/firestore';
import {
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken
} from 'firebase/auth';
import {
  CheckCircle2, AlertCircle, Lock, ShieldCheck,
  User, Key, LogOut, Download, Search, RefreshCw, LayoutDashboard, ClipboardCheck, Info, X, Bell, Clock, Award, ChevronRight, Tickets
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

// --- Firebase Configuration ---
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

// --- Utils ---
const generateHash = async (text) => {
  const msgUint8 = new TextEncoder().encode(text + NAME_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const formatTime = (timestamp, full = true) => {
  if (!timestamp) return "-";
  const date = timestamp.toDate();
  if (!full) return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const formatBoldText = (text) => {
  if (!text) return "";
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <b key={i}>{part.slice(2, -2)}</b>;
    }
    return part;
  });
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
      } catch (err) {
        console.error("Auth Init Error:", err);
      }
    };
    initAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (curr) => {
      setUser(curr);
      setLoading(false);
    });

    const handleLocationChange = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      unsubscribeAuth();
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'attendance_status');
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) setSystemStatus(docSnap.data().value);
    });
    return () => unsubscribeSettings();
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-500 font-medium text-sm">
        <RefreshCw className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
        <p>시스템 동기화 중...</p>
      </div>
    );
  }

  if (path === '/manage') return <AdminDashboard systemStatus={systemStatus} onExit={() => { window.location.href = '/'; }} />;
  if (path === '/check') return <CheckView onBack={() => { window.location.href = '/'; }} />;

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 overflow-x-hidden p0as-root">
      <StudentView systemStatus={systemStatus} />
      <GlobalStyle />
    </div>
  );
}

// --- Student View ---
function StudentView({ systemStatus }) {
  const [step, setStep] = useState('input');
  const [form, setForm] = useState({ studentId: '', name: '', token: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultData, setResultData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (systemStatus !== 'OPEN') return;

    setIsSubmitting(true);
    setError('');

    try {
      const studentId = form.studentId.trim();
      const name = form.name.trim();
      const tokenInput = form.token.trim();

      const studentRef = doc(db, 'artifacts', appId, 'public', 'data', 'students', studentId);
      const studentSnap = await getDoc(studentRef);
      const inputHash = await generateHash(name);

      if (!studentSnap.exists() || studentSnap.data().name_hash !== inputHash) {
        throw new Error('학번 혹은 이름을 다시 확인해주세요.');
      }

      const sData = studentSnap.data();

      if (sData.trial_count >= 3) { setStep('locked'); return; }
      if (sData.is_attended) { throw new Error('이미 출결 처리된 학생입니다.'); }

      const tokenRef = doc(db, 'artifacts', appId, 'public', 'data', 'tokens', tokenInput);

      const txResult = await runTransaction(db, async (transaction) => {
        const tSnap = await transaction.get(tokenRef);

        if (!tSnap.exists() || tSnap.data().is_used) {
          const nextTrial = (sData.trial_count || 0) + 1;
          transaction.update(studentRef, { trial_count: nextTrial });
          return { success: false, nextTrial };
        }

        transaction.update(studentRef, {
          is_attended: true, score: 5, attendance_type: 'FIELD', attended_at: serverTimestamp()
        });
        transaction.update(tokenRef, { is_used: true, used_by: studentId, used_at: serverTimestamp() });

        const logRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'logs'));
        transaction.set(logRef, {
          studentId, type: 'SUCCESS', time: serverTimestamp(), desc: `출석 성공 (토큰: ${tokenInput})`
        });

        return { success: true };
      });

      if (!txResult.success) {
        throw new Error(`유효하지 않은 토큰입니다. (**${txResult.nextTrial}/3회** 실패)`);
      }

      setResultData({ ...sData, is_attended: true, attendance_type: 'FIELD', score: 5 });
      setStep('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto h-[100dvh] px-6 flex flex-col justify-center py-4">
      <div className="text-center mb-4 shrink-0">
        <div className="inline-block p-2.5 bg-indigo-600 rounded-2xl mb-2 shadow-lg shadow-indigo-100">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl font-black text-slate-800 tracking-tight">강의 출석 시스템</h1>
      </div>

      {systemStatus === 'OPEN' ? (
        <div className="shrink-0">
          {step === 'input' && (
            <div className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-slate-200">
              <div className="mb-3 p-1.5 rounded-lg text-center font-black text-[10px] uppercase tracking-[0.1em] border bg-green-50 text-green-600 border-green-100">
                출석 진행 중
              </div>
              <form onSubmit={handleSubmit} className="space-y-2.5">
                <InputGroup label="Student ID" icon={<User className="w-4 h-4" />} value={form.studentId} onChange={v => setForm({ ...form, studentId: v })} placeholder="학번 입력" />
                <InputGroup label="Name" icon={<ShieldCheck className="w-4 h-4" />} value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="성명 입력" />
                <InputGroup label="Token Code" icon={<Key className="w-4 h-4" />} value={form.token} onChange={v => setForm({ ...form, token: v.replace(/[^0-9]/g, '') })} placeholder="000000" isToken />
                {error && <ErrorMessage message={error} />}
                <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-200 text-white font-black py-3 rounded-xl transition-all shadow-lg active:scale-[0.98]">
                  {isSubmitting ? '처리 중...' : '출석 완료'}
                </button>
              </form>
            </div>
          )}
          {step === 'success' && <SuccessCard resultData={resultData} onReset={() => setStep('input')} />}
          {step === 'locked' && <LockedCard onReset={() => setStep('input')} />}
        </div>
      ) : (
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 text-center animate-in fade-in slide-in-from-bottom-4 duration-500 shrink-0">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Info className="w-6 h-6 text-slate-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">
            {systemStatus === 'PRE' ? '아직 시작 전입니다.' : '출석이 종료되었습니다.'}
          </h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            {systemStatus === 'PRE' ? '강의 시작 후 토큰을 배부받아 등록해주세요.' : '현재는 출석 결과 조회만 가능합니다.'}
          </p>
          <button onClick={() => { window.location.href = '/check'; }} className="w-full bg-indigo-50 text-indigo-600 font-black py-3.5 rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 shadow-sm">
            출석 결과 조회하기 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <footer className="mt-4 text-center shrink-0">
        <button onClick={() => { window.location.href = '/check'; }} className="px-6 py-2 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-all text-[11px] border border-slate-200 shadow-sm">
          나의 <b>출석 결과</b> 확인하기
        </button>
      </footer>
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
      const studentId = form.studentId.trim();
      const name = form.name.trim();
      const studentRef = doc(db, 'artifacts', appId, 'public', 'data', 'students', studentId);
      const studentSnap = await getDoc(studentRef);
      const inputHash = await generateHash(name);
      if (!studentSnap.exists() || studentSnap.data().name_hash !== inputHash) {
        throw new Error('학번 혹은 이름을 다시 확인해주세요.');
      }
      setResult(studentSnap.data());
      setStatus('found');
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  return (
    <div className="max-w-md mx-auto h-[100dvh] px-6 flex flex-col justify-center py-6">
      <div className="text-center mb-8 shrink-0">
        <div className="inline-block p-3.5 bg-slate-100 rounded-3xl mb-3"><ClipboardCheck className="w-7 h-7 text-slate-600" /></div>
        <h1 className="text-2xl font-black tracking-tight text-slate-800">출석 결과 조회</h1>
        <p className="text-sm text-slate-400 mt-1 font-bold">본인의 정보를 입력하세요.</p>
      </div>
      {status === 'found' ? (
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border-4 border-indigo-50 animate-in zoom-in duration-300 text-center shrink-0">
          <span className={`inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 ${result.is_attended ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-400'}`}>
            {result.is_attended ? 'Attendance Confirmed' : 'Not Attended'}
          </span>
          <h2 className="text-2xl font-black text-slate-800 mb-6">{result.name} 학생</h2>
          <div className="space-y-2 mb-8 text-left">
            <ResultRow label="현재 점수" value={`${result.score}점`} isBold />
            <ResultRow label="출석 유형" value={result.attendance_type === 'NONE' ? '미출석' : result.attendance_type} />
            <ResultRow label="처리 시각" value={formatTime(result.attended_at)} />
          </div>
          <button onClick={onBack} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all">메인 화면으로</button>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-200 shrink-0">
          <form onSubmit={handleLookup} className="space-y-4">
            <InputGroup label="Student ID" icon={<User className="w-4 h-4" />} value={form.studentId} onChange={v => setForm({ ...form, studentId: v })} placeholder="20240001" />
            <InputGroup label="Name" icon={<ShieldCheck className="w-4 h-4" />} value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="실명 입력" />
            {error && <ErrorMessage message={error} />}
            <button type="submit" disabled={status === 'loading'} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl shadow-xl mt-2">{status === 'loading' ? '조회 중...' : '결과 조회하기'}</button>
            <button type="button" onClick={onBack} className="w-full text-xs font-bold text-slate-400 py-3 uppercase tracking-widest">돌아가기</button>
          </form>
        </div>
      )}
      <GlobalStyle />
    </div>
  );
}

// --- Admin Dashboard ---
function AdminDashboard({ onExit, systemStatus }) {
  const [students, setStudents] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState('STUDENTS');
  const [activeTab, setActiveTab] = useState('ALL');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    if (!auth.currentUser) return;
    const qStudents = query(collection(db, 'artifacts', appId, 'public', 'data', 'students'));
    const unsubscribeStudents = onSnapshot(qStudents, (snap) => setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const qTokens = query(collection(db, 'artifacts', appId, 'public', 'data', 'tokens'));
    const unsubscribeTokens = onSnapshot(qTokens, (snap) => setTokens(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const qLogs = query(collection(db, 'artifacts', appId, 'public', 'data', 'logs'));
    const unsubscribeLogs = onSnapshot(qLogs, (snap) => {
      const sorted = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.time?.seconds || 0) - (a.time?.seconds || 0));
      setLogs(sorted.slice(0, 20));
    });
    return () => { unsubscribeStudents(); unsubscribeTokens(); unsubscribeLogs(); };
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const updateSystemStatus = async (status) => {
    try {
      const ref = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'attendance_status');
      await updateDoc(ref, { value: status });
      showToast(`시스템 상태가 **${status}**로 변경되었습니다.`);
    } catch (err) {
      showToast('상태 변경 실패: ' + err.message, 'error');
    }
  };

  const manualApprove = async (sId, type) => {
    try {
      const ref = doc(db, 'artifacts', appId, 'public', 'data', 'students', sId);
      await updateDoc(ref, { is_attended: true, score: 5, attendance_type: type, attended_at: serverTimestamp() });
      await setDoc(doc(collection(db, 'artifacts', appId, 'public', 'data', 'logs')), { studentId: sId, type: 'MANUAL', time: serverTimestamp(), desc: `관리자 승인 (${type})` });
      showToast(`학생 **${sId}** 승인 완료.`);
    } catch (err) {
      showToast('승인 실패: ' + err.message, 'error');
    }
  };

  const resetLock = async (sId) => {
    try {
      const ref = doc(db, 'artifacts', appId, 'public', 'data', 'students', sId);
      await updateDoc(ref, { trial_count: 0 });
      showToast(`학생 **${sId}** 잠금 해제 완료.`);
    } catch (err) {
      showToast('잠금 해제 실패: ' + err.message, 'error');
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchSearch = (s.student_id || "").includes(searchTerm) || (s.name || "").includes(searchTerm);
      if (activeTab === 'LOCKED') return matchSearch && s.trial_count >= 3;
      if (activeTab === 'ATTENDED') return matchSearch && s.is_attended;
      return matchSearch;
    });
  }, [students, searchTerm, activeTab]);

  const filteredTokens = useMemo(() => {
    return tokens.filter(t => (t.id || "").includes(searchTerm) || (t.used_by || "").includes(searchTerm))
      .sort((a, b) => b.is_used - a.is_used);
  }, [tokens, searchTerm]);

  const getTypeBadge = (type) => {
    switch (type) {
      case 'FIELD': return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">직접 출석</span>;
      case 'TASK': return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">과제 완료</span>;
      case 'MANUAL': return <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">수동 승인</span>;
      default: return <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">미출석</span>;
    }
  };

  const exportCSV = () => {
    const header = "\ufeff학번,성명,출석여부,유형,점수,인증시간\n";
    const body = students.map(s => (
      `${s.student_id},${s.name},${s.is_attended ? 'O' : 'X'},${s.attendance_type},${s.score},${s.attended_at?.toDate()?.toLocaleString() || '-'}`
    )).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `p0as_report.csv`;
    link.click();
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 relative font-sans p0as-root">
      {toast.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-10 duration-300 text-center">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${toast.type === 'success' ? 'bg-indigo-900 text-white border-indigo-800' : 'bg-red-600 text-white border-red-500'}`}>
            <Bell className="w-4 h-4" />
            <div className="text-sm font-medium">{formatBoldText(toast.message)}</div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shadow-sm z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white"><LayoutDashboard className="w-5 h-5" /></div>
          <h1 className="font-black text-xl tracking-tight text-slate-800 uppercase">p0as <span className="font-light text-slate-300">Management</span></h1>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
            {['STUDENTS', 'TOKENS'].map(v => (
              <button key={v} onClick={() => setActiveView(v)} className={`px-5 py-1.5 text-[10px] font-black rounded-xl transition-all ${activeView === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{v === 'STUDENTS' ? '학생 명단' : '토큰 현황'}</button>
            ))}
          </div>
          <div className="w-px h-6 bg-slate-200"></div>
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
            {['PRE', 'OPEN', 'CLOSED'].map(s => (
              <button key={s} onClick={() => updateSystemStatus(s)} className={`px-5 py-1.5 text-[10px] font-black rounded-xl transition-all ${systemStatus === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{s}</button>
            ))}
          </div>
          <button onClick={onExit} className="p-3 text-slate-300 hover:text-red-500 transition-colors"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <section className="flex-1 flex flex-col p-8 overflow-hidden">
          <div className="flex gap-4 mb-6 bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input type="text" placeholder={activeView === 'STUDENTS' ? "학번 혹은 성명 검색..." : "토큰 번호 혹은 사용자 검색..."} className="w-full pl-12 pr-6 py-3 bg-slate-50/50 border-none rounded-2xl outline-none text-sm focus:bg-white transition-all shadow-inner font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            {activeView === 'STUDENTS' && (
              <div className="flex gap-1 bg-slate-50 p-1 rounded-2xl">
                {['ALL', 'ATTENDED', 'LOCKED'].map(t => (
                  <button key={t} onClick={() => setActiveTab(t)} className={`px-5 py-2 text-[10px] font-black rounded-xl transition-all ${activeTab === t ? 'bg-white text-slate-800 shadow-sm border border-slate-100' : 'text-slate-400'}`}>{t}</button>
                ))}
              </div>
            )}
            <button onClick={exportCSV} className="px-5 py-2 bg-green-600 text-white text-[10px] font-black rounded-xl flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg active:scale-95"><Download className="w-4 h-4" /> CSV</button>
          </div>

          <div className="bg-white border rounded-[2.5rem] overflow-hidden flex-1 flex flex-col shadow-sm">
            <div className="overflow-y-auto custom-scrollbar">
              {activeView === 'STUDENTS' ? (
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-50 backdrop-blur-md text-slate-400 font-bold text-[10px] tracking-widest sticky top-0 border-b z-10 uppercase">
                    <tr><th className="px-8 py-5">학번</th><th className="px-8 py-5">성명</th><th className="px-8 py-5">상태/유형</th><th className="px-8 py-5 text-center">점수</th><th className="px-8 py-5 text-center">시도</th><th className="px-8 py-5 text-right">관리</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {filteredStudents.map(s => (
                      <tr key={s.id} className={`group hover:bg-slate-50/80 transition-colors ${s.trial_count >= 3 ? 'bg-red-50/30' : ''}`}>
                        <td className="px-8 py-4 font-mono font-bold text-slate-500">{s.student_id}</td>
                        <td className="px-8 py-4 font-bold text-slate-700">{s.name}</td>
                        <td className="px-8 py-4">{getTypeBadge(s.attendance_type)}</td>
                        <td className="px-8 py-4 text-center font-black text-indigo-600">{s.score}</td>
                        <td className="px-8 py-4 text-center font-black text-slate-300">{s.trial_count}</td>
                        <td className="px-8 py-4 text-right space-x-2">
                          {!s.is_attended ? (
                            <div className="inline-flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => manualApprove(s.id, 'MANUAL')} className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl hover:bg-indigo-100">수동</button>
                              <button onClick={() => manualApprove(s.id, 'TASK')} className="text-[9px] font-black bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl hover:bg-blue-100">과제</button>
                            </div>
                          ) : <span className="text-[10px] font-mono text-slate-300 font-bold">{formatTime(s.attended_at, false)}</span>}
                          {s.trial_count > 0 && <button onClick={() => resetLock(s.id)} className="p-2 text-red-300 hover:text-red-500 transition-all"><RefreshCw className="w-3.5 h-3.5" /></button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-50 backdrop-blur-md text-slate-400 font-bold text-[10px] tracking-widest sticky top-0 border-b z-10 uppercase">
                    <tr><th className="px-8 py-5">토큰 번호</th><th className="px-8 py-5">사용 상태</th><th className="px-8 py-5">사용자(학번)</th><th className="px-8 py-5 text-right">사용 시각</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {filteredTokens.map(t => (
                      <tr key={t.id} className={`hover:bg-slate-50/80 transition-colors ${t.is_used ? '' : 'bg-slate-50/20'}`}>
                        <td className="px-8 py-4 font-mono font-black text-indigo-600 tracking-widest">{t.id}</td>
                        <td className="px-8 py-4"><span className={`inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${t.is_used ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>{t.is_used ? 'Used' : 'Unused'}</span></td>
                        <td className="px-8 py-4 font-bold text-slate-700">{t.used_by || "-"}</td>
                        <td className="px-8 py-4 text-right font-mono text-xs text-slate-400 font-bold">{formatTime(t.used_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>

        <aside className="w-96 bg-white border-l border-slate-200 flex flex-col shrink-0 font-medium">
          <div className="p-8 border-b border-slate-100 shrink-0">
            <h3 className="font-black text-slate-800 flex items-center gap-3"><span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>Live Activity</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Real-time events</p>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/20">
            {logs.map(log => (
              <div key={log.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm animate-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-start mb-2 text-slate-800">
                  <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter ${log.type === 'SUCCESS' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>{log.type}</span>
                  <span className="text-[10px] font-mono text-slate-300 font-bold">{formatTime(log.time, false)}</span>
                </div>
                <p className="text-xs font-black">{log.studentId}</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-bold">{log.desc}</p>
              </div>
            ))}
          </div>
          <div className="p-8 bg-slate-900 text-white rounded-t-[3rem] shrink-0">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Attendance Rate</p><p className="text-2xl font-black text-indigo-400">{Math.round((students.filter(s => s.is_attended).length / (students.length || 1)) * 100)}%</p></div>
              <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Tokens Used</p><p className="text-2xl font-black text-indigo-400">{tokens.filter(t => t.is_used).length} / {tokens.length}</p></div>
            </div>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 animate-pulse w-full"></div></div>
          </div>
        </aside>
      </main>
      <GlobalStyle />
    </div>
  );
}

// --- Global UI Sub-Components ---
const GlobalStyle = () => (
  <style dangerouslySetInnerHTML={{
    __html: `
    @import url('https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap');
    
    .p0as-root, .p0as-root *, body, html {
      font-family: 'Gowun Batang', serif !important;
    }

    .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } 
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
    
    input, button, select, textarea {
      font-family: 'Gowun Batang', serif !important;
    }

    b, strong { font-weight: 700; }
  `}} />
);

const InputGroup = ({ label, icon, value, onChange, placeholder, isToken = false }) => (
  <div>
    <label className="block text-[9px] font-black text-slate-400 uppercase ml-1 mb-1 tracking-widest">{label}</label>
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">{icon}</div>
      <input
        type="text" required placeholder={placeholder}
        className={`w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all ${isToken ? 'text-center tracking-[0.5em] font-mono text-lg font-black' : 'font-bold text-sm'}`}
        value={value} onChange={e => onChange(e.target.value)}
      />
    </div>
  </div>
);

const ErrorMessage = ({ message }) => (
  <div className="flex items-center gap-2.5 text-[11px] text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100 animate-in slide-in-from-top-2">
    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
    <p className="font-bold leading-tight">
      {formatBoldText(message)}
    </p>
  </div>
);

const SuccessCard = ({ resultData, onReset }) => (
  <div className="p-8 rounded-[2rem] text-center shadow-2xl border-4 border-green-100 bg-green-50 animate-in zoom-in duration-500 flex flex-col items-center shrink-0">
    <CheckCircle2 className="w-16 h-16 mb-4 text-green-500" />
    <h2 className="text-xl font-black text-slate-800 mb-6 tracking-tight">출석이 <b>완료</b>되었습니다!</h2>
    <div className="bg-white/80 py-4 px-8 rounded-3xl mb-8 shadow-sm border border-white/50 w-full max-w-xs flex flex-col items-center">
      <p className="text-slate-800 font-black text-xl">{resultData.name} 학생</p>
      <p className="text-xs text-slate-400 font-mono mt-1 tracking-wider font-bold">{resultData.student_id}</p>
    </div>
    <div className="w-full max-w-xs">
      <button onClick={onReset} className="w-full py-3.5 bg-white text-slate-400 font-black text-[10px] rounded-xl hover:text-slate-600 transition-colors uppercase tracking-[0.2em] border border-slate-100 shadow-sm">
        ← 메인으로 돌아가기
      </button>
    </div>
  </div>
);

const LockedCard = ({ onReset }) => (
  <div className="bg-white p-8 rounded-[2.5rem] text-center shadow-2xl border border-red-100 animate-in shake duration-500 shrink-0">
    <Lock className="w-16 h-16 mx-auto mb-4 text-red-500" />
    <h2 className="text-xl font-black text-red-600 mb-4">접근 <b>차단</b></h2>
    <p className="text-sm text-slate-500 mb-8 leading-relaxed font-bold">정보가 <b>3회 이상</b> 일치하지 않습니다.<br />조교에게 본인 확인 후 조치를 받으세요.</p>
    <button onClick={onReset} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 border-b border-slate-200 pb-1">새로고침</button>
  </div>
);

const ResultRow = ({ label, value, isBold = false }) => (
  <div className="flex justify-between items-center px-2 py-2 border-b border-slate-50 last:border-0">
    <span className="text-xs text-slate-400 font-bold">{label}</span>
    <span className={`text-sm ${isBold ? 'font-black text-indigo-600' : 'font-bold text-slate-700'}`}>{value}</span>
  </div>
);