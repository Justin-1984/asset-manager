# AssetManager PWA v6.9.5 Stable Worker FX

- 현재 v6 UI 유지
- v4.5.1에서 성공했던 Worker(Finnhub) 기반 미국주식/ETF 시세 엔진 복원
- SCHD/JEPI/JEPQ/VOO/SPY/QQQ/VTI 등 미국 ETF Worker 우선 조회
- 환율 엔진 복원: open.er-api → Frankfurter → 마지막 정상 환율 유지
- 코인 시세 로직 유지
- stale value/krwValue 대신 현재단가 × 현재환율 계산 우선
- 설정 화면에 USD/USDT/HKD/AUD 수동환율 및 Worker URL 입력/테스트 추가
