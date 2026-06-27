# Asset Manager PWA v6.2 Dark Mode Fix

## 변경 내용
- 설정 탭 다크모드/라이트모드 전환 복구
- 선택한 화면 모드 LocalStorage 저장
- 다크모드 카드/입력칸/버튼/로그 색상 보정
- 자산 입력칸에 작은 이름표 추가
- 부채 입력칸에 작은 이름표 추가
- 보험 입력칸에 작은 이름표 추가
- 수정 모드에서도 어떤 값을 입력하는지 바로 확인 가능
- v6.1 자산/부채/보험 수정 기능 유지
- v6.0 분석 엔진 유지
- 기존 LocalStorage 데이터 호환 유지
- 백업/복원 유지
- 캐시 버전 v6.2로 갱신

## 포함 파일
- index.html
- app.js
- styles.css
- manifest.json
- sw.js
- README.md

## 업데이트 후 권장 작업
1. GitHub Pages에 6개 파일 업로드
2. iPhone/iPad에서 설정 > 캐시삭제 실행
3. 앱 완전 종료 후 재실행
4. 자산/부채/보험 수정 화면에서 이름표 확인


## v6.2 다크모드 버튼 수정
- iOS PWA/Safari에서 ID 전역변수 의존으로 버튼이 먹통 되는 문제 수정
- addEventListener 방식으로 다크모드 버튼 안정화
- body/html/data-theme 동시 적용으로 다크모드 반영 안정화
- 캐시명 갱신
