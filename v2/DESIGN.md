---
name: p0as v2
description: 한국어 현장 출결을 위한 차분하고 빠르게 읽는 운영 UI
colors:
  green: "#174f44"
  green-hover: "#0e3d34"
  ink: "#253b35"
  muted: "#65736d"
  soft: "#e9f1ed"
  line: "#dce4df"
  paper: "#ffffff"
  canvas: "#f6f8f7"
  focus: "#538976"
  field-border: "#cbd6cf"
  field-border-hover: "#9fb4a6"
  error-surface: "#fff0ed"
  error-text: "#8d3030"
  success-surface: "#eaf4ee"
  success-text: "#245d40"
  status-surface: "#eef1ef"
  status-text: "#5f6b65"
  status-open-surface: "#e7f3eb"
  status-open-text: "#216140"
  status-closed-surface: "#f0eeeb"
  status-closed-text: "#695c4b"
  danger: "#a13232"
  danger-hover: "#812626"
typography:
  headline:
    fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif"
    fontSize: "26px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-0.03em"
  form-title:
    fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif"
    fontSize: "23px"
    fontWeight: 650
    letterSpacing: "-0.03em"
  body:
    fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif"
    fontSize: "13px"
    lineHeight: 1.7
  field:
    fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif"
    fontSize: "15px"
    lineHeight: 1.5
  label:
    fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif"
    fontSize: "13px"
    fontWeight: 650
  button:
    fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif"
    fontSize: "14px"
    fontWeight: 650
  table:
    fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif"
    fontSize: "12px"
  token:
    fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif"
    fontSize: "28px"
    fontWeight: 600
    letterSpacing: "0.4em"
rounded:
  badge: "5px"
  status: "6px"
  compact: "7px"
  field: "8px"
  button: "9px"
  surface: "12px"
  student-shell: "16px"
  dialog: "14px"
spacing:
  icon-gap: "9px"
  field-gap: "9px"
  form-gap: "20px"
  field-padding: "13px 14px"
  button-padding: "12px 20px"
  compact-button-padding: "8px 12px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "{spacing.button-padding}"
  button-primary-hover:
    backgroundColor: "{colors.green-hover}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "{spacing.button-padding}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "{spacing.button-padding}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "{spacing.button-padding}"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.field}"
    padding: "{spacing.field-padding}"
    width: "100%"
  token-input:
    backgroundColor: "#edf4ef"
    textColor: "{colors.green}"
    typography: "{typography.token}"
    rounded: "{rounded.field}"
    padding: "12px 8px 12px 20px"
    height: "68px"
    width: "100%"
  status:
    backgroundColor: "{colors.status-surface}"
    textColor: "{colors.status-text}"
    rounded: "{rounded.status}"
    padding: "7px 10px"
  status-open:
    backgroundColor: "{colors.status-open-surface}"
    textColor: "{colors.status-open-text}"
    rounded: "{rounded.status}"
    padding: "7px 10px"
  status-closed:
    backgroundColor: "{colors.status-closed-surface}"
    textColor: "{colors.status-closed-text}"
    rounded: "{rounded.status}"
    padding: "7px 10px"
  list-surface:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.surface}"
  alert-error:
    backgroundColor: "{colors.error-surface}"
    textColor: "{colors.error-text}"
    rounded: "{rounded.field}"
    padding: "{spacing.field-padding}"
  alert-success:
    backgroundColor: "{colors.success-surface}"
    textColor: "{colors.success-text}"
    rounded: "{rounded.field}"
    padding: "{spacing.field-padding}"
---

# Design System: p0as v2

## Overview

**Creative North Star: "차분한 현장 확인기"**

p0as v2는 한국어 현장 출결을 빠르게 읽고 입력하는 Operate UI다. 밝은 회백색 바탕에 흰 작업 영역과 짙은 녹색 동작을 놓는다. 한글 산세리프와 정렬된 숫자, 얇은 구분선으로 입력·결과·명단을 구별한다.

화면의 성격은 단정하고 실용적이다. 상태는 문구와 점 또는 선형 SVG 아이콘으로 설명한다. 새로운 화면도 v1의 시각 언어를 이어받지 않고 현재 v2의 색, 형태, 상태 표현을 기준으로 삼는다.

**Key Characteristics:**

- 밝은 회백색 바탕과 짙은 녹색 주요 동작
- 한글 산세리프와 고정 크기의 명확한 위계
- 얇은 구분선, 절제된 라운드, 그림자 없는 작업 영역
- 문구와 표시를 함께 쓰는 상태 표현
- 작은 화면에서 입력과 명단을 우선하는 반응형 구성

## Colors

녹색 한 가지 동작 계열과 회녹색 중립 계열을 사용한다. 색의 규범 값은 frontmatter이며 별도의 보조·제3 브랜드 색은 없다.

### Primary

- **깊은 녹색**: 주요 버튼, 선택된 메뉴, 토큰 숫자와 출석 요약.
- **짙어진 녹색**: 주요 버튼의 hover.
- **옅은 녹색**: 아이콘 버튼 hover 등 보조 상태의 바탕.

