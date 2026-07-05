# CHANGELOG

## v6.16.10 Institution Icons Safe Cleanup - 2026-07-05

### Fixed
- v6.16.9 Stable Cleanup에서 수정했던 백업 다운로드 파일명이 v6.16.7로 되돌아간 회귀 수정
- Reports 투자손익 계산이 모든 자산 기준으로 되돌아간 회귀 수정
- Reports 히어로 문구가 Reports Foundation으로 되돌아간 회귀 수정
- Reports CSS 주석 버전 표기 정리

### Kept
- 기관/거래소/은행 아이콘 매핑 확장 유지
- 아이콘 색상 통합 CSS 유지
- 데이터 구조/localStorage 키/시세·환율 엔진 변경 없음

## v6.16.9 Institution Icons & Simplify - 2026-07-05

### Added
- 거래소/증권사/은행 아이콘 매핑 15종 신규 추가 (OKX, Bithumb, Coinone, 삼성증권, 토스, 한국투자증권, NH, KB, 신한, 우리, 하나, 카카오뱅크 등)
- 브랜드별 아이콘 색상을 자산카드/섹션요약/Platforms카드/홈 리스트에 공통 적용하는 통합 CSS 규칙

### Changed
- 앱 버전 표기를 v6.16.9로 업데이트, Service Worker 캐시명 갱신
- Platforms 카드: 장식용 그라데이션 띠 제거, 그림자 축소, radius 26px→22px로 단순화
- 자산 카드 상단 배너를 브랜드별 파스텔 그라데이션에서 단일 중립 톤으로 통일

### Unchanged
- localStorage 키, 자산/부채/보험/거래/스냅샷 데이터 구조 유지
- 기존 6종 브랜드(binance/bybit/upbit/kiwoom/mirae/hsbc)의 키워드 매칭 로직 유지

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
