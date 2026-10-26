# P0AS: Physical T-0ken Attendance System
> **K-MOOC 특강 및 대규모 세미나를 위한 1회성 다수 인원 전자출결 시스템**


### 개요
<img width="330" height="390" alt="image" src="https://github.com/user-attachments/assets/17cd3953-292c-4854-b094-25a43b3cea4d" /><br />

P0AS는 특정 시간대에 수백 명의 인원이 동시에 접속하여 출결을 진행해야 하는 <b>1회성 이벤트(특강, 세미나, 워크숍 등)</b>에 대응하기 위하여 제작한 경량 전자출결 솔루션입니다. <br />

복잡한 회원가입 없이 학번과 이름, 그리고 현장에서 배부된 일회성 토큰(Token)만으로 빠르고 안전한 출결을 보장합니다.


### 주요 특징 (Key Features)
- **Structure:** React + Vite 기반 SPA 구조, 모바일 우선형.
- **Token-Based Attendance:** 발행된 6자리 일회용 토큰으로 현장에서 실시간 출석 확인 (비대면 부정 출석의 최소화).
- **Privacy Check:** 학생의 실명은 Client Side에서만 해시 값으로 비교함. DB에는 Masking + Hashing을 적용하여 학생 정보 유출 리스크 낮춤.
- **Prevent Brute-Forcing**: 학번/이름 정보가 3회 이상 불일치할 경우 해당 학번의 접근을 Lock 처리. (부정 시도 방지 목적)
- **Management Dashboard**: 관리자 페이지에서 출결 현황 모니터링 및 수동 승인 가능.


### 기술 스택 (Tech Stack)
- **Frontend:** React (Hooks), Tailwind CSS, Lucide-React
- **Backend/DB:** Firebase Authentication (Anonymous/Custom), Firestore
- **Build/Deploy:** Vite, Cloudflare Pages


### 시작하기 (Getting Started)
#### 환경 변수 설정
프로젝트 루트 또는 배포 환경에 다음 환경 변수(.env)가 설정되어야 합니다.
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_APP_ID=p0as
VITE_NAME_SALT=your_secure_random_salt
```

#### Firebase 연동
`TBA`

#### 설치 및 실행
```py
# 의존성 설치
npm install

# 로컬 개발 서버 실행
npm run dev

# 빌드
npm run build
```


### 주의사항
- 특강 전 Firebase 연동 및 초기화 필요 (학생 명단 해시값과 토큰 생성 필요)
  - How to: `TBA`

- 관리자 페이지에서 시스템 상태(PRE -> OPEN -> CLOSED) 관리 필요 (시간 외 접근 차단)


### LICENSE
본 프로젝트는 교육적 목적으로 제작되었으며, 상업적 이용 시 별도의 협의를 요합니다.
