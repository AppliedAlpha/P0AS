import { AlertCircle, Check, CheckCheck, LoaderCircle } from 'lucide-react';

export function Brand({ admin = false }) {
  return <a href={admin ? '/manage' : '/'} className="brand" aria-label="p0as 홈"><span className="brand-mark"><CheckCheck size={21} strokeWidth={2.4} /></span><span>p0as<span className="brand-dot">.</span></span></a>;
}
export function Alert({ children, success = false }) {
  return <div className={`alert ${success ? 'alert-success' : ''}`} role={success ? 'status' : 'alert'}>{success ? <Check size={18} /> : <AlertCircle size={18} />}<span>{children}</span></div>;
}
export function Button({ children, busy, disabled, className = 'button-primary', ...props }) {
  return <button className={`button ${className}`} disabled={busy || disabled} {...props}>{busy && <LoaderCircle size={17} className="spin" />}{children}</button>;
}
export function Field({ label, hint, id, ...props }) {
  return <div className="field"><label htmlFor={id}>{label}</label><input id={id} {...props} />{hint && <span className="field-hint" id={`${id}-hint`}>{hint}</span>}</div>;
}
