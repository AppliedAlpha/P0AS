# 한글 파일명 다운로드 확인

확인일: 2026-11-02. 프로젝트·운영 문서의 파일명은 변경하지 않고, 독립된 `.local/filename-probe-*/`에 만든 가상 파일로 검사했습니다. 실제 과제·학생 정보·DB·원격 배포는 사용하지 않았습니다.

## 확인 결과

Vite production 빌드와 로컬 preview 서버에 현재 `DownloadButton`을 연결해 파일명과 다운로드한 바이트의 SHA-256을 비교했습니다. 네 엔진/설정에서 각각 아래 이름 다섯 개, URL 인코딩, 분리형 한글 경로, 영문 경로와 한글 `download` 속성, HTTP 파일명 헤더를 검사했습니다.

- `대체과제.docx`
- `불참사유서.docx`
- `수업증빙서.pdf`
- `수업업무증빙서.pdf`
- `코딩과스토리텔링 대체과제 (2026).docx`

| 실행 환경 | 한글 경로 5개 | URL 인코딩 경로 | 파일 바이트 | 검증 범위 |
|---|---|---|---|---|
| Windows Edge 149.0.4022.98 | 이름 정상 | 정상 | 일치 | 실제 Windows 브라우저 |
| 같은 Chromium + Pixel 7 설정 | 이름 정상 | 정상 | 일치 | Android 화면·사용자 에이전트 에뮬레이션 |
| Windows용 Playwright WebKit 27.2 | 이름 정상 | 정상 | 일치 | Safari 계열 엔진, 실제 macOS Safari 아님 |
| 같은 WebKit + iPhone 13 설정 | 이름 정상 | 정상 | 일치 | iPhone 화면·사용자 에이전트 에뮬레이션, 실제 iOS 아님 |

총 36회 파일 전송에서 바이트가 모두 일치했습니다. 일반 한글 경로·URL 인코딩·한글 `download` 속성·정확히 일치하는 NFD 경로는 모두 예상 이름으로 저장됐습니다. **실제 Android·iOS·macOS 기기와 원격 Cloudflare Pages 검증을 완료했다는 의미는 아닙니다.** 테스트 내용은 전송 확인용 가상 바이트이므로 실제 Word/PDF 내용이 열리는지도 별도 확인해야 합니다.

Playwright WebKit은 Safari 자체가 아니며 운영체제에 따라 차이가 있을 수 있습니다. [Playwright 브라우저 설명](https://playwright.dev/docs/browsers#webkit)

## 주의할 두 가지

### 같은 모양의 한글이 서로 다른 경로일 수 있음

한글에는 완성형 NFC와 자모를 조합한 NFD 표현이 있습니다. NFD 이름의 실제 파일을 NFC 이름의 URL로 요청했을 때 문서를 찾지 못하는 경우를 로컬에서 재현했습니다. 실제 파일과 요청 경로를 동일하게 지정하면 NFD도 내려받을 수 있었으며 이는 파일 바이트나 글자가 깨지는 현상과는 다릅니다.

NFC/NFD가 다른 파일명은 눈으로만 비교하지 않습니다. 파일명을 확정할 때 실제 파일명과 링크의 표현까지 일치시킵니다. macOS를 포함한 파일 시스템 간 파일 이동에서 이 차이가 생길 수 있습니다. [Node.js 파일 시스템·Unicode 안내](https://nodejs.org/learn/manipulating-files/working-with-different-filesystems)

### HTTP 헤더의 파일명은 별도 검증 필요

추가 비교에서 영문 URL에 아래 헤더를 붙이면 Edge는 `대체과제.docx`로 저장했지만, Windows용 Playwright WebKit은 영문 fallback인 `assignment.docx`를 사용했습니다. 이것은 해당 Windows WebKit 포트에서 관찰한 결과이며 실제 macOS/iOS Safari의 결과로 일반화하지 않습니다.

```http
Content-Disposition: attachment; filename="assignment.docx"; filename*=UTF-8''%EB%8C%80%EC%B2%B4%EA%B3%BC%EC%A0%9C.docx
```

표준은 UTF-8의 `filename*`와 영문 `filename` fallback을 정의합니다. 일반 `filename`에 인코딩된 `%EB...` 문자열을 그대로 넣는 방식과는 다릅니다. 헤더를 추가할 때는 실제 대상 브라우저에서도 이름을 확인합니다. [RFC 6266](https://www.rfc-editor.org/rfc/rfc6266.html)

## 함께 보완한 DOCX 판정

실제 로컬 preview 서버에서 DOCX 응답의 `Content-Type`이 생략되는 경우를 확인했습니다. 파일이 존재해도 버튼이 준비 중으로 남는 문제를 수정했습니다. 성공 응답이며 경로 확장자가 DOCX/PDF인 무유형 응답을 허용하고, 명시적인 HTML fallback이나 다른 미디어 유형은 계속 거절합니다. 브라우저 테스트에서 무유형 DOCX와 HTML fallback을 함께 검증합니다.

실제 파일 이름이 정해지면 `src/AssignmentGuide.jsx`의 URL도 그 이름에 맞춰 변경해야 합니다. 한글명 확인 작업만으로 기존 영문 URL을 자동 변경하지 않았습니다. 배포 전 로컬에서 파일을 열고 내려받은 뒤, 올바른 Pages 프로젝트에 반영하여 각 기기에서 저장된 이름·확장자·열기를 확인합니다. 로컬 확인 → 원격 대상 확인 → 원격 배포·확인의 명령과 기대 결과는 [대체과제 파일 배포](ASSIGNMENT_GUIDE.md)에 있습니다.
