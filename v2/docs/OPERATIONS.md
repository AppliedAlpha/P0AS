# v2: 로컬 검증 후 원격에서 확인하기

현재 단계는 **가상 데이터로 개발·검증**하는 단계입니다. v1 명단, Firebase 설정, 기존 토큰, 기존 서비스 계정은 사용하지 않습니다. 아래 원격 단계는 새 검증용 D1에만 적용합니다.

실제 주소 `https://p0as.applied.kr`와 관리자 경로 `/manage`를 기준으로 한 단계별 준비·도메인 연결·Zero Trust 설정은 [배포 안내](DEPLOYMENT.md)를 참고하세요. 학생 영역에는 Access 정책을 만들지 않습니다.

## 1. 독립된 환경을 확인한다

| 환경 | DB | 비밀키 | 데이터 |
|---|---|---|---|
| 자동 테스트 | 실행마다 새 메모리 SQLite | 테스트 전용 값 | 매번 새 가상 데이터 |
| 브라우저 테스트 | 매 실행 새 `.local/browser-tests/<UUID>/p0as.sqlite` | 같은 새 디렉터리에 자동 생성 | 독립 가상 데이터, 포트 5175 |
| 로컬 개발 | `v2/.local/p0as.sqlite` | `v2/.local/secrets.json`의 자동 생성 값 | 가상 명단 16명·테스트 토큰 |
| 로컬 D1 런타임 확인(선택) | Wrangler `.wrangler/` 내 에뮬레이터 | 로컬 개발과 공유하지 않는 임시 값 | 빈 스키마만 확인 |
| 원격 개발 검증 | 새 `p0as-v2-staging` D1 | Cloudflare에만 저장한 새 값 | 관리자 화면에서 가상 데이터만 등록 |
| 향후 운영 | 별도 새 운영 D1과 Pages 프로젝트 | 운영 전용 새 값 | 이번 작업에서 다루지 않음 |

로컬과 원격 사이에 데이터 복사·동기화·대체 연결은 없습니다. 로컬 서버는 원격 Cloudflare 계정에 로그인하지 않아도 동작해야 합니다. 로컬에서 원격 DB를 사용하도록 `remote: true` 등의 설정을 추가하지 마세요.

## 2. 로컬 앱과 DB를 먼저 확인한다

PowerShell에서 저장소 루트를 기준으로:

```powershell
cd v2
node --version
npm ci
npm run db:local
npm run dev
```

Node 버전은 24 이상이어야 합니다. `db:local`은 `.local/p0as.sqlite`를 만들고 처음 한 번 가상 데이터를 넣습니다. 기존 로컬 데이터가 있으면 덮어쓰지 않습니다. 콘솔에 **LOCAL / FICTIONAL DATA ONLY**와 `http://127.0.0.1:5173`이 표시되어야 합니다.

1. `/`에서 학번 `26000001`, 이름 `가상하나`, 토큰 `482913`을 입력하고 개인정보 동의에 체크해 출석한다. 미체크 상태에서 버튼이 비활성인지도 확인한다.
2. `/check`에서 같은 학번·이름과 동의 체크로 출석 결과를 확인한다.
3. `/manage`에서 **관리자 로그인**을 눌러 학생 상태와 활동 기록을 확인한다. 화면에 환경/가상 데이터 표시가 없는 것은 의도한 디자인이다. 실제 DB 분리는 콘솔과 파일 경로로 확인한다.
4. 미출석 학생을 수동/과제 승인하고, 잠금된 가상 학생의 잠금을 해제한다.
5. 토큰 메뉴에서 새 토큰을 발급하고 새로고침 후에도 전체 번호 조회·저장·인쇄가 가능한지 확인한다. 인쇄는 A4/100%/브라우저 머리글·바닥글 끄기로 확인한다. 페이지당 30개, 각 토큰에 출석 QR·1회용 안내·조교 문의 안내가 있어야 한다. 학생 또는 비로그인 요청에는 번호를 반환하지 않아야 한다.
6. 운영 설정을 종료로 바꾸고 학생 화면에서 신규 출석은 막히지만 결과 조회는 가능한지 확인한다. 상태는 10초 이내 갱신된다.
7. 명단 메뉴에서 `student_id,name` 두 열의 새 가상 CSV를 등록하고 이름 표시 토글, 출석 유형별 필터, 학번·처리 시각 양방향 정렬, CSV 다운로드를 확인한다. 기존 명단을 가져오지 않는다.
8. 토큰 선택 삭제·전체 초기화·전체 삭제의 확인 대화상자를 확인한다. 실제 실행 시 학생의 출결 기록은 유지되어야 한다. 반복 삭제 검증은 독립된 브라우저 테스트 DB에서 수행하는 편이 좋다.

