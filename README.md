# 자산 매니저 v4.4

## 변경 사항
- 미국주식/ETF 자동시세를 Finnhub Cloudflare Worker 방식으로 연결
- 설정에 미국주식 시세 Worker URL 입력칸 추가
- 미국주식 시세 조회 순서: Market Worker(Finnhub) → Stooq → Yahoo
- SCHD/VOO/QQQ/JEPI/JEPQ 등 미국 ETF 자동시세 안정화
- 기존 코인 자동시세, 한국 ETF 1차 조회, 환율, 상태판, 백업 로그 유지

## Worker URL 설정
설정 탭 → 미국주식 시세 Worker URL 칸에 아래 형식의 주소를 입력하세요.

예:
https://asset-manager-market-worker.questionbox00.workers.dev

그 후 저장 → 전체 시세 갱신을 누르세요.

## 업데이트 확인 주소
https://justin-1984.github.io/asset-manager/?v=44