### Neutral

- **잉크**: 제목과 입력값.
- **회녹색 텍스트**: 설명과 보조 정보.
- **회백색 바탕 / 흰 종이 / 회녹색 선**: 페이지, 작업 영역, 경계와 구획.
- **초점 녹색**: 키보드 초점의 외곽선.
- **입력 경계**: 입력칸의 기본 선과 hover 선.

### Semantic states

- **기본·진행·종료 상태**: 각각 중립, 녹색, 따뜻한 회색의 배경과 글자 조합을 사용한다.
- **성공·오류 알림**: 옅은 의미색 바탕에 진한 글자색과 선형 아이콘을 함께 쓴다.
- sidecar의 8단계 톤 램프는 원색에서 계산한 미리보기용 값이다. 구현된 CSS 팔레트를 확장하는 규범 토큰이 아니다.

**The Status Has Words Rule.** 상태는 색만으로 전달하지 않고 한국어 문구와 점 또는 아이콘을 함께 표시한다.

## Typography

**Body / Label Font:** Pretendard Variable → Pretendard → 운영체제 산세리프 → Malgun Gothic → sans-serif.

공식 Pretendard 1.3.9 가변 웹폰트를 `public/fonts/pretendard/`에 포함해 같은 출처에서 제공한다. 공식 다이나믹 서브셋의 `unicode-range`로 화면에 필요한 글자 파일만 내려받으며 `font-display: swap`으로 텍스트를 먼저 표시한다. 기기에 설치된 글꼴의 버전과 관계없이 같은 웹폰트를 사용한다. 원본 라이선스를 함께 배포하고 별도 디스플레이 서체나 모노스페이스 서체를 사용하지 않는다.

### Hierarchy

- **Headline**: 관리자 화면 제목. 모바일에서는 더 작은 제목 크기(24px)를 사용한다.
- **Form title**: 학생 입력·조회 폼의 제목.
- **Body / Label**: 설명은 여유 있는 행간, 입력 라벨은 중간 굵기로 구별한다.
- **Field / Button**: 입력값과 실행 문구를 주변 설명보다 선명하게 표시한다. 모바일 학생 입력과 설정 입력은 확대된 크기(16px)를 사용한다.
- **Table**: 명단의 기본 글자 크기. 시간·학번·점수·시도 횟수는 고정 폭 숫자 속성(`tabular-nums`)을 사용한다. 시도 횟수는 토큰 입력 실패 횟수를 `0회`, `3회`처럼 표시한다.
- **Token**: 글자 사이가 넓은 가운데 정렬 숫자. 모바일에서는 크기(30px)와 입력 높이(72px)를 키운다.

**The Aligned Numbers Rule.** 학번, 시간, 점수, 토큰처럼 비교하거나 옮겨 적는 숫자는 tabular-nums를 사용한다.

## Layout

학생 화면은 모든 화면 크기에서 최대 440px의 한 열이다. 좌우 여백은 24px(작은 화면 22px)이며 브랜드, 행사명, 탭, 입력, 개인정보 안내/필수 동의, 실행 버튼으로 이어진다. 별도 안내 열·환경 배지·학기·상태 배지·푸터는 사용하지 않는다. 폼과 명단에 장식용 지표 카드를 반복하지 않는다.

관리자 화면은 고정 세로 메뉴(225px), 상단 바, 중앙 작업 영역으로 나뉜다. 작업 영역의 최대 폭은 (1580px)이고 명단 옆 활동 영역은 기본 (242px)이다. 넓은 화면(1500px 이상)에서는 외곽 여백과 활동 영역을 늘린다.

중간 화면(1200px 이하)에서는 메뉴 폭을 줄이고(200px), 활동 기록을 명단 아래의 세 열로 배치한다. 작은 화면(760px 이하)에서도 학생 화면은 동일한 한 열이며 관리자 세로 메뉴는 상단 가로 메뉴로 전환한다. 명단의 학번·이름·출석 유형·점수·시도 횟수·처리 시각과 관리 동작은 최소 730px 표 내부 가로 스크롤로 접근하고 숨기지 않는다. 명단 스크롤 영역은 키보드 초점과 접근 가능한 이름을 제공한다. 활동 기록은 두 열로 줄인다. 화면 자체의 최소 폭은 320px이다.

인쇄는 A4 세로, 여백 8mm, 토큰 3열 × 10행의 별도 출력 레이아웃이다. 각 28mm 높이의 토큰에 20mm QR, 행사명, 큰 6자리 번호, 짧은 1회용/조교 문의 안내와 URL을 둔다. QR에는 4모듈의 흰 여백을 유지하고 흑백으로 출력한다. 30개마다 명시적으로 페이지를 나누며 일반 관리자 화면은 인쇄하지 않는다.

## Elevation & Depth

일반 작업 표면에는 그림자를 사용하지 않는다. 배경의 명도 차이, 얇은 경계선, 구획의 여백으로 작업 영역을 구별한다. 삭제/초기화 확인 dialog만 배경 차단과 오프셋이 있는 부드러운 그림자를 사용한다. 완료 기록의 위아래 점선은 결과를 한 장의 기록처럼 구별한다.