개발 서버를 실행한 상태에서 다른 PowerShell 창을 열어 `v2`에서:

```powershell
npm test
npm run lint
npm run build
npm run check:functions
npm run test:browser
```

예상 결과: 보안·동시성 테스트 성공, 린트 오류 없음, `dist/` 생성, Pages Functions 번들 생성, 모바일·데스크톱 브라우저 검사 성공. 브라우저 검증은 매 실행 별도 DB와 키를 만들며 일반 개발 DB에는 쓰지 않습니다. 토큰 전체 삭제 검증도 이 독립 DB에서만 수행합니다.

테스트는 서명 위조·만료·세션 폐기, 관리자 권한, 타 출처 요청, 토큰 재사용, 동일 학생과 동일 토큰의 동시 제출, 3회 잠금, 종료 상태를 포함합니다. Node SQLite 테스트는 Cloudflare의 원격 실행환경이나 계정별 Access 설정까지 검증하지 않습니다. 원격 확인은 아래 7절에서 별도로 진행합니다.

## 운영 설정의 모두 초기화

`/manage` → **운영 설정 → 모두 초기화**는 학생 명단, 모든 출결·점수·잠금, 토큰과 발급 묶음, 활동 기록을 삭제합니다. 학생 세션과 요청 제한 상태도 비우며, 행사명은 `K-MOOC 특강`, 접수 상태는 `PRE`(출석 시작 전)로 되돌립니다. 관리자 인증 설정과 서버 비밀키, DB 스키마는 유지합니다. 경고창의 **취소**나 Esc는 데이터를 변경하지 않으며, 경고창에서 **모두 초기화**를 눌러야 실행됩니다.

이 기능은 토큰 메뉴의 **전체 초기화**와 범위가 다릅니다. 토큰 메뉴의 초기화는 토큰 사용 상태만 비우고 학생 출결을 유지합니다. 운영 설정의 **모두 초기화**는 명단과 출결까지 삭제합니다. 삭제한 데이터는 앱에서 복구할 수 없습니다.

### 로컬에서 먼저 확인

저장소 루트의 PowerShell에서:

```powershell
cd v2
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run check:functions
npm.cmd run test:browser
```

예상 결과는 서버 테스트 32개, 브라우저 테스트 5개 통과와 두 빌드 성공입니다. 전체 초기화는 서버 테스트의 독립 메모리 DB와 매번 새로 생성하는 `.local/browser-tests/<UUID>/`에서만 실행합니다. 취소·Esc 시 미실행, 오류 후 재시도, 데이터 전체 삭제, 기본 설정 복원, 학생 세션 폐기, 중간 실패 시 전체 롤백을 확인합니다. 일반 개발 DB와 원격 DB는 이 테스트로 초기화되지 않습니다.

일반 로컬 앱에서 직접 실행하면 `.local/p0as.sqlite`의 데이터가 삭제됩니다. 초기화 후에는 서버를 재시작해도 샘플이 자동 복구되지 않습니다. 최초 샘플 생성 여부는 로컬 전용 메타데이터로 보존합니다. 샘플 DB를 다시 만들려면 아래 3절처럼 기존 로컬 DB를 보관하고 새 DB를 생성합니다.

### 원격 대상 확인 후 적용

```powershell
npx.cmd wrangler whoami
npx.cmd wrangler d1 list
```

현재 계정과 `wrangler.toml`의 DB 이름·ID를 대조하고 Pages의 `DB` 바인딩이 같은 DB를 가리키는지 확인합니다. 이번 변경은 추가 마이그레이션이나 서버 환경값 변경 없이 새 앱을 배포하면 적용됩니다. 로컬 전용 샘플 메타데이터는 원격 D1에 추가하지 않습니다.

원격에서 초기화까지 검증하려면 삭제해도 되는 가상 데이터만 있는 DB인지 확인합니다. 보관할 가상 데이터가 있다면 서로 다른 파일명으로 먼저 백업합니다.

