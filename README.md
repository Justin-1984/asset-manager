# AssetManager PWA v6.16.9 Stable Cleanup

기준: v6.16.8 Reports UX Cleanup

## 변경 사항
- 앱 표기 버전을 v6.16.9로 정리
- 백업 다운로드 파일명을 v6.16.9 기준으로 수정
- Reports 히어로 문구를 Reports UX Cleanup 기준으로 정리
- 총 투자손익 계산 대상을 투자자산으로 제한
  - 포함: 코인, 주식, ETF, 금
  - 제외: 현금, 은행, 자동차, 부동산 등 비투자/실물 자산
- Service Worker 캐시명을 v6.16.9로 갱신

## 회귀 방지
- localStorage 키 변경 없음
- 자산/부채/보험/거래/스냅샷 데이터 구조 변경 없음
- 시세/환율 엔진 변경 없음
- Platform Center / View Engine 구조 변경 없음

## 배포 메모
- 기존 v6.16.8에서 바로 덮어쓰기 가능
- 적용 후 페이지 새로고침 또는 강제 업데이트로 캐시 갱신 권장
