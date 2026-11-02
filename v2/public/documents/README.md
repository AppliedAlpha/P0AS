# 대체과제 배포 파일

아래 실제 문서를 이 폴더에 넣고 다시 배포합니다. 원본 과제나 서류 내용을 임의로 생성하지 않았습니다.

| 화면 표시 | 파일명 | 사이트 경로 |
|---|---|---|
| 대체과제 (DOCX) | `assignment.docx` | `/documents/assignment.docx` |
| 불참사유서 (DOCX) | `absence-reason.docx` | `/documents/absence-reason.docx` |
| 수업증빙서 (PDF) | `class-confirmation.pdf` | `/documents/class-confirmation.pdf` |
| 수업업무증빙서 (PDF) | `duty-confirmation.pdf` | `/documents/duty-confirmation.pdf` |

Vite는 `public/`의 내용을 배포 결과의 루트로 복사합니다. 링크에는 `public`이나 `v2`를 포함하지 않습니다. 도메인을 하드코딩하지 않아 미리보기 주소와 실제 주소에서 같은 경로를 사용합니다.

학생 안내는 `/assignment`입니다. 다운로드 버튼은 HEAD 요청으로 파일의 존재와 문서 Content-Type을 확인하고, 없거나 HTML이 반환되면 ‘준비 중’으로 비활성화합니다. 파일을 넣은 뒤에는 페이지를 새로고침합니다. 공결처리요청서는 여기에 넣지 않고 학사정보시스템에서 승인 후 출력하도록 안내합니다.

이 폴더의 파일은 누구나 받을 수 있는 공개 파일입니다. 빈 양식·배포용 과제만 넣고 작성된 증빙, 학생 이름·학번·시간표·사진·서명·명단은 넣지 않습니다.
