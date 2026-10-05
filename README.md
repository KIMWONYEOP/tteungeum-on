# 뜬금ON · Supabase 운영 전환

뜬금상점 본사·가맹점 통합 점포관리 시스템. 기존 Next.js 16 App Router, TypeScript, Tailwind CSS 4, Lucide React의 UI·CSS·URL 구조를 유지하고 서버 인증 및 PostgreSQL 서비스 계층을 추가했습니다.

**현재 저장소의 연결 코드는 구현되어 있습니다. 이 작업 환경에는 실제 Supabase 프로젝트 설정이 없어 원격 migration, 실제 Auth 계정 로그인, Vercel 배포는 아직 검증하지 못했습니다. 아래 설정 후 원격 검증을 완료해야 운영할 수 있습니다.**

## 실행 / 환경변수

Node.js 20.9+ (검증: Node.js 24). `.env.example`을 기준으로 무시되는 `.env.local`에 값을 설정합니다. 실제 값은 Git이나 채팅에 넣지 않습니다.

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npm start
```

운영 필수 환경변수:

- `NEXT_PUBLIC_SUPABASE_URL`: 프로젝트 HTTPS URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key. 구형 프로젝트는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`로 대체 가능
- `APP_DATA_MODE=supabase`

브라우저는 DB에 직접 쓰지 않습니다. Next.js 서버가 publishable/anon key와 **사용자의 JWT**로 접근하여 RLS를 유지합니다. 앱 실행에 service role key는 필요하지 않습니다. 공개 설정에 service role JWT 또는 `sb_secret_` 키를 넣으면 거부합니다.

선택적인 서버 관리 도구만 `SUPABASE_SERVICE_ROLE_KEY`를 사용합니다. 이 값은 `scripts/seed-dev.ts`, `scripts/provision-user.ts`에서만 읽으며 앱·브라우저 번들에 포함하지 않습니다. `NEXT_PUBLIC_` 접두사를 붙이지 마세요.

설정 없이도 production build는 성공하지만 `/login`에 명확한 설정 오류를 표시하며 데이터 쓰기와 보호된 화면 접근은 차단합니다. **Production에서는 데모 로그인이나 가짜 수치로 자동 전환하지 않습니다.**

UI 회귀 확인 전용 개발 모드:

```bash
APP_DATA_MODE=mock npm run dev
```

이 모드는 `next dev`에서만 허용됩니다. 본사·점주 데모와 브라우저 저장소는 개발용으로 남아 있습니다. Production에서 `APP_DATA_MODE=mock`을 지정해도 Supabase 모드가 적용됩니다.

## DB migration

`supabase/migrations`의 네 파일을 순서대로 적용합니다.

1. `202610060001_schema.sql`: 테이블, numeric 금액, FK·CHECK·UNIQUE·기간 중복 제약, 인덱스, 초기 RLS 차단
2. `202610060002_security.sql`: profiles 생성 트리거, 역할·매장 RLS, 감사로그, updated_at
3. `202610060003_transactions.sql`: 매출/취소, 재고조정, 발주/입고, 자동 제안, 정산, 원자적 장바구니 체크아웃
4. `202610060004_management.sql`: 관리 RPC, 한국 시간 매출 집계 및 UI snapshot, 함수별 실행 권한

빈 프로젝트를 위한 추가형 baseline입니다. DROP/TRUNCATE와 기존 데이터 삭제가 없습니다. 동명 테이블이 이미 있는 DB에는 먼저 기존 schema와 비교해야 합니다. 사용자 데이터가 있는 프로젝트를 `db reset`하지 마세요.

Supabase CLI에서 프로젝트를 연결하고 migration 계획을 확인한 뒤 적용합니다. CLI 토큰과 DB 비밀번호는 안전한 환경 설정 또는 CLI의 보안 입력을 사용하세요.

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

