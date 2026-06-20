# Asset Manager v3.9.1

## 핵심 변경
- 거래소 잔고 API 자동조회는 보류
- 보유수량은 수동 입력
- 보유 코인의 현재가는 공개 시세 API로 자동조회
- 앱 실행 시 환율 자동조회 후 코인 시세 자동조회
- `전체 시세 갱신` 버튼 추가
- 시세 반영 후 평가액/수익률 자동 계산

## 업로드
GitHub Pages에는 아래 6개 파일을 업로드하세요.
- index.html
- app.js
- styles.css
- manifest.json
- sw.js
- README.md

`binance-worker.js`는 v3.9.1부터 필수 사용 대상이 아닙니다.


## v3.9.1
- Gate.io/BingX 공개 시세 실패 시 앱 전체가 실패한 것처럼 보이지 않도록 안정 시세원(Binance → OKX → Bybit → Bitget → HTX)을 먼저 사용합니다.
- Gate.io/BingX는 보조 fallback 시세원으로 유지합니다.