```powershell
npx.cmd wrangler d1 export p0as-v2-staging --remote --output .local/before-full-reset.sql
```

이 백업은 원격 DB를 읽어 저장한 파일이며 로컬 개발 DB로 가져오지 않습니다. 원격 서버의 `DATA_SECRET`도 별도로 안전하게 보존해야 토큰 암호문을 복구할 수 있습니다. 원격 비밀키를 로컬 개발 설정에 복사하지 않습니다.

새 커밋 배포 후 원격 `/manage`의 운영 설정에서 먼저 경고창을 열고 취소해 명단이 유지되는지 확인합니다. 초기화를 실제 실행하기로 했다면 경고창에서 삭제 범위를 다시 확인하고 실행합니다. 예상 결과는 빈 명단·토큰·활동 기록, 행사명 `K-MOOC 특강`, 접수 상태 `PRE`입니다. 기존 학생 세션은 조회 시 401이 되며 관리자 화면은 유지됩니다. 로컬 개발 DB의 명단과 행사 설정은 변하지 않아야 합니다.

이번 구현에서 원격 초기화·DB 백업·Cloudflare 설정 변경은 직접 실행하지 않았습니다.

## 3. 필요할 때 로컬 데이터를 새로 만든다

1. 실행 중인 개발 서버를 `Ctrl+C`로 종료한다.
2. `.local/p0as.sqlite`를 다른 이름으로 옮겨 보관한다. 같은 이름의 백업이 없는지 먼저 확인한다.
3. `npm run db:local`을 실행하면 새로운 가상 DB가 생성된다.

```powershell
Test-Path -LiteralPath '.local\p0as-backup.sqlite'
Move-Item -LiteralPath '.local\p0as.sqlite' -Destination '.local\p0as-backup.sqlite'
npm run db:local
npm run dev
```

`Move-Item` 대상은 **v2/.local 안의 파일 한 개**입니다. 원격 DB에는 영향을 주지 않습니다. 백업을 복구할 때 이름 검증값과 일치하는 `.local/secrets.json`도 함께 보존해야 합니다. `.local`은 Git에 올리지 않습니다.

## 4. 원격 계정과 새 DB를 먼저 확인한다

이 단계부터는 인터넷과 Cloudflare 계정이 필요합니다. 로컬 명령과 달리 `--remote`를 명시한 명령만 원격 D1에 적용합니다.

```powershell
npx wrangler login
npx wrangler whoami
npx wrangler d1 list
```

Cloudflare 계정·조직이 이번 검증용 대상인지 확인합니다. 기존 DB를 재활용하지 않고 새 DB를 생성합니다.

```powershell
npx wrangler d1 create p0as-v2-staging
```

반환된 새 `database_id`를 `v2/wrangler.toml`의 자리표시자 대신 넣습니다. `database_name`은 `p0as-v2-staging`, binding은 `DB`로 유지합니다. DB ID는 비밀키가 아니지만 원격 대상의 식별자이므로 반드시 의도한 계정의 새 ID인지 대조합니다. 향후 운영에는 다른 이름과 새 ID를 사용합니다.

### 이번 변경을 기존 v2 DB에 적용하는 경우

로컬 Node DB는 `npm run db:local` 또는 `npm run dev` 시작 시 누락된 마이그레이션을 순서대로 적용합니다. 이번 `0002_admin_management.sql`은 학기 열을 제거하고 이름 원문 열과 토큰 암호문 열을 추가합니다. 출석·점수·토큰 상태는 유지합니다. 기존 동의 시각/버전 열은 없고 이번에도 추가하지 않습니다.

1. 로컬 서버를 종료한 상태에서 `.local/p0as.sqlite`와 `.local/secrets.json`을 별도 안전한 위치에 백업한다.
2. `npm run db:local` 후 `npm test`, `npm run lint`, `npm run build`, `npm run test:browser`를 실행한다. 재실행해도 마이그레이션이 중복 적용되면 안 된다.
3. 아래 5절의 `--local` D1 마이그레이션과 조회를 먼저 확인한다.
4. 원격은 `npx wrangler whoami`, `npx wrangler d1 list`로 계정과 DB ID를 확인한다. 기존 원격 DB가 있으면 변경 전에 `npx wrangler d1 export p0as-v2-staging --remote --output .local/staging-before-0002.sql`로 백업한다. 이 파일은 로컬 개발 DB에 import하지 않는다.
5. 확인한 같은 새 staging 대상에만 5절의 `--remote` 마이그레이션을 적용하고 새 앱을 재배포한다. 구버전 앱은 제거된 semester 열을 참조하므로 유지보수 시간에 마이그레이션과 배포를 함께 진행한다.
6. 원격에서 기존 이름/토큰이 NULL이면 원문이 없는 데이터다. 이름은 새 가상 명단 CSV로 재등록하고, 토큰은 새로 발급한다. 해시에서 복원한 값인 것처럼 표시하지 않는다.