원격 연결 정보가 제공되지 않아 위 명령을 원격 프로젝트에 실행하지 않았습니다. PostgreSQL 17 로컬 테스트 DB에서는 네 migration을 모두 실제 적용·검증했습니다.

### 생성하는 테이블 (22개)

`profiles`, `stores`, `store_memberships`, `categories`, `suppliers`, `products`, `store_products`, `inventories`, `inventory_movements`, `sales`, `sale_items`, `purchase_orders`, `purchase_order_items`, `settlements`, `settlement_items`, `notices`, `notice_reads`, `inquiries`, `notifications`, `audit_logs`, `ai_insights`, `order_carts`.

재고는 음수를 허용하지 않고 예약재고보다 적어지는 판매·조정을 거부합니다. SKU·바코드·매장코드·발주번호는 중복을 막습니다. POS 멱등성 키와 external POS ID는 매장 단위로 중복을 막습니다. 취소되지 않은 정산은 동일 매장 내 기간이 겹칠 수 없습니다. 자동확정 발주는 기본 OFF이며 현재 RPC도 `AUTO` 요청을 거부합니다.

## 사용자·역할 준비

Supabase Auth에서 계정을 생성하면 `profiles`가 **STAFF**로 생성됩니다. 사용자 메타데이터에 role을 넣어도 관리자 권한을 얻지 못합니다.

초기 최고관리자/본사/점주 계정 역할은 서버 관리 도구로 명시적으로 설정할 수 있습니다. `ALLOW_USER_PROVISION=true`, `PROVISION_EMAIL`, `PROVISION_ROLE`, 신규 계정의 `PROVISION_PASSWORD`를 안전한 서버 환경에 설정한 후 실행합니다. 계정 비밀번호는 12자 이상이며 출력하지 않습니다.

```bash
npm run provision:user
```

역할: `SUPER_ADMIN`, `HQ_ADMIN`, `STORE_OWNER`, `STORE_MANAGER`, `STAFF`. 운영 DB에는 `HQ_MANAGER`를 사용하지 않습니다. 구형 UI의 HQ_MANAGER는 개발 Mock 호환만 유지합니다.

- 본사 계정 로그인 → `/hq`
- 점포 계정 로그인 → `/store`
- 본사 매장관리에서 실제 매장을 등록하고 Auth 계정과 연결합니다.
- 점포 계정은 활성 store_memberships가 있어야 로그인할 수 있습니다. 시스템 역할과 매장 역할을 모두 검사합니다. STAFF는 판매 기록·조회만 허용되고 재고 수동조정·발주·정산 관리 권한이 없습니다.
- 여러 매장이 배정된 계정은 헤더에서 해당 매장만 선택할 수 있습니다.

새 운영 DB의 분류·공급사는 `/hq/products`의 **기준정보**에서 실제 정보로 등록하세요. 데모 상품·매장·계정을 자동으로 넣지 않습니다.

## Seed (분리된 개발 프로젝트 전용)

`supabase/config.toml`에서 자동 seed는 꺼져 있습니다. Production에는 seed를 실행하지 않습니다.

별도의 개발 프로젝트에서만 `ALLOW_DEVELOPMENT_SEED=true`, `SUPABASE_DEV_PROJECT_URL`(접속 URL과 동일한 개발 주소), `SEED_USER_PASSWORD`(12자 이상), 서버 관리 키를 설정하고 실행합니다.

```bash
npm run seed:dev
```

본사·점주 테스트 계정, 5개 매장, 32개 상품, 재고, 60일 매출, 발주, 3개월 정산, 공지·문의·알림을 준비합니다. 반복 실행은 지정된 개발 fixture를 upsert하며 기존 재고는 재설정하지 않습니다. NODE_ENV 또는 VERCEL_ENV가 production이거나 명시적 개발 허용이 없으면 실행을 거부합니다. 실제 seed는 원격 개발 프로젝트가 없어 아직 실행하지 않았습니다.

