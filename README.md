# AssetManager PWA v6.18.2 View State Consolidation

기준: v6.18.1 Icon & Backup Cleanup

## 변경 사항
- 자산 보기 상태(보기 모드/검색어/보기 요약 버킷)를 `setAssetViewFilter()` 단일 함수로 통합, 6곳의 분산된 직접 대입을 모두 교체
- Platform Center 검색 상태도 `setPlatformSearch()`로 통합
- **버그 수정**: 홈 화면에서 기관을 클릭하거나 Platform Center에서 "열기"를 눌러 자산 탭으로 이동할 때, 이전에 설정된 "자산 보기 요약" 버킷 필터(예: 현금/은행)가 지워지지 않아 일부 자산이 목록에서 누락되어 보이던 문제 수정

## 데이터 저장 구조 영향
없음 — `state.settings`의 필드명/구조는 그대로이며, 값을 쓰는 경로만 함수로 모았습니다. localStorage 키/스키마 변경 없음.

## 모바일/PC 영향
없음 — 로직만 변경, DOM/CSS 변경 없음.

## 확인했지만 이번엔 손대지 않은 항목
- 다크모드 선택자 3중 구조(html.dark / body.dark / [data-theme="dark"])는 미해결 — 별도 작업으로 분리 권장
