import { ATTENDANCE_URL, TOKENS_PER_PRINT_PAGE } from './print-config';

export default function TokenPrintSheet({ tokens, title, sheetRef }) {
  const pages = [];
  for (let index = 0; index < tokens.length; index += TOKENS_PER_PRINT_PAGE) pages.push(tokens.slice(index, index + TOKENS_PER_PRINT_PAGE));
  return <div ref={sheetRef} className="print-sheet" aria-label="인쇄용 출석 토큰">{pages.map((page, index) => <section className="print-page" key={index} aria-label={`인쇄 ${index + 1}페이지`}><div className="print-grid">{page.map(token => <article className="token-ticket" key={token.id}>
    <div className="ticket-qr"><img src="/attendance-qr.svg" alt="출석 페이지 QR코드" width="76" height="76" /><span>스캔하여 출석</span></div>
    <div className="ticket-content"><h2 title={title}>{title}</h2><strong className="ticket-number">{token.code}</strong><p>1회용 출석 토큰입니다.</p><p>문제가 있으면 조교에게 문의하세요.</p><a href={ATTENDANCE_URL}>{ATTENDANCE_URL.replace('https://', '')}</a></div>
  </article>)}</div></section>)}</div>;
}
