# Asset Manager v3.8.1

## 핵심 수정
- Binance Worker 405 오류 대응
- Worker가 `/`와 `/binance/balances` POST를 모두 허용
- Worker URL을 루트 주소로 넣어도 되고 `/binance/balances`까지 넣어도 동작
- Binance signed account endpoint를 GET 방식으로 명시
- Worker root URL 접속 시 health check JSON 표시

## 업로드
GitHub Pages에는 아래 6개 파일만 업로드하세요.
- index.html
- app.js
- styles.css
- manifest.json
- sw.js
- README.md

Cloudflare Worker에는 `binance-worker.js` 전체를 붙여넣고 Deploy 하세요.
