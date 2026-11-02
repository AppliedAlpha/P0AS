# 대체과제 증빙 안내와 파일 배포

학생 메뉴는 출석하기 `/`, 결과 조회 `/check`, 대체과제 증빙 방법 `/assignment`의 같은 너비 세 탭으로 구성됩니다. 안내는 접수 시작 전·진행 중·종료 후 모두 볼 수 있으며, 학생 확인이나 동의 체크를 요구하지 않습니다. 선택은 브라우저 화면에서만 바뀌고 신청·출결·DB를 변경하지 않습니다.

## 1. 로컬에 실제 배포 파일을 넣고 확인

저장소 루트 기준 아래 위치에 파일을 넣습니다. `public/` 안의 파일은 빌드 시 사이트 루트로 그대로 복사되므로 URL에 `v2`나 `public`을 넣지 않습니다.

| 문서 | 로컬 경로 | 사이트 경로 |
|---|---|---|
| 대체과제 | `v2/public/documents/assignment.docx` | `/documents/assignment.docx` |
| 불참사유서 | `v2/public/documents/absence-reason.docx` | `/documents/absence-reason.docx` |
| 수업증빙서 | `v2/public/documents/class-confirmation.pdf` | `/documents/class-confirmation.pdf` |
| 수업업무증빙서 | `v2/public/documents/duty-confirmation.pdf` | `/documents/duty-confirmation.pdf` |

공결처리요청서는 다운로드 목록에 포함하지 않습니다. 학사정보시스템에서 공결 승인을 받은 뒤 출력하도록 안내합니다. 실제 양식·과제는 사용자가 제공할 예정이며 임의의 과제나 공식 서류를 생성하지 않았습니다. 파일이 없는 동안에는 버튼에 **준비 중**을 표시합니다.

한글 파일명은 로컬 Edge·WebKit에서 경로와 저장 이름을 검사했습니다. 현재 표의 영문 경로는 그대로이며 한글명을 확정하면 실제 이름과 링크를 함께 맞춥니다. NFC/NFD 경로 차이와 실제 Android·iOS·macOS에서 남은 확인 범위는 [파일명 호환성 기록](FILENAME_COMPATIBILITY.md)을 참고하세요. DOCX/PDF 응답이 정상인데 Content-Type만 생략되면 다운로드를 허용하고, 명시적인 HTML 응답은 계속 차단합니다.

공개 폴더에는 배포용 과제와 빈 양식만 넣습니다. 작성된 학생 증빙이나 학번·이름·시간표·사진·서명이 들어간 개인 파일은 넣지 않습니다.

```powershell
cd v2
npm.cmd run dev
```

`http://127.0.0.1:5173/assignment`를 열어 네 사유를 선택합니다. 필요한 파일을 넣은 뒤 페이지를 새로고침하면 해당 버튼이 활성화되어야 합니다. 실제 다운로드한 파일이 맞는 과제/양식인지, DOCX/PDF로 정상 열리는지도 확인합니다. 파일이 없을 때 Vite나 Pages가 HTML 첫 화면을 반환하더라도 문서 MIME 검증으로 다운로드 버튼을 활성화하지 않습니다.

별도 PowerShell에서:

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run test:browser
Get-ChildItem -LiteralPath dist/documents
```

기대 결과는 lint·빌드 성공, 브라우저 테스트 8개 통과와 배포할 문서의 `dist/documents/` 복사입니다. 브라우저 테스트는 독립 로컬 DB와 가상 응답으로 네 사유, 동등한 탭 너비, 좁은 화면, SVG 아이콘·문서 경로·버튼 상태, NP 경고와 메일 주소를 검사합니다. 실제 과제 파일 내용이나 실제 파일 다운로드를 대신 검증하지 않습니다. 파일이 아직 없다면 빌드 결과에도 실제 문서는 없습니다.

다운로드 모양과 가용성 판단은 `src/DownloadButton.jsx`, 문구·다운로드 URL은 `src/AssignmentGuide.jsx`에서 공통으로 관리합니다. 버튼에 문구와 URL만 전달하면 동일한 SVG·스타일을 사용합니다.

## 2. 원격 대상 확인

```powershell
npx.cmd wrangler whoami
npx.cmd wrangler pages project list
```

의도한 Cloudflare 계정과 `p0as.applied.kr`을 연결한 Pages 프로젝트인지 확인합니다. 연결 저장소·브랜치와 Root directory `v2`, 빌드 출력 `dist`를 확인합니다. `/assignment`와 공개 `/documents/*`는 학생용 경로이며 관리자 Access 보호 범위인 `/manage`·`/api/admin/*`에 추가하지 않습니다.

이 기능은 정적 화면·공개 문서만 추가하므로 새로운 DB 마이그레이션·서버 비밀값·API 권한 설정은 필요 없습니다. 로컬 DB를 원격으로 옮기지 않습니다.

## 3. 원격 배포 후 확인

파일 네 개와 앱 변경을 저장소에 반영하고 기존 Pages 배포가 성공했는지 확인합니다. 파일명은 대소문자까지 위 표와 일치시킵니다. 파일이 나중에 추가되어도 코드 수정은 필요 없지만 새 빌드·배포는 필요합니다.

```powershell
$guideSite = 'https://p0as.applied.kr'
(Invoke-WebRequest -Uri "$guideSite/assignment" -Method Head).StatusCode
foreach ($guideFile in @('assignment.docx', 'absence-reason.docx', 'class-confirmation.pdf', 'duty-confirmation.pdf')) {
    $guideResponse = Invoke-WebRequest -Uri "$guideSite/documents/$guideFile" -Method Head
    [pscustomobject]@{ File = $guideFile; Status = $guideResponse.StatusCode; Type = $guideResponse.Headers['Content-Type'] }
}
```

기대 결과는 안내 페이지 200, 업로드한 문서 각각 200과 DOCX/PDF 문서 Content-Type입니다. 문서 요청이 200이어도 `text/html`이면 파일 누락·경로 오타·배포 상태를 확인합니다. 실제 원격 화면을 새로고침하고 버튼을 눌러 다운로드한 파일도 확인합니다. 공결 사유에는 두 문서만, 다른 두 사유에는 세 문서가 표시되어야 합니다. 미해당 사유의 빨간 굵은 NP 경고와 `kmooc@applied.kr` 메일 버튼을 확인합니다.

이번 구현에서는 원격 DB 쓰기·직접 배포·Access 정책 변경·실제 문서 업로드를 실행하지 않았습니다. GitHub 푸시는 연결된 Pages 자동 배포를 시작할 수 있으므로 실제 배포 상태와 파일 응답은 별도로 확인합니다.
