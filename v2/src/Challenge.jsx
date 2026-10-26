import { useEffect, useRef } from 'react';

let scriptPromise;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
  });
  return scriptPromise;
}
export default function Challenge({ config, onToken }) {
  const ref = useRef(null);
  useEffect(() => {
    if (config.local || !config.siteKey) return;
    let disposed = false; let widget;
    loadScript().then(() => { if (!disposed) widget = window.turnstile.render(ref.current, { sitekey: config.siteKey, action: 'identity', theme: 'light', callback: onToken, 'expired-callback': () => onToken(''), 'error-callback': () => onToken('') }); }).catch(() => onToken(''));
    return () => { disposed = true; if (widget !== undefined) window.turnstile?.remove(widget); };
  }, [config.local, config.siteKey, onToken]);
  if (config.local) return null;
  if (!config.siteKey) return <p className="field-hint">보안 확인을 준비 중입니다. 현장 운영자에게 문의해주세요.</p>;
  return <div ref={ref} className="challenge" aria-label="자동 요청 방지 확인" />;
}
