import { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Alert, Button, Field } from './components';
import { stateLabels } from './lib';

export default function Settings({ settings, busy, onSave, onReset }) {
  const [form, setForm] = useState(settings);
  const [resetError, setResetError] = useState('');
  const dialog = useRef(null);
  async function reset() {
    setResetError('');
    const result = await onReset();
    if (result) { setForm(result.settings); dialog.current?.close(); }
    else setResetError('초기화하지 못했습니다. 연결과 관리자 권한을 확인한 뒤 다시 시도해주세요.');
  }
  return <div className="settings-workspace">
    <form className="settings-form" onSubmit={event => { event.preventDefault(); onSave(form); }}>
      <section><Field id="event-title" label="행사명" required maxLength={80} value={form.title} onChange={event => setForm(previous => ({ ...previous, title: event.target.value }))} disabled={!!busy} /></section>
      <section><h2>출석 접수</h2><fieldset className="state-options" disabled={!!busy}><legend className="sr-only">운영 상태</legend>{['PRE', 'OPEN', 'CLOSED'].map(state => <label key={state}><input type="radio" name="state" value={state} checked={form.state === state} onChange={() => setForm(previous => ({ ...previous, state }))} /><span>{stateLabels[state]}</span>{form.state === state && <Check size={18} />}</label>)}</fieldset></section>
      <Button busy={busy === 'settings'} disabled={!!busy}>저장</Button>
    </form>
    <section className="settings-reset" aria-labelledby="reset-section-title">
      <h2 id="reset-section-title">데이터 초기화</h2>
      <p>명단·출결·토큰·활동 기록을 모두 삭제하고 운영 설정을 초기값으로 되돌립니다.</p>
      <Button className="button-danger" disabled={!!busy} onClick={() => { setResetError(''); dialog.current.showModal(); }}>모두 초기화</Button>
    </section>
    <dialog ref={dialog} className="confirm-dialog" aria-labelledby="reset-dialog-title" aria-describedby="reset-dialog-description" onCancel={event => { if (busy) event.preventDefault(); }}>
      <h2 id="reset-dialog-title">모두 초기화하시겠습니까?</h2>
      <p id="reset-dialog-description">학생 명단, 모든 출결과 점수, 발급한 토큰, 활동 기록을 삭제합니다. 학생 로그인 세션도 종료됩니다.<br />행사명은 ‘K-MOOC 특강’, 접수 상태는 ‘출석 시작 전’으로 돌아갑니다.<br /><strong>삭제한 데이터는 복구할 수 없습니다.</strong></p>
      {resetError && <Alert>{resetError}</Alert>}
      <div className="inline-actions"><Button className="button-secondary" autoFocus disabled={!!busy} onClick={() => dialog.current.close()}>취소</Button><Button className="button-danger" busy={busy === 'reset'} disabled={!!busy} onClick={reset}>모두 초기화</Button></div>
    </dialog>
  </div>;
}
