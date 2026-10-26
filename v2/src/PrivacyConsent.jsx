export default function PrivacyConsent({ checked, onChange, disabled }) {
  return <section className="privacy-consent" aria-label="개인정보 수집·이용 동의">
    <details>
      <summary>개인정보 수집·이용 안내</summary>
      <div className="consent-content"><dl>
        <div><dt>처리 주체</dt><dd>세종대학교 K-MOOC &quot;코딩과스토리텔링&quot; 과목 담당 연구실</dd></div>
        <div><dt>이용 목적</dt><dd>출석 확인 및 성적 산출</dd></div>
        <div><dt>수집 항목</dt><dd>학번, 이름, 출석 정보</dd></div>
        <div><dt>보유·이용 기간</dt><dd>성적 산출 및 학기 종료 시 파기</dd></div>
      </dl><p>개인정보 수집·이용에 동의하지 않으면 이 페이지의 출결 등록·조회 등을 이용할 수 없으며, 현장에서 조교에게 수기 출석을 요청해야 합니다.</p></div>
    </details>
    <label className="consent-check"><input type="checkbox" required checked={checked} onChange={event => onChange(event.target.checked)} disabled={disabled} /><span>개인정보 수집·이용에 동의합니다 <span className="required-label">(필수)</span></span></label>
  </section>;
}
