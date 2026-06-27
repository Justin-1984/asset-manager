# AssetManager PWA v6.9.2 exchange ETF fix

- 환율 안정화: open.er-api → Frankfurter → exchangerate.host → 최근 정상 환율 유지
- 비정상 환율 범위 차단
- 미국 ETF/주식 안정화: Finnhub 토큰 우선 → Yahoo → Stooq → 최근 성공 시세 유지
- 매입금액 통화와 매입 당시 환율 필드 추가
- 매입원가는 현재환율로 변하지 않고, 현재평가액만 현재환율로 계산

# AssetManager PWA v6.9.1 Stable Recovery

- v6.6 정상판 기준 복구
- v6.8/v6.9에서 빈 상태가 저장된 경우 최근 정상 백업 자동 탐색
- 메뉴 전체 복구 버튼 추가
- 시세 조회 타임아웃/캐시 유지/실패 로그 보강
- 기존 기능 유지
