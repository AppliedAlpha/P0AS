# p0as

현장 배부 토큰을 사용하는 특강·세미나 전자출결 시스템.

- `v1/`: 이전 학기 버전. React + Firebase. 기존 구현을 보존합니다.
- `v2/`: 이번 학기 버전. React + Cloudflare Pages Functions + D1. 독립적으로 설치·실행·배포합니다.

v2의 실행, 보안 구조, Cloudflare 설정은 [v2/README.md](v2/README.md)를 참고하세요. GitHub 저장소를 분리할 필요 없이 Pages 프로젝트의 **Root directory를 `v2`**로 지정하면 됩니다. v1 배포가 유지되어 있다면 해당 프로젝트의 루트도 `v1`으로 변경해야 합니다.

명단, 비밀키, 서비스 계정, 로컬 DB는 저장소에 올리지 않습니다.
