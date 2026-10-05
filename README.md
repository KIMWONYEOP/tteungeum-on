# 뜬금ON V1

뜬금상점 본사·가맹점 통합 점포관리 시스템. Next.js 16 App Router, TypeScript, Tailwind CSS 4, Lucide React 기반 한국어 반응형 서비스입니다.

## 실행 및 검증

Node.js 20.9 이상이 필요하며 이 환경에서는 Node.js 24를 사용합니다.

```bash
npm install
npm run dev

npm run lint
npm run build
npm start
npm test
```

재현 가능한 설치는 `npm ci`를 사용합니다. 클라우드 환경에서 기본 npm 캐시에 쓸 수 없는 경우 `npm install --cache /tmp/tteungeum-npm-cache`를 사용하세요.

브라우저 테스트는 Chromium이 필요합니다. 이 환경의 `/usr/bin/chromium`을 기본으로 사용하며 다른 환경에서는 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`로 실행 파일을 지정하세요. 테스트는 별도 3100 포트에서 프로덕션 서버를 시작하므로 먼저 `npm run build`를 실행해야 합니다.

## 데모 로그인

`/login`에서 본사/점주 데모 로그인 버튼을 사용합니다. 이메일 로그인도 가능합니다.

| 구분 | 이메일 | 데모 비밀번호 |
| --- | --- | --- |
| 본사 관리자 | hq@tteungeum.demo | Demo1234! |
| 점주 | owner@tteungeum.demo | Demo1234! |

이 값은 공개 데모용입니다. 실제 인증이 아니며 민감한 데이터를 입력하지 마세요. 로그인 상태 유지는 localStorage, 미선택 시 sessionStorage를 사용합니다. 로그아웃해도 데모 업무 데이터는 유지됩니다. 업무 데이터를 처음부터 보려면 브라우저 localStorage의 `tteungeum-on-v1-data` 키만 제거하고 새로고침하세요.

## 화면

- `/login`: 데모 로그인, 계정 입력, 로그인 상태 유지, 비밀번호 찾기 안내
- `/hq`: 본사 대시보드
- `/hq/stores`, `/hq/sales`, `/hq/products`, `/hq/inventory`, `/hq/orders`, `/hq/settlements`, `/hq/notices`, `/hq/support`
- `/store`: 점주 대시보드 및 동적 운영 브리핑
- `/store/sales`, `/store/inventory`, `/store/inventory/[productId]`
- `/store/reorder`, `/store/orders/new`, `/store/orders`, `/store/orders/[orderId]`
- `/store/settlements`, `/store/ai`, `/store/notices`, `/store/support`, `/store/notifications`
- `/store/more`, `/store/settings`, `/store/help`
- `/hq/orders/[orderId]`: 본사 승인·준비·출고·배송완료·취소

## 데이터 및 서비스 구조

- `src/types/domain.ts`: Role, profiles, stores, store_members, suppliers, products, store_inventory, inventory_transactions, sales, sale_items, purchase_orders, purchase_order_items, settlements, settlement_items, notices, support_tickets, notifications, audit_logs에 대응하는 도메인 타입
- `src/data/mock.ts`: 상품 32개, 매장 5개, 매장별 재고, 60일 매출 및 판매항목, 발주 8건, 3개월 정산, 공지 3개, 문의 5개, 알림 10개. 60일 매출로 최근 30일과 직전 30일을 비교합니다. 생성일은 한국 시간 기준입니다.
- `src/services/service.ts`: `AppService` 인터페이스와 브라우저 저장소 Mock 구현. 인증, 장바구니, 발주, 재고, 상품, 공지, 문의, 알림 변경과 감사로그를 관리합니다.
- `src/services/ai.ts`: 외부 API 없는 규칙 기반 매장 운영 비서
- `src/lib/calculations.ts`: 매출 집계, 재고 상태, 자동발주, 정산 계산
- `src/components/provider.tsx`: 서비스 결과를 UI에 제공하고 변경 요청을 순차 처리
- `src/components/`: 공통 UI 및 기능별 화면

UI는 서비스에서 받은 데이터를 표시합니다. 실제 저장소 전환은 `AppService` 구현 및 provider 연동 지점에서 수행합니다. 차트는 반응형 SVG로 구현했고 데이터 목록과 접근성 설명을 함께 제공합니다.

## 자동발주 및 발주 흐름

최근 14일 판매량 / 14 → 일평균판매. 배송 소요일 수요 + 안전재고 − 현재재고 − 미입고 발주 수량을 계산하고 0 이하 추천은 제외합니다. 최종 발주 수량은 정수로 올림합니다. 판매량이 0이면 예상소진일을 계산하지 않습니다.

점주 로그인 → 재고위험 → 상품 상세 → 발주하기 → 추천 수량 변경 → 발주담기 → 발주서 → 금액 확인 → 신청 → 승인대기 내역.

같은 브라우저에서 로그아웃 → 본사 로그인 → 발주대기 → 발주 상세 → 승인 → 상품준비 → 출고 → 배송완료. 배송완료 시 재고 입고와 이력·알림을 기록합니다. 완료/취소 발주는 재처리할 수 없고 출고 후에는 취소할 수 없습니다.

모바일 표는 카드로 전환하고 점주 하단 메뉴 공간을 확보했습니다. Playwright로 375px, 768px, 1440px 화면과 업무 흐름을 검증합니다.

## Supabase 연결 전 제한 및 다음 단계

현재는 브라우저 단위 데모로 실제 인증, 서버 저장, 매장 간 실시간 동기화, 결제 및 외부 발주 전송이 없습니다. 매장설정은 조회 화면이며 실제 비밀번호 재설정은 아직 제공하지 않습니다.

1. 도메인 타입을 기준으로 테이블, FK, 인덱스, 감사로그와 정산 항목 마이그레이션 작성
2. Supabase Auth와 profiles/store_members 기반 서버 세션 및 역할·매장 RLS 적용
3. `AppService`를 Supabase 구현으로 교체하고 비동기 조회·오류·페이지네이션 처리
4. 발주신청/상태변경/입고/재고조정을 DB 트랜잭션·원자적 RPC와 멱등성 키로 처리
5. 실제 매출 연동, 서버 일자 집계, 정산 정책과 VAT 기준 확정
6. Realtime 알림, 실제 운영 데이터·권한·동시성 통합 테스트

데모의 클라이언트 권한 가드는 운영 환경의 보안 경계가 아닙니다. Supabase 연결 시 서버 검증과 RLS가 필요합니다.