## 화면과 서비스 연결

현재 URL을 유지합니다: `/login`, `/hq`, `/hq/stores`, `/hq/sales`, `/hq/products`, `/hq/inventory`, `/hq/orders`, `/hq/settlements`, `/hq/notices`, `/hq/support`, `/store` 및 기존 점주 하위 경로. 본사 알림은 `/hq/notifications`도 지원합니다.

- `src/lib/supabase/server.ts`, `src/proxy.ts`: HttpOnly·Secure 운영 쿠키, Supabase 토큰 갱신
- `src/server/auth.ts`: Auth 서버 검증, profiles.active/role 및 매장 멤버십 검사
- `src/server/schemas.ts`, `http.ts`, `commands.ts`: Zod 입력·출처·권한 검증, 제한된 RPC 호출
- `src/repositories/workspace.ts`: 실제 DB 결과를 기존 UI 타입으로 변환하는 순수 호환 계층
- `src/services/supabase-service.ts`: 서버 API를 사용하는 AppService 구현
- `src/services/mock-service.ts`, `src/data/mock.ts`: 명시적인 개발 모드용. 운영 데이터 조회에 사용하지 않음
- `src/services/settlement-policy.ts`: 계약별 검토 비용 정책 교체 경계
- `src/services/ai.ts`: 운영 데이터 기반 규칙 분석 및 AI 서비스 인터페이스. 발주를 확정하지 않고 외부 API key 없이 동작

대시보드·매출·상품·재고·발주·정산·공지·문의·알림 모두 Supabase 서비스 경로에 연결되어 있습니다. 실제 원격 연결이 확인된 화면은 아직 없습니다. 매출은 DB에서 한국 날짜/시간대별로 집계하고 실제 판매 transaction 수를 사용합니다. 최근 30일 비교를 위한 기본 조회는 62일이며 사용자 지정 기간은 이전 동일 기간 비교를 포함해 최대 183일입니다.

세션 만료 시 로그인으로 이동합니다. 전체 화면에 Realtime을 연결하지 않았으며 변경 후 조회와 창 재활성화 시 조회를 사용합니다. 향후 재고·발주·알림에만 구독을 추가할 수 있습니다.

## 업무 API

모든 API는 현재 사용자 쿠키를 검증합니다. 외부 POS에는 해당 사용자 Supabase access token을 `Authorization: Bearer …`로 전달할 수 있습니다. service role 토큰을 POS에 사용하지 마세요. 외부 POS 별도의 기기 발급·연동 계약은 아직 필요합니다.

- `GET /api/workspace`: RLS가 적용된 실제 조회. 임의 storeId 요청은 서버에서도 검증
- `POST /api/sales`: storeId, idempotencyKey, externalPosId(선택), soldAt(타임존 포함), paymentMethod, items[{productId,quantity,unitPrice?,discountAmount?}]. 판매 생성과 재고 차감 원자적 처리
- `POST /api/sales/cancel`: saleId. 권한 검증 후 재고복원 및 중복 취소 안전 처리
- `POST /api/commands`: 상품·매장·계정 연결·재고·발주·공지·문의·알림 변경. 브라우저가 보낸 금액이나 권한으로 발주를 확정하지 않음
- `POST /api/orders/suggest`: key. 안전재고 이하이며 진행중 발주가 없는 상품만 AUTO_SUGGESTED 제안 생성
- `POST /api/settlements`: generateSettlement 또는 updateSettlement. 본사만 실행

발주 상태: REQUESTED → APPROVED → ORDERED → SHIPPED → RECEIVED. 기존 UI 호환을 위해 ORDERED는 상품준비, RECEIVED는 배송완료로 표시합니다. 수령 수량과 입고 movement를 동일 transaction으로 갱신하며 재입고를 거부합니다. 외부 공급사 전송은 아직 연결하지 않았습니다.

