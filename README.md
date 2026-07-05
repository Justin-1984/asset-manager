# AssetManager PWA v6.16.10 Institution Icons Safe Cleanup

기준: v6.16.9 Stable Cleanup + Institution Icons

## 변경 사항
- 기관/거래소/은행 아이콘 매핑 확장 유지
- 자산카드·섹션요약·Platform Center·홈 리스트 아이콘 색상 규칙 통합 유지
- v6.16.9 Stable Cleanup에서 고친 백업 파일명 회귀 수정
- Reports 투자손익 계산 대상을 투자자산으로 재제한
  - 포함: 코인, 주식, ETF, 금
  - 제외: 현금, 은행, 자동차, 부동산 등 비투자/실물 자산
- Reports 히어로 문구를 UX Cleanup 기준으로 복구
- Service Worker 캐시명을 v6.16.10으로 갱신

## 회귀 방지
- localStorage 키 변경 없음
- 자산/부채/보험/거래/스냅샷 데이터 구조 변경 없음
- 시세/환율 엔진 변경 없음
- Platform Center / View Engine 구조 변경 없음

## 배포 메모
- 기존 v6.16.9에서 바로 덮어쓰기 가능
- 적용 후 페이지 새로고침 또는 강제 업데이트로 캐시 갱신 권장
