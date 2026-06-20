# Asset Manager v3.8

## 핵심 변경
- Binance 잔고 동기화 Cloudflare Worker 방식 추가
- Binance 보유 코인 중 0보다 큰 잔고를 자산 목록에 자동 저장
- 기존 `source: binance-api` 자동연동 자산은 새 잔고로 교체
- 수동 입력한 Binance 자산은 삭제하지 않음
- 평균매수가는 Binance에서 제공하지 않으므로 기존값이 있으면 유지, 없으면 0으로 표시

## 업로드 파일
GitHub Pages에는 아래 6개 파일을 업로드하세요.

- index.html
- app.js
- styles.css
- manifest.json
- sw.js
- README.md

`binance-worker.js`는 GitHub Pages에 올리는 파일이 아니라 Cloudflare Worker에 붙여넣는 파일입니다.

## 업데이트 확인 주소
https://justin-1984.github.io/asset-manager/?v=38

## Binance Worker 사용 순서
1. Cloudflare 접속
2. Workers & Pages → Create Worker
3. `binance-worker.js` 내용을 붙여넣기
4. Deploy
5. 생성된 Worker URL 복사
6. 자산 매니저 → 거래소 → Binance 수정
7. Worker URL 칸에 붙여넣기
8. API Key / Secret 입력
9. 조회 전용 확인 체크
10. 저장
11. Binance 잔고 동기화 클릭

## Binance API 권한
반드시 Reading만 켜세요.

- Enable Reading: ON
- Trading: OFF
- Withdrawals: OFF
