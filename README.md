# 자산 매니저 v4.4.2

## 변경 사항
- 미국주식 Worker URL 자동 정리
  - `...?symbol=SCHD`까지 넣어도 자동으로 기본 workers.dev 주소만 사용
  - Cloudflare 편집 화면 URL 또는 GitHub Pages 주소를 넣으면 명확히 오류 표시
- Worker 테스트 메시지에 실제 호출 URL 표시
- Worker 404 오류 원인 확인용 상세 메시지 추가
- 기존 v4.4.1 기능 유지

## 설정 방법
설정 탭 → 미국주식 시세 Worker URL에 아래 주소만 입력하세요.

https://asset-manager-market-worker.questionbox00.workers.dev

저장 → SCHD Worker 테스트 → 전체 시세 갱신

## 업데이트 확인 주소
https://justin-1984.github.io/asset-manager/?v=442