원격 백업·마이그레이션·배포는 이 개발 작업에서 실행하지 않았습니다.

## 5. 마이그레이션을 로컬 D1에서 확인한 뒤 원격에 적용한다

선택적인 D1 에뮬레이터 확인은 Node 개발 DB와 다른 **또 하나의 로컬 DB**를 사용합니다. 아래 `--local` 명령은 원격 데이터를 변경하지 않습니다.

```powershell
npx wrangler d1 migrations apply p0as-v2-staging --local
npx wrangler d1 execute p0as-v2-staging --local --command "SELECT title, state FROM settings WHERE id = 1;"
```

설정 행이 하나이고 상태가 `PRE`인지 확인합니다. 원격 대상을 다시 확인한 후에만:

```powershell
npx wrangler d1 list
npx wrangler d1 migrations apply p0as-v2-staging --remote
npx wrangler d1 execute p0as-v2-staging --remote --command "SELECT title, state FROM settings WHERE id = 1;"
npx wrangler d1 execute p0as-v2-staging --remote --command "SELECT count(*) AS students FROM students;"
```

예상 결과: 원격에 스키마가 생성되고 상태는 `PRE`, 학생 수는 `0`. 로컬의 16명이나 로컬 토큰이 원격에 나타나면 안 됩니다. 예상과 다른 기존 데이터가 보이면 대상을 재확인하고 중단합니다. 원격 테이블 삭제나 전체 초기화 명령은 제공하지 않습니다.

## 6. Pages와 서버 전용 설정을 연결한다

Cloudflare Dashboard에서 기존 GitHub `p0as` 저장소를 연결한 **새 Pages 프로젝트**를 만듭니다.

| 항목 | 값 |
|---|---|
| 프로젝트 이름 예 | `p0as-v2-staging` |
| Root directory | `v2` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node 버전 | `24` |
| D1 binding | `DB` → 이번에 만든 새 staging D1 |
| Build watch paths | `v2/**` (설정할 수 있는 경우) |

`functions/`는 `v2/functions/`에 있어야 합니다. 정적 파일만 올리면 API가 동작하지 않습니다. Git 연동 빌드에서 Pages Functions가 함께 배포되도록 확인합니다. 이전 v1 Pages 프로젝트가 있다면 해당 Root directory도 `v1`으로 바꿔야 폴더 이동 후 기존 배포가 깨지지 않습니다.

Pages **runtime**의 Variables and Secrets에 다음을 설정합니다. Production/Preview를 둘 다 쓰면 각각 다른 DB·키를 연결해야 합니다. 이 문서의 staging Pages 프로젝트에서도 환경을 섞지 마세요.

| 이름 | 용도 |
|---|---|
| `SESSION_SECRET` | 새 랜덤 32자 이상, 학생 세션 서명 |
| `DATA_SECRET` | 위와 다른 새 랜덤 32자 이상, 이름·토큰 검증과 토큰 암호화 키 파생 |
| `ACCESS_TEAM_DOMAIN` | `your-team.cloudflareaccess.com` |
| `ACCESS_AUD` | 관리자 Access 애플리케이션의 audience |
| `ADMIN_EMAILS` | 허용할 운영자 이메일, 여러 명은 쉼표 구분 |

두 비밀키는 Cloudflare에서 새로 만들거나 신뢰하는 비밀 생성기로 별도 생성합니다. `.local/secrets.json`의 값을 복사하지 마세요. 비밀키를 `VITE_` 변수로 바꾸거나 wrangler.toml/GitHub에 기록하지 마세요. **`LOCAL_DEV`는 원격에 설정하지 않습니다.** DATA_SECRET 변경은 기존 이름·토큰 검증값을 무효화하므로 기존 데이터가 있는 환경에서 계획 없이 회전하지 않습니다.

