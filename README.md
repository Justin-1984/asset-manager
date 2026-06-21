# 자산 매니저 v4.5

## 변경 사항
- 한국 ETF/국내주식도 Market Worker 우선 조회
- 6자리 한국 종목코드 자동 감지
  - 예: 441640
  - 예: 360750
- 미국주식/ETF Worker 조회 유지
- 한국 시세 조회 순서: Market Worker → Naver → Naver/Jina → Yahoo KS/KQ
- 기존 코인 자동시세, 환율, 상태판, 백업 로그 유지

## Worker 업데이트 필요
Cloudflare Worker 코드를 v4.5용 코드로 교체 후 Deploy해야 한국 종목 조회가 됩니다.

## 업데이트 확인 주소
https://justin-1984.github.io/asset-manager/?v=45
