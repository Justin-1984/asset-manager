# 자산 매니저 v4.3.1

## 변경 사항
- 미국주식/ETF 시세 조회 fallback 개선
  - 1순위 Stooq
  - 2순위 Yahoo
- 한국 ETF/국내주식 시세 조회 fallback 개선
  - 1순위 Naver 실시간 API
  - 2순위 Naver/Jina 보조 조회
  - 3순위 Yahoo .KS / .KQ
- 하나 실패하면 다음 시세원으로 자동 재시도
- 기존 v4.3 데이터 상태판, 코인 자동시세, 환율 자동조회, GitHub 백업 로그 유지

## 한국 ETF 입력 방식
한국 ETF/국내주식은 자산명에 6자리 종목코드를 넣는 방식이 가장 안정적입니다.

예:
- 441640
- 360750

## 업데이트 확인 주소
https://justin-1984.github.io/asset-manager/?v=431
