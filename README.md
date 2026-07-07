# AssetManager PWA v6.18.4 Account Layer

기준: v6.18.3 Stable Candidate

## 변경 사항
- 기관과 계좌를 분리했습니다.
  - 기관: 미래에셋증권, 바이낸스, 국민은행, HSBC 등
  - 계좌/지갑: 일반계좌, ISA, 연금저축, IRP, Spot, Earn, 외화통장 등
- 자산 추가/수정 화면에 `계좌 / 지갑 구분` 입력을 추가했습니다.
- 자산 카드에는 `기관 · 계좌` 형식으로 표시합니다.
- Platform Center는 기존처럼 기관 기준으로 묶고, 내부 자산/보유내역에서 계좌를 구분합니다.
- 자산 검색/플랫폼 검색에서 계좌명도 검색됩니다.

## 데이터 저장 구조 영향
- 기존 데이터는 유지됩니다.
- 새 필드 `accountName`이 추가됩니다.
- 계좌명이 없는 기존 자산은 화면에서 자동으로 `기본계좌`처럼 처리됩니다.
- localStorage 키는 그대로 `assetManagerPWA_v6`를 사용합니다.

## 확인
- JS 문법 검사 통과
- Service Worker 캐시명 v6.18.4 반영
- 백업 파일명은 APP_VERSION 기반 자동 생성 유지
