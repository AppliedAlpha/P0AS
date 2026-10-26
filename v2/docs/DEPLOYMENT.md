# p0as.applied.kr 배포 준비와 확인

학생 주소는 `https://p0as.applied.kr`, 관리자 주소는 `https://p0as.applied.kr/manage`입니다. QR은 학생 주소로만 연결하며 학번이나 토큰을 URL에 넣지 않습니다. 이번 단계에서는 원격에도 새 가상 데이터만 등록합니다. 이 문서는 실행 절차이며 원격 DB 생성·쓰기·배포·DNS·Access 변경은 자동 실행하지 않았습니다.

## 배포 준비 중인 환경에 최신 변경 적용

학생 인증에는 Turnstile이 필요하지 않습니다. 준비한 DB와 서버 비밀키는 그대로 사용합니다. **출석 취소 기능을 추가한 최신 버전에는 0003 마이그레이션이 필요합니다.** [로컬 검증 → 원격 대상 확인·백업 → 마이그레이션·배포 절차](OPERATIONS.md#출석을-미출석으로-되돌리기)를 따라 적용하며 DB를 초기화하지 않습니다.

1. 먼저 저장소 루트의 PowerShell에서 로컬 검증을 실행합니다.

   ```powershell
   cd v2
   npm.cmd test
   npm.cmd run lint
   npm.cmd run build
   npm.cmd run check:functions
   npm.cmd run test:browser
   ```

   예상 결과는 서버 테스트 44개, 브라우저 테스트 6개 통과와 두 빌드 성공입니다. 서버 테스트는 메모리 DB에서 원격 환경을 모사하고, 브라우저 테스트도 매번 새 로컬 DB에서 실행합니다. 원격 DB를 사용하지 않습니다.

2. 원격에 적용하기 전에 아래 읽기 명령으로 계정과 D1 목록을 확인합니다. `wrangler.toml`의 `database_id`를 이미 준비한 `p0as-v2-staging` DB와 대조하고, Pages 프로젝트의 Root directory가 `v2`, 바인딩명이 `DB`인지 확인합니다.

   ```powershell
   npx.cmd wrangler whoami
   npx.cmd wrangler d1 list
   ```

3. 이 수정이 포함된 커밋을 GitHub의 Pages 연결 브랜치에 반영하고 새 배포가 성공했는지 확인합니다. 서버 환경값은 4절의 5개만 필요합니다. 기존 `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`가 있으면 삭제해도 됩니다. 아직 만들지 않았다면 추가하지 않습니다. 기존 `SESSION_SECRET`, `DATA_SECRET`은 유지합니다.
4. 새 배포의 `/`와 `/check`를 시크릿 창에서 엽니다. 기존 원격 가상 학생과 원격에서 발급한 미사용 토큰으로 개인정보 동의 후 출석하고, 학번·이름과 동의만으로 결과를 조회합니다. 별도 보안 확인을 기다리지 않고 처리되어야 합니다. `/manage`와 `/api/admin/*`의 Access 보호도 확인합니다. 원격에서 등록한 학생이나 출석이 로컬 DB에 나타나지 않는지 확인합니다.

이 문서는 적용 절차입니다. 이번 수정에서 원격 DB나 Cloudflare 설정·배포를 직접 변경하지 않았습니다.

운영 설정의 **모두 초기화**가 추가되었습니다. 명단·출결·토큰·활동 기록 삭제와 기본 설정 복원은 경고창에서 확인한 뒤 실행합니다. 이 기능의 [로컬 검증 → 원격 대상 확인 → 배포 및 초기화 확인 절차](OPERATIONS.md#운영-설정의-모두-초기화)를 따르세요. 기능을 배포하는 것만으로 데이터가 초기화되지는 않습니다.

## 1. 로컬에서 먼저 확인

**출석 취소 기능에는 `0003_attendance_revocation.sql` 적용이 필요합니다.** 사용 토큰·출석 연결을 보존하는 [로컬 검증 → 원격 대상 확인·백업 → 마이그레이션·배포 절차](OPERATIONS.md#출석을-미출석으로-되돌리기)를 먼저 따르세요. 0003이 없으면 미출석 처리는 데이터를 바꾸지 않고 거절됩니다. 현재 서버 테스트는 44개(504개 변인 조합 포함), 브라우저 테스트는 6개입니다.

기본 웹폰트와 명단의 시도 횟수 표시는 새 앱 배포로 적용됩니다. 로컬에서 `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test:browser`를 실행해 빌드 성공과 브라우저 테스트 6개 통과를 확인합니다. 테스트는 독립 로컬 DB만 사용합니다.

원격 적용 전 `v2`에서 `npx.cmd wrangler whoami`, `npx.cmd wrangler d1 list`로 의도한 계정·DB인지 확인하고 `wrangler.toml`의 대상과 대조합니다. 이번 표시 변경에는 DB 마이그레이션이나 환경값 추가가 필요하지 않습니다. Pages에서 새 커밋 배포가 성공하면 학생 출석·조회·관리자 페이지의 글꼴, 관리자 명단의 **시도 횟수** 열을 확인합니다. 개발자 도구 Network의 폰트 요청은 같은 도메인의 `/fonts/pretendard/`에서 성공해야 합니다. 명단의 횟수는 토큰 입력 실패 횟수이며 잠금 해제 후 0회로 바뀝니다. 원격 설정·DB·초기화는 이 변경에서 직접 실행하지 않았습니다.

저장소 루트의 PowerShell에서:

```powershell
cd v2
node --version
npm ci
npm run db:local
npm test
npm run lint
npm run build
npm run test:browser
npm run dev
```

Node 24 이상이 필요합니다. `http://127.0.0.1:5173`에서 출석·조회·관리자 화면을 확인합니다. 체험 정보는 학번 `26000001`, 이름 `가상하나`, 미사용 시 토큰 `482913`입니다. `/manage`의 관리자 로그인은 로컬에서만 전용 세션을 발급하며 실제 Access 로그인과 다릅니다.

로컬 개발 DB는 `.local/p0as.sqlite`, 브라우저 테스트 DB는 매 실행 `.local/browser-tests/<UUID>/`에 새로 만들어집니다. 원격 설정을 읽거나 원격 DB로 대체 연결하지 않습니다. 테스트의 토큰 전체 삭제는 독립된 테스트 DB에서만 실행됩니다.

인쇄 확인:

1. 관리자 → 출석 토큰에서 토큰을 발급한다. 일부를 선택하면 선택한 토큰만, 선택하지 않으면 번호를 확인할 수 있는 전체 토큰을 인쇄한다.
2. 인쇄 대화상자에서 **A4 세로, 배율 100%, 머리글·바닥글 끄기**를 사용한다. 용지 여백과 절취선은 앱이 지정한다.
3. 한 장에 3열 × 10행, 최대 30개가 나와야 한다. 31개부터 다음 페이지로 넘어간다.
4. 잘라낸 개별 토큰에도 행사명, 6자리 번호, 1회용 안내, 조교 문의 안내, QR이 남아야 한다.
5. 휴대폰으로 QR을 읽으면 `https://p0as.applied.kr`로 이동해야 한다. 아직 이 도메인이 v1에 연결되어 있다면 QR이 v2를 여는지에 대한 최종 확인은 도메인 전환 후 진행한다.

QR은 외부 QR 서비스 없이 정적 SVG로 생성합니다. URL은 `src/print-config.js`의 `ATTENDANCE_URL`로 관리하며 `npm run build` 전에 자동 재생성됩니다. 수동 재생성은 `npm run qr:generate`입니다.

## 2. 원격 계정과 새 D1 대상 준비

이 절부터는 로컬 검증을 마친 뒤 사용자가 원격에서 수행하는 작업입니다. 기존 Firebase/이전 학기 DB는 사용하지 않습니다.

```powershell
npx wrangler login
npx wrangler whoami
npx wrangler d1 list
npx wrangler d1 create p0as-v2-staging
```

의도한 Cloudflare 계정인지 확인합니다. 새 DB가 이미 준비되어 있다면 중복 생성하지 말고 그 새 DB의 ID를 확인합니다. 반환된 `database_id`를 `wrangler.toml`의 0으로 된 자리표시자 대신 넣습니다.

```toml
name = "p0as-v2-staging"
compatibility_date = "2026-10-01"
pages_build_output_dir = "./dist"

[[d1_databases]]
binding = "DB"
database_name = "p0as-v2-staging"
database_id = "방금 만든 원격 D1의 UUID"
migrations_dir = "migrations"
```

프로젝트 이름을 다르게 정하면 Pages 프로젝트 이름과 Wrangler의 `name`을 맞춥니다. DB 이름을 바꾸면 아래 D1 명령의 대상도 함께 바꿉니다. DB UUID는 비밀키는 아니지만 원격 대상 식별자이므로 다른 DB의 ID를 복사하지 않습니다.

Wrangler 설정 파일을 사용하는 이 프로젝트에서는 D1 바인딩을 **파일에서 관리**합니다. 대시보드의 같은 바인딩 설정이 읽기 전용일 수 있습니다. 두 곳을 서로 다른 값으로 설정하지 않습니다. [Cloudflare 설정 기준](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)

## 3. 스키마도 로컬 → 원격 순서로 적용

```powershell
npx wrangler d1 migrations apply p0as-v2-staging --local
npx wrangler d1 execute p0as-v2-staging --local --command "SELECT title, state FROM settings WHERE id = 1;"
```

이 DB는 `.wrangler/` 안의 로컬 D1 에뮬레이터이며 Node 개발 DB와도 별도입니다. 마이그레이션 0001·0002·0003이 성공하는지 확인합니다. 이후 원격 계정과 ID를 다시 대조하고:

```powershell
npx wrangler whoami
npx wrangler d1 list
npx wrangler d1 migrations apply p0as-v2-staging --remote
npx wrangler d1 execute p0as-v2-staging --remote --command "SELECT title, state FROM settings WHERE id = 1;"
npx wrangler d1 execute p0as-v2-staging --remote --command "SELECT count(*) AS students FROM students;"
```

**새 원격 DB의 예상 결과는 설정 1개, 상태 PRE, 학생 0명**입니다. 로컬 샘플 16명이 자동 복사되면 안 됩니다. 기존 v2 원격 DB를 갱신하는 경우에는 데이터가 있을 수 있으므로 이 0명 기대값을 적용하지 말고 먼저 백업합니다. 기존 DB의 갱신·백업은 [운영 문서의 이번 변경 적용 절차](OPERATIONS.md)를 따르세요.

## 4. 서버 환경값 준비

Cloudflare Pages의 **Settings → Variables and Secrets**에서 사용할 환경에 다음 값을 설정합니다. 앱이 배포되는 기본 브랜치 환경은 대시보드에서 Production이라 부르지만, 이번에는 그 환경에도 가상 데이터만 사용합니다. Preview를 사용한다면 Preview DB와 키도 별도로 지정합니다.

| 이름 | 넣을 값 |
|---|---|
| `SESSION_SECRET` | 원격 전용 새 랜덤 문자열, 최소 32자 |
| `DATA_SECRET` | 위 값과 다른 원격 전용 새 랜덤 문자열, 최소 32자 |
| `ACCESS_TEAM_DOMAIN` | 예: `your-team.cloudflareaccess.com` |
| `ACCESS_AUD` | 6절에서 만든 관리자 Access 앱의 AUD |
| `ADMIN_EMAILS` | 허용 관리자 이메일, 여러 명은 쉼표 구분 |

이 값들은 서버 runtime에서 사용합니다. 민감한 값은 Secret으로 저장하고 Git 또는 `VITE_` 변수로 넣지 않습니다. 로컬 `.local/secrets.json`은 복사하지 않습니다. `LOCAL_DEV`는 원격에 설정하지 않습니다. DATA_SECRET은 기존 토큰 복호화에도 필요하므로 기존 DB가 있는 환경에서 임의로 바꾸지 않습니다.

새 랜덤 값을 생성하려면 신뢰하는 비밀 생성기를 사용하거나 아래 명령을 로컬 터미널에서 각 키마다 따로 실행하고, 출력값을 해당 Secret에만 저장합니다. 이 명령은 DB를 변경하지 않습니다.

```powershell
node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(48).toString('hex'))"
```

학생 출석·조회에는 별도의 CAPTCHA나 widget 등록이 필요하지 않습니다. 학번·이름과 개인정보 동의로 학생 세션을 발급하고, 출석할 때 서버가 토큰을 검증합니다. 필요한 서버 환경값은 위의 5개입니다.

## 5. Pages와 GitHub 연결

Cloudflare Workers & Pages에서 **새 Pages 프로젝트**를 생성하고 기존 `p0as` GitHub 저장소를 연결합니다.

| 설정 | 값 |
|---|---|
| Project name | `p0as-v2-staging` 또는 Wrangler의 name과 같은 이름 |
| Root directory | `v2` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Build environment `NODE_VERSION` | `24` |
| D1 binding | Wrangler 파일의 `DB`와 새 원격 DB ID |

`functions/`가 함께 배포되어야 합니다. 정적 dist 폴더만 수동 업로드하는 방식으로 대체하지 않습니다. 기존 v1 Pages가 같은 저장소의 루트를 빌드하고 있었다면 폴더 이동을 push하기 전에 그 프로젝트의 Root directory를 `v1`로 맞춥니다. v2 프로젝트는 `v2`를 빌드합니다.

저장소에서 `.env`, `.local`, 서비스 계정, 실제 명단, 토큰 출력물이 추적 대상에 들어가지 않는지 `git status --short --untracked-files=all`로 확인한 뒤 변경을 commit/push합니다. 이 작업에서는 commit이나 push를 실행하지 않았습니다.

첫 빌드가 환경변수 설정 전에 실패했어도 값을 저장하고 다시 배포할 수 있습니다. 성공 후 임시 `<프로젝트명>.pages.dev` 주소에서 설정한 runtime 값과 Functions/D1 연결을 확인합니다. 이 임시 주소의 관리자 API는 Access 설정이 없으면 401로 막히므로, 관리자 확인은 아래 실제 도메인/Access 설정 후 진행합니다.

## 6. 도메인과 관리자 Zero Trust 설정

Pages 프로젝트 → **Custom domains → Set up a domain**에서 `p0as.applied.kr`를 등록하고 안내에 따라 DNS를 연결합니다. Pages에 도메인을 등록하지 않고 CNAME만 만드는 것으로 끝내지 않습니다. 이미 v1 프로젝트가 이 도메인을 사용 중이면 검증 후 전환 시간에 기존 연결을 해제하고 v2 프로젝트로 옮깁니다. 인증서/도메인 상태가 Active인지 확인합니다. [공식 도메인 설정](https://developers.cloudflare.com/pages/configuration/custom-domains/)

Zero Trust → **Access controls → Applications**에서 관리자용 Self-hosted 애플리케이션 하나를 만들고 Public hostname/보호 대상에 아래 두 주소를 추가합니다.

| 대상 | 역할 |
|---|---|
| `p0as.applied.kr/manage` | 관리자 화면, `/manage` 자체와 그 하위 경로 |
| `p0as.applied.kr/api/admin/*` | 명단·토큰·설정·로그인 등 관리자 API |

`/manage/*`만 등록하면 `/manage` 자체가 빠질 수 있습니다. Path가 없는 `p0as.applied.kr`나 `p0as.applied.kr/*`를 등록하면 학생 영역까지 보호하므로 사용하지 않습니다. **학생용 `/`, `/check`, `/api/config`, `/api/session`, `/api/attendance`, `/api/result`에는 Access 정책을 만들지 않습니다.** 학생용 API의 동의·세션·학번·이름·출석 토큰 검증은 앱 서버가 처리합니다. [경로 매칭 규칙](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)

관리자 API도 같은 앱에 넣는 이유는 서버가 `Cf-Access-Jwt-Assertion`을 검증하기 때문입니다. `/manage` 화면만 보호하면 그 바깥의 `/api/admin/*` 요청에는 Access JWT가 붙지 않아 관리자 화면은 열려도 데이터 요청이 401이 될 수 있습니다. JWT 검증을 제거해서 해결하지 않습니다. [Access JWT 검증](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)

Allow 정책에는 운영자 이메일만 넣습니다. Everyone Allow나 학생용 Bypass 정책은 필요하지 않습니다. Google 또는 이메일 OTP 등 원하는 로그인 제공자를 선택합니다. 저장한 **동일 Access 애플리케이션의 Application Audience (AUD)**를 Pages의 `ACCESS_AUD`에, team domain을 `ACCESS_TEAM_DOMAIN`에 설정합니다. 앱 내부 `ADMIN_EMAILS`에도 동일한 운영자 이메일을 등록합니다. 정책 이름이나 계정 ID를 AUD 대신 넣으면 안 됩니다.

저장 후 Pages를 다시 배포합니다. 시크릿 창에서 `/manage`를 열면 먼저 Cloudflare 로그인으로 이동해야 하며, 허용된 계정만 명단을 볼 수 있어야 합니다. 정책을 적용하지 않은 루트와 `/check`는 Cloudflare 로그인 없이 열려야 합니다. [Access 앱 생성](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)

## 7. 원격에 새 가상 데이터로 확인

1. `/manage`에 허용된 계정으로 접속한다. 새 DB라면 학생과 토큰은 비어 있어야 한다.
2. 명단 등록에 아래 CSV를 넣는다. 로컬 DB 파일이나 v1 명단을 업로드하지 않는다.

   ```csv
   student_id,name
   27000001,가상새봄
   27000002,가상여름
   ```

3. 토큰 2~3개를 원격에서 새로 발급하고 새로고침 후 전체 번호를 확인한다. 로컬 샘플 번호와는 독립적이다.
4. 운영 설정에서 행사명을 저장하고 출석 진행 중으로 바꾼다.
5. 별도 시크릿 창에서 루트를 연다. Access 로그인이나 별도 보안 확인 없이 학생 화면이 열려야 한다. 가상 학생 정보·원격에서 발급한 토큰을 입력하고 개인정보 동의에 체크해 출석한다.
6. 결과 조회와 관리자 명단·로그를 확인한다. 다른 가상 학생에게 이미 쓴 토큰을 입력하면 거절되어야 한다.
7. QR을 읽어 실제 `https://p0as.applied.kr`가 열리는지 확인한다. 인쇄 PDF에도 개별 토큰의 QR·안내·번호가 있어야 한다.
8. 로그아웃/비허용 계정/시크릿 창으로 `/manage`와 `/api/admin/overview` 접근이 막히는지 확인한다. 학생 쿠키로 관리자 데이터를 볼 수 없어야 한다.
9. `https://p0as.applied.kr/api/config`는 JSON으로 열려야 한다. 이 경로까지 Access 로그인으로 이동하면 보호 범위를 잘못 설정한 것이다.
10. 로컬 DB의 행사 설정이나 명단이 원격 작업 때문에 바뀌지 않았는지 확인한다. 원격 생성 학생도 로컬에 자동으로 나타나면 안 된다.

## 8. 연결되지 않을 때 확인할 지점

| 증상 | 확인할 항목 |
|---|---|
| 첫 화면에서 서버 설정 오류 | DB binding/ID, SESSION_SECRET/DATA_SECRET, 재배포 여부 |
| 관리자 화면은 열리나 API 401 | 같은 Access 앱에 `/api/admin/*`도 등록했는지 |
| 관리자 API 403 | team domain, AUD, Access 이메일 정책, ADMIN_EMAILS |
| 학생 페이지까지 Access 로그인 요구 | Access의 Path가 비어 있거나 도메인 전체를 보호하는지 |
| 학생의 학번·이름 확인 실패 | 현재 원격 DB에 등록한 가상 학생 정보와 입력값, 개인정보 동의 여부 |
| 일부 과거 토큰이 재발급 필요 | 해시만 남은 이전 토큰은 원문 복원 불가, 새로 발급 |
| QR 인쇄가 비어 있음 | 정적 SVG 파일 배포/로딩 확인, 인쇄 오류 메시지 후 새로고침 |

원격 계정·DB ID·프로젝트·실제로 수행한 확인 결과를 기록합니다. 원격 실행 전 상태를 로컬 검증만으로 배포 완료라고 기록하지 않습니다.
