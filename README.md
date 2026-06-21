# 자산 매니저 v4.4.1

## 변경 사항
- 미국주식 Worker URL 입력칸 복구/고정
- SCHD Worker 테스트 버튼 추가
- Worker 오류 메시지 상세화
  - Worker URL이 자산매니저 주소인지 확인
  - JSON 응답 여부 확인
  - Worker 내부 오류 표시
- USDT/KRW 자동환율을 USD/KRW와 동일하게 사용하도록 변경
- 기존 v4.4 미국주식 Worker 방식, 코인 자동시세, 상태판, 백업 로그 유지

## 설정 방법
1. 설정 탭
2. 미국주식 시세 Worker URL 입력
   https://asset-manager-market-worker.questionbox00.workers.dev
3. 수동 환율/목표/시세 Worker/자동백업 저장
4. SCHD Worker 테스트
5. 전체 시세 갱신

## 업데이트 확인 주소
https://justin-1984.github.io/asset-manager/?v=441
