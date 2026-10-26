import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button, Field } from './components';
import { stateLabels } from './lib';

export default function Settings({ settings, busy, onSave }) {
  const [form, setForm] = useState(settings);
  return <form className="settings-form" onSubmit={event => { event.preventDefault(); onSave(form); }}><section><Field id="event-title" label="행사명" required maxLength={80} value={form.title} onChange={event => setForm(previous => ({ ...previous, title: event.target.value }))} /></section><section><h2>출석 접수</h2><fieldset className="state-options"><legend className="sr-only">운영 상태</legend>{['PRE', 'OPEN', 'CLOSED'].map(state => <label key={state}><input type="radio" name="state" value={state} checked={form.state === state} onChange={() => setForm(previous => ({ ...previous, state }))} /><span>{stateLabels[state]}</span>{form.state === state && <Check size={18} />}</label>)}</fieldset></section><Button busy={busy}>저장</Button></form>;
}
