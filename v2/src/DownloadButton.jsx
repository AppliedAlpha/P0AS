import { useEffect, useState } from 'react';
import { ArrowDownToLine } from 'lucide-react';

const checks = new Map();
function documentAvailable(href) {
  if (!checks.has(href)) checks.set(href, fetch(href, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' }).then(response => {
    const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    return response.ok && ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'].includes(type);
  }).catch(() => false));
  return checks.get(href);
}

export default function DownloadButton({ label, href }) {
  const [checked, setChecked] = useState(null);
  useEffect(() => {
    let active = true;
    documentAvailable(href).then(available => { if (active) setChecked({ href, available }); });
    return () => { active = false; };
  }, [href]);
  const available = checked?.href === href ? checked.available : null;
  const content = <><ArrowDownToLine size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>{!available && <small>{available === null ? '확인 중' : '준비 중'}</small>}</>;
  return available
    ? <a className="button button-secondary document-download" href={href} download>{content}</a>
    : <button className="button button-secondary document-download" type="button" disabled>{content}</button>;
}