학생 출석·조회에는 별도 widget이나 CAPTCHA 설정이 필요하지 않습니다. 관리자용 Access self-hosted application **하나**에 `p0as.applied.kr/manage`와 `p0as.applied.kr/api/admin/*`를 함께 등록하고 운영자 이메일만 Allow합니다. `/manage/*`만 등록하면 `/manage` 자체가 빠질 수 있으므로 `/manage` 항목을 반드시 넣습니다. `/`, `/check`, 학생용 `/api/*`에는 Access 정책을 만들지 않습니다. 관리자 API인 `/api/admin/*`만 별도 보호 대상입니다. 같은 애플리케이션의 AUD를 `ACCESS_AUD`에 설정합니다. `/api/admin/login`은 인증 후 `/manage`로 돌아오며 API에서도 JWT를 검증합니다. 자세한 대시보드 입력과 확인 방법은 [배포 안내](DEPLOYMENT.md)의 Access 절을 따르세요.

환경변수·D1 바인딩을 저장한 다음 Pages를 다시 배포합니다. 이 작업에서 Cloudflare 설정, 원격 마이그레이션, GitHub push 또는 실제 배포는 자동 수행하지 않습니다.

## 7. 원격에도 새 가상 데이터를 넣어 검증한다

1. 원격 `/`에서 행사명과 출석 시작 전 안내를 확인한다. 환경/가상 데이터 배지와 학기·푸터는 표시하지 않는다. 로컬 테스트 계정이 자동으로 등록되어 있으면 안 된다.
2. `/manage`의 **관리자 로그인**을 누른다. 허용된 계정으로 Access를 통과하고 빈 명단을 확인한다.
3. **명단 등록**에 `student_id,name` 헤더와 가상 학생 `27000001,가상새봄`, `27000002,가상여름`을 넣는다. v1 파일이나 실제 명단을 선택하지 않는다.
4. 토큰 메뉴에서 2~3개의 원격 전용 토큰을 새로 발급한다. 새로고침 후에도 전체 번호가 보이는지 확인한다. 로컬의 `482913`을 원격에 자동 등록하지 않는다.
5. 운영 설정에서 staging 행사명을 저장하고 출석 상태를 **출석 진행 중**으로 바꾼다. 학기 입력은 없다.
6. 학생용 브라우저/시크릿 창에서 `27000001`, `가상새봄`, 방금 원격에서 발급한 토큰을 넣고 개인정보 동의에 체크해 출석한다. 별도 보안 확인 없이 출석 완료가 표시되는지 확인한다. 동의 시각이나 버전은 별도로 저장하지 않는다.
7. `/check`에서 같은 학생의 점수·유형·시각을 확인하고 관리자 명단·로그가 10초 안에 갱신되는지 확인한다.
8. 다른 가상 학생에게 이미 사용한 토큰을 제출해 거절되는지 확인한다. 3회 실패 잠금과 관리자 해제를 확인한다.
9. 종료 상태에서 새 출석은 거절되고 조회는 유지되는지 확인한다.
10. 로그아웃/시크릿 창에서 `/api/admin/overview`를 열어 관리 데이터가 나오지 않는지 확인한다. Cloudflare Access가 로그인으로 보내거나 앱이 401/403을 반환해야 한다. 학생 쿠키로 관리자 데이터를 읽을 수 없어야 한다.
11. `/api/tokens`와 `/api/tokens/482913` 등 임의의 토큰 조회 경로가 데이터를 반환하지 않는지 확인한다. 이 API는 존재하지 않는다.

마지막으로 로컬 개발 서버에서 원격에 추가한 `27000001`이 자동으로 나타나지 않는지, 로컬/원격의 행사 설정이 서로 변하지 않는지 확인합니다. 이것이 환경 분리 확인입니다.

## 8. 확인 결과를 남긴다

로컬에서 실행한 명령과 결과, 원격 계정/Pages 프로젝트/DB ID, 원격에서 실제 확인한 기능, 아직 수행하지 않은 항목을 구분해서 기록합니다. 원격을 실행하지 않았다면 **로컬 검증 완료, 원격 검증 미실행**이라고 명확하게 남깁니다. 새 기능을 바꿀 때도 같은 순서로 진행합니다.

참조: [Cloudflare Pages 모노레포](https://developers.cloudflare.com/pages/configuration/monorepos/), [바인딩과 비밀값](https://developers.cloudflare.com/pages/functions/bindings/), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), [Access JWT 검증](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).