**The Flat Work Surface Rule.** 작업 영역의 구분은 색면과 선으로 만든다. 현재 시스템의 기본 표면에 그림자를 추가하지 않는다.

## Shapes

입력칸과 알림은 부드러운 모서리, 버튼은 조금 더 둥근 모서리, 목록 컨테이너는 넓은 라운드를 사용한다. 상태 배지와 행 동작은 더 작은 곡률을 사용한다. 원형은 상태 점, 결과 심벌, 관리자 로그아웃 표시와 활동 표시처럼 짧은 표시에 한정되어 있다.

학생 폼은 모든 폭에서 페이지 바탕 위에 직접 놓는다. 외곽 카드나 데스크톱 전용 안내 패널을 추가하지 않는다.

## Components

### Buttons

명확하고 차분한 실행 요소다. 기본 높이는 최소 (46px)이며, 학생 주요 동작은 전체 폭과 더 큰 높이를 사용한다. 주요 버튼은 녹색, 보조 버튼은 흰색과 얇은 선, 텍스트 성격의 버튼은 투명 바탕이다. 작은 버튼은 별도의 패딩과 라운드를 사용한다.

hover는 색만 바꾸며 배경과 글자 전환은 (180ms)이다. 비활성 상태는 회색 면과 회색 글자를 사용한다. 처리 중에는 회전하는 선형 로더와 비활성 상태를 함께 적용한다.

### Inputs / Fields

라벨, 입력, 선택적인 도움말을 세로로 배치한다. 입력은 얇은 경계와 흰 바탕이며 hover에서 경계가 진해지고 focus에서 녹색 경계가 된다. 키보드 초점은 외곽선(3px), 간격(4px)으로 유지한다.

토큰 입력은 별도의 서명 요소다. 여섯 자리 숫자를 가운데 배치하고 녹색 글자, 옅은 녹색 바탕, 넓은 자간을 사용한다. 일반 입력과 달리 별도의 hover 경계 규칙은 없다.

### Chips / Status

페이지 상단 운영 상태 배지는 사용하지 않는다. 명단의 출석 유형·잠금과 토큰의 사용 여부는 짧은 문구와 의미색으로 표시한다. 정보 표시에는 버튼용 hover나 focus를 추가하지 않는다.

### Cards / Containers

흰 목록 표면에 얇은 경계와 시스템 표면 라운드를 사용한다. 명단과 토큰 목록은 제목·도구·표를 내부 구획으로 묶으며 표의 행 hover는 아주 옅은 바탕색으로 표현한다. 활동 기록은 별도 그림자 카드로 만들지 않는다.

### Navigation

학생 메뉴는 글자와 아래쪽 선택 선을 사용한다. 데스크톱 관리자 메뉴는 아이콘·문구와 옅은 선택 면을 사용한다. 모바일 관리자 메뉴는 가로 배열과 아래쪽 선택 선으로 바뀐다. 현재 항목은 `aria-current="page"`, 필터 선택은 `aria-pressed`로 드러낸다.

### Alerts and receipts

오류 알림은 `role="alert"`, 성공 알림은 `role="status"`와 아이콘을 사용한다. 알림 문구는 색보다 먼저 이해할 수 있어야 한다. 결과 기록은 점선과 정렬된 이름·값으로 구성한다.

동작 피드백은 색 변화와 처리 중 로더로 제한한다. 회전은 (1s linear infinite)이며 `prefers-reduced-motion: reduce`에서는 애니메이션과 전환을 끈다. 장식용 등장 애니메이션은 구현되어 있지 않다.

### Consent and destructive actions

개인정보 내용은 native details로 접고 필수 체크박스는 항상 표시한다. 미동의 상태의 등록·조회 버튼은 비활성이다. 토큰 삭제/초기화는 대상 수와 출결 기록 유지 안내가 있는 native dialog에서 확인한다. 취소와 실행을 명확하게 구별하며 삭제에는 의미상의 오류색을 사용한다.

## Do's and Don'ts

### Do:

- **Do** 한국어 작업 문구와 현재 상태를 먼저 읽히게 한다.
- **Do** 주요 동작에는 깊은 녹색, 일반 정보에는 중립색을 사용한다.
- **Do** 키보드 초점 외곽선과 상태의 문자 표현을 유지한다.
- **Do** 숫자 비교에는 tabular-nums를 사용한다.
- **Do** 작은 화면에서는 입력과 명단의 주요 정보를 앞세운다.

### Don't:

- **Don't** v1의 시각 언어를 새 v2 화면의 기준으로 가져오지 않는다.
- **Don't** 상태를 색만으로 표현하지 않는다.
- **Don't** 현재의 평평한 작업 표면에 장식용 그림자를 추가하지 않는다.
- **Don't** 미리보기용 톤 램프나 특정 화면의 미세 보조 글자 크기를 새 화면의 기본 토큰으로 확대하지 않는다.