정산은 초안으로 생성하며 본사에서 정책을 검토합니다. 현재 정책은 할인 반영 매출 − 환불 − 공급비용 − 가맹수수료 − 플랫폼비 − 기타비용 + 조정금액입니다. 할인은 매출에서 이미 반영되어 이중 차감하지 않습니다. 확정 후 변경도 before/after 감사로그에 저장하며 지급완료 정산은 수정하지 않습니다. 실제 계약 수수료·VAT·환불 처리 기준 확정은 운영 전 필수입니다.

## 테스트

```bash
npm run lint
npm run typecheck
npm run build
npm test
npm run test:production
```

`npm test`는 `/usr/bin/chromium` 또는 PLAYWRIGHT_CHROMIUM_EXECUTABLE을 사용하고 별도 개발 서버(3100, 명시적 Mock 모드)를 시작합니다. 기존 로그인/발주/재고/상품/문의 흐름과 375/768/1440px UI 회귀를 검사합니다. 같은 checkout에 다른 next dev 서버가 있으면 먼저 그 서버를 종료하세요.

`npm run test:production`은 빌드된 서버(3200)에서 환경변수 누락 처리, 데모 fallback 차단, 보호된 화면 리다이렉트, 쓰기 차단을 확인합니다.

로컬 PostgreSQL 통합 검사:

```bash
docker run -d --name tteungeum-db-test -e POSTGRES_PASSWORD=local_test_only -p 127.0.0.1:55432:5432 postgres:17
npm run test:db
# 로컬 검사 종료 후 해당 컨테이너만 정리
docker rm -f tteungeum-db-test
```

이 DB 비밀번호는 격리된 로컬 테스트 값입니다. 테스트는 로컬 호스트만 허용하고 매번 생성한 테스트 DB만 정리합니다. PostgreSQL의 실제 RLS·row lock·FK·constraint·transaction을 검증하지만 Supabase의 실제 Auth 네트워크는 대체 fixture로 분리되어 있습니다. 원격 Auth 로그인 검증을 대신하지 않습니다.

검증 결과: `npm run lint`, `npm run typecheck`, `npm run build` 성공. 기존 UI/Mock 회귀 9개, 로컬 PostgreSQL 업무·RLS 통합 검사 19개, 운영 설정 누락·보호된 경로·데모 비노출 검사 통과. 매출 집계의 한국 자정 경계·판매건수·상품별 수량/금액·시간대도 검사했습니다. 실제 Supabase 본사/점주 로그인과 Vercel 운영 배포는 미검증입니다.

## Vercel 적용 / 남은 작업

Vercel Project → Settings → Environment Variables에서 운영 URL과 publishable/anon key를 등록하고 재배포합니다. APP_DATA_MODE는 supabase로 지정합니다. 앱 실행용 service role key는 등록할 필요가 없습니다. Supabase Auth에서 실제 서비스 URL `https://tteungeum-on.vercel.app`을 설정하고 운영 계정·메일 정책을 관리하세요.

운영 전 실행 순서:

1. 실제 Supabase 프로젝트 정보·공개 설정을 연결하고 migration을 확인·적용
2. 초기 본사 계정 생성·역할 지정, 실제 매장과 점주 계정 멤버십 연결
3. 실제 분류·공급사·상품·초기재고 입력 (운영 seed 금지)
4. 본사/점주 실제 로그인 및 타 매장 차단, 상품·재고·매출·발주·입고·정산·문의의 원격 통합 검증
5. 계약 정산 정책·POS 기기 인증·환불/VAT·외부 공급사 업무 경계 확정
6. Vercel 운영 환경변수 설정, 검토 후 배포 및 운영 URL 검증

GitHub에 변경사항을 저장하는 작업과 운영 배포는 별도입니다. 이 구현 작업에서 Vercel Production 배포는 실행하지 않았습니다. 원격 프로젝트와 계정 없이 운영 준비 완료라고 판단하지 않습니다.
