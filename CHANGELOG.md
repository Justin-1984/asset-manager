# CHANGELOG

## v6.16.9 Stable Cleanup - 2026-07-04

### Changed
- 앱 버전 표기를 v6.16.9로 업데이트
- README 기준을 v6.16.9 Stable Cleanup으로 정리
- Service Worker 캐시명을 v6.16.9로 업데이트
- 백업 다운로드 파일명을 v6.16.9 기준으로 수정
- Reports 히어로 문구를 Reports UX Cleanup 기준으로 수정

### Fixed
- 총 투자손익 계산에서 현금/은행/자동차/부동산 등 비투자 자산이 섞일 수 있던 문제 정리
- 투자손익 계산 대상을 코인/주식/ETF/금 투자자산으로 제한

### Unchanged
- localStorage 키 유지
- 자산/부채/보험/거래/스냅샷 데이터 구조 유지
- 시세/환율 엔진 변경 없음

## v6.16.8 Reports UX Cleanup - 2026-07-04

### Added
- Reports 화면 섹션 퀵 네비게이션 칩 (7개 섹션 바로가기)
- 비중 리스트 1위 항목 하이라이트 스타일
- 리밸런싱 추천 빈 상태 문구

### Changed
- 앱 버전 표기를 v6.16.8로 업데이트
- README를 v6.16.8 기준으로 업데이트
- Service Worker 캐시명을 v6.16.8로 업데이트

### Removed
- 화면에 노출되지 않던 중복 렌더 대상 제거: analysisCards, allocationBars, countryBars, renderBars()

### Unchanged
- localStorage 키 유지
- 자산/부채/보험/거래/스냅샷 데이터 구조 유지
- 시세/환율 엔진 변경 없음

## v6.16.7 Reports Foundation - 2026-07-04

### Added
- Reports Foundation 화면 추가
- 자산 비중, 국가 비중, 통화 비중, 기관 비중 분석
- 투자수익률 리스트
- 월별 변화 스냅샷 리스트
- Reports 전용 반응형 UI와 다크모드 스타일

### Changed
- 앱 버전 표기를 v6.16.7로 업데이트
- README를 v6.16.7 기준으로 업데이트
- Service Worker 캐시명을 v6.16.7로 업데이트

### Unchanged
- localStorage 키 유지
- 자산/부채/보험/거래/스냅샷 데이터 구조 유지
- 시세/환율 엔진 변경 없음

## v6.16.6 Platform Center UI Polish
- Platform Center 기관 카드 UI 개선
- 기관별 총 평가금액, 손익, 비중, 자산 개수, 통화 구성, 최근 업데이트 표시
- 데이터 구조 변경 없음
