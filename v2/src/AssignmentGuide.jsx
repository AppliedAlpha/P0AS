import { useState } from 'react';
import { Check, Mail } from 'lucide-react';
import DownloadButton from './DownloadButton';

const documents = {
  assignment: { label: '대체과제 (DOCX)', href: '/documents/대체과제.docx' },
  absence: { label: '불참사유서 (DOCX)', href: '/documents/불참사유서.docx' },
  class: { label: '수업증빙서 (PDF)', href: '/documents/수업증빙서.pdf' },
  duty: { label: '수업업무증빙서 (PDF)', href: '/documents/수업업무증빙서.pdf' },
};
const reasons = [
  { id: 'class', label: '타 수업/시험과 중복', proof: '수업증빙서', attachment: '시간표와 U-Check 사진을', signer: '수업 진행 담당자(교수 등)' },
  { id: 'duty', label: '수업 조교 혹은 업무 진행', proof: '수업업무증빙서', attachment: '근로내역 혹은 본인의 이름이 기재된 업무명부를', signer: '해당 부서 담당자' },
  { id: 'official', label: '기타 공적인 사유에 의한 공결 사용', proof: '공결처리요청서', attachment: '공결서와 같은 공적 증빙 서류를' },
  { id: 'other', label: '해당하지 않아요.' },
];

export default function AssignmentGuide() {
  const [selected, setSelected] = useState(null);
  const reason = reasons.find(item => item.id === selected);
  const files = reason?.proof ? [documents.assignment, documents.absence, ...(documents[reason.id] ? [documents[reason.id]] : [])] : [];
  return <section className="assignment-guide" aria-labelledby="assignment-question">
    <h2 id="assignment-question" className="form-title">어떤 사유로 대체과제를 신청하시나요?</h2>
    <div className="assignment-reasons" role="group" aria-labelledby="assignment-question">
      {reasons.map(item => <button type="button" key={item.id} aria-pressed={selected === item.id} aria-controls="assignment-instructions" onClick={() => setSelected(item.id)}><span>{item.label}</span><span className="reason-check" aria-hidden="true">{selected === item.id && <Check size={15} strokeWidth={2.3} />}</span></button>)}
    </div>
    <div id="assignment-instructions" className="assignment-instructions" aria-live="polite" aria-atomic="true">
      {reason && <>
        <h3>{reason.label}</h3>
        {reason.id === 'other' ? <div className="assignment-warning">
          <p className="assignment-warning-text"><strong>공적인 사유로 인정되지 않을 경우, 대체과제를 제출하여도 인정되지 않아 특강 미참여로 과목 NP 처리될 수 있습니다.</strong></p>
          <p>사유 확인이 필요하다면 조교에게 메일을 보내주세요.</p>
          <a className="button button-primary button-full" href="mailto:kmooc@applied.kr"><Mail size={18} aria-hidden="true" />메일 보내기</a>
        </div> : <ol className="assignment-steps">
          <li><p>아래 버튼을 눌러 필요한 서류를 다운로드 받으세요.</p><div className="document-downloads">{files.map(file => <DownloadButton key={file.href} {...file} />)}</div></li>
          <li><p><strong>대체과제</strong> 파일에서 과제를 풀고 인쇄하세요.</p></li>
          <li><p><strong>불참사유서</strong> 파일의 불참사유에 ‘{reason.label}’을 적으세요. 다음 페이지에 <strong>{reason.attachment}</strong> 첨부하고 모두 인쇄하세요.</p></li>
          <li><p>{reason.id === 'official' ? <><strong>학사정보시스템에서 공결 승인을 받은 뒤 공결처리요청서를 출력하세요.</strong> 공결처리요청서는 이 페이지에서 다운로드할 수 없습니다.</> : <><strong>{reason.proof}</strong>를 인쇄하고 {reason.signer}에게 서명받으세요.</>}</p></li>
          <li><p>인쇄한 <strong>3가지 종류의 서류에 본인 이름이 기재되어 있는지</strong> 확인하세요. 모두 묶어 제출 장소에 제출해주세요.</p></li>
        </ol>}
      </>}
    </div>
  </section>;
}
