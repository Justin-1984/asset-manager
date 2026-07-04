# AssetManager PWA v6.16.8 Reports UX Cleanup

기준: v6.16.7 Reports Foundation

## 변경 사항
- Reports 화면에 섹션 퀵 네비게이션 칩 추가 (자산/국가/통화/기관/수익률/월별/리밸런싱 바로 이동)
- 비중 리스트(자산/국가/통화/기관)에서 1위 항목 시각적 강조
- 화면에 노출되지 않던 중복 렌더(analysisCards, allocationBars, countryBars) 제거로 렌더 비용 절감
- 리밸런싱 추천이 없을 때 빈 상태 문구 표시

## 회귀 방지
- 기존 자산/거래/환율/시세 데이터 구조는 변경하지 않음
- View Engine / Platform Center 계산 로직을 재사용
- 기존 analysis 탭 ID와 각 리포트 데이터 렌더 대상(id)은 유지하여 호환성 유지
