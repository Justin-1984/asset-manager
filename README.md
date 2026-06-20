# 자산 매니저 v3.7

- Binance 실제 잔고 동기화 추가
- Binance API Key/Secret으로 /api/v3/account 조회
- 0보다 큰 잔고만 자산 목록에 자동 저장
- 기존 Binance API 동기화 자산은 새 잔고로 갱신
- Binance 가격은 USDT 기준 자동 반영
- 저장된 Binance 자산은 source: api 로 구분
- sw.js 캐시 v3.7

주의:
- Binance API 권한은 Reading만 켜고 Trading/Withdrawal은 반드시 끄세요.
- API Secret은 브라우저 localStorage에 저장됩니다. 공용 PC에서는 사용하지 마세요.
