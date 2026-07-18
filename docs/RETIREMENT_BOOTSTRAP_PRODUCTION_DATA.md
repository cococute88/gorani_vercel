# 장기 지속 가능성 production 시장 패턴 데이터

## 결론과 범위

이 문서는 PR #211의 5년 블록 부트스트랩 엔진에 연결한 production 데이터셋, 출처·라이선스, 정규화 정책과 2026-07-18 검증 결과를 기록한다. 신규 성공률은 아직 production UI에 노출하지 않는다. 기존 Good·Normal·Bad 계산과 시뮬레이터 UI는 변경하지 않았다.

기존 구현이 production 결과를 만들 수 없었던 직접 원인은 `MarketPatternDataAdapter` 계약만 있고 실제 production 구현체와 승인된 장기 데이터 artifact가 없었기 때문이다. synthetic fixture는 의도적으로 production fallback이 차단되어 있었다. 이번 작업은 fallback을 완화하지 않고 versioned production artifact와 checksum 검증 adapter를 추가했다.

## 출처 비교와 선택

| 후보 | 지원 기간·자산군 | 라이선스·repository 정책 | runtime·갱신 | 판단 |
| --- | --- | --- | --- | --- |
| Kenneth French Data Library | 1927~2025, 대형 성장·가치 및 ex-dividend 포트폴리오 | 페이지가 Fama/French 저작권을 표시하고 원천이 CRSP이다. 명시적 재배포 허가 없이 repository 저장하지 않는다. | 다운로드 갱신은 가능하나 production 재사용 권리가 불명확하다. | 제외 |
| FRED 시장지수 + CPI | 장기 시장지수·CPI | FRED도 제3자 series 저작권은 별도라고 명시한다. BLS CPI만 공공 도메인이다. | 시장 series별 원 권리자 허가가 필요하다. | 시장 제외, CPI는 BLS 직접 사용 |
| Nasdaq·S&P·Yahoo 직접 데이터 | 장기 지수·ETF | 재배포 제한 또는 조건이 명확하지 않다. 별도 라이선스 계약 없이 고정 저장하지 않는다. | API/웹 갱신 가능 여부와 재배포 권리는 별개다. | 제외 |
| Wikimedia 연간 수익 표 + BLS CPI-U | 1971~2025 공통 55년, 세 가지 장기 proxy와 CPI | Wikimedia 표의 변형 데이터는 CC BY-SA 4.0 표시·동일조건으로 저장한다. BLS 발표물은 공공 도메인이다. | 고정 revision과 BLS API로 재생성해 versioned JSON을 저장한다. runtime 외부 호출은 없다. | 채택 |

라이선스 근거:

- Wikimedia Foundation의 [CC BY-SA 4.0 안내](https://foundation.wikimedia.org/wiki/Legal%3AText_of_the_Creative_Commons_Attribution-ShareAlike_4.0_International_License)
- [BLS Copyright Information](https://www.bls.gov/opub/copyright-information.htm): BLS 발표물은 예외 사진·삽화를 제외하고 public domain
- [FRED Terms of Use](https://fred.stlouisfed.org/legal/terms/): 제3자 저작권 series는 원 제공자 허가가 필요
- [Kenneth French Data Library](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/Data_Library.html): CRSP 기반과 Fama/French 저작권 표시

CC BY-SA 적용 대상은 Wikimedia 표를 정규화한 시장 수익 데이터와 해당 adaptation이다. 출처·고정 revision·변경 사실·라이선스 URL은 JSON metadata에 유지한다. BLS CPI-U는 공공 도메인 attribution을 함께 기록한다.

## production 데이터셋

- `schemaVersion`: `1`
- `datasetId`: `gorani-us-asset-class-market-patterns`
- `datasetVersion`: `2026.07.18-wikimedia-bls-v1`
- `updatedAt`: `2026-07-18T00:00:00.000Z`
- 기간: 1971~2025
- 연도 관측 수: 55
- overlapping 5년 블록 수: `55 - 5 + 1 = 51`
- 관측 checksum: `SHA-256 92eceb9916804da120ef17e0dae5627cd82c2d79e272975e25fdb6887bb78ae1`
- 저장 정책: UTF-8 JSON을 repository에 고정 저장하고 production runtime은 외부 API 없이 이 artifact만 읽는다.
- 갱신 정책: source revision과 BLS 연평균을 검토한 뒤 생성기 상수, `datasetVersion`, `updatedAt`을 함께 올리고 전체 검증을 다시 실행한다. 자동 무심사 갱신은 하지 않는다.

각 source에는 `sourceId`, 이름, URL, 역할, 라이선스·URL, 조회 시각, revision 설명과 정규화 series SHA-256이 있다. 전체 데이터에는 자산군별 proxy·반환형·총수익 처리·배당성장 처리 방법과 관측 행 SHA-256이 있다.

연도 관측 행은 다음을 하나의 원자적 행으로 보존한다.

```text
year
inflationPct
assetClasses.us_large_cap.priceReturnPct / totalReturnPct
assetClasses.us_large_growth.priceReturnPct / totalReturnPct
assetClasses.us_dividend_value.priceReturnPct / totalReturnPct
```

블록 sampler는 행 index 하나를 이동하므로 같은 연도의 세 자산군과 CPI가 분리되지 않는다. 결측 연도, 중복 연도, 비연속 연도, 필수 자산군 누락, `-100%` 이하 값은 오류다. production adapter는 schema 검증 후 `JSON.stringify(observations)`의 SHA-256까지 일치해야 반환한다. synthetic fixture로 fallback하지 않는다.

## 자산군과 ETF 매핑

| ETF | 자산군 | 장기 pattern proxy | 분배 정책 |
| --- | --- | --- | --- |
| SPY | `us_large_cap` | S&P 500 | `standard_dividend` |
| QQQ | `us_large_growth` | Nasdaq Composite 성장 성향 proxy | `standard_dividend` |
| SCHD | `us_dividend_value` | DJIA 우량·가치 성향 proxy | `standard_dividend` |
| JEPQ | `us_large_growth` | Nasdaq Composite 성장 성향 proxy | `income_strategy`, 기본 배수 1.0 |

Nasdaq Composite는 대형 성장 style index 자체가 아니고 DJIA도 dividend/value style index 자체가 아니다. 두 series는 1970년대 고인플레이션부터 dot-com, 금융위기, 코로나 급락·회복과 2022년 인플레이션 국면까지 포함하는 재배포 가능한 장기 성향 proxy다. 후속에 명시적 상용 재배포 라이선스를 확보하면 같은 schema와 자산군 ID를 유지한 채 더 정밀한 style index로 교체할 수 있다.

승인되지 않은 ETF는 자동 유추하지 않고 명시적 오류를 반환한다. JEPQ의 2022년 이후 실제 역사는 bootstrap 원본이 아니며, QQQ/Nasdaq의 절대 수익을 JEPQ 수익으로 표시하지 않는다.

## 가격수익·총수익·배당 정책

- S&P 500 표는 가격수익과 배당 재투자 총수익을 분리한다. 절세계좌 총수익 CAGR pattern에는 총수익 편차를, 위탁 가격에는 가격수익 편차를 쓴다.
- Nasdaq Composite와 DJIA 표는 가격수익만 제공한다. schema의 `totalReturnPct`에는 같은 가격 pattern을 두되 `price_return_proxy`와 `price_pattern_recentered_to_user_total_return_cagr`를 metadata에 명시한다. 역사 배당을 추정하거나 추가하지 않는다.
- 절세계좌에는 별도 배당 현금흐름이 없으므로 총수익 pattern과 배당이 중복되지 않는다.
- 위탁계좌 평가잔고에는 항상 `priceReturnPct`만 적용한다. 배당은 최초 투자액 × 사용자 배당률로 시작해 사용자 배당성장률로만 움직이며 가격잔고에서 차감하거나 재투자하지 않는다.
- production 데이터에는 완결된 배당성장 series가 없으므로 `dividendGrowthPct`를 만들지 않았다. 사용자 배당성장률 중심 정책을 그대로 유지한다.
- 근거 있는 자산군 분배 stress가 없으므로 JEPQ 포함 모든 production 기본 지급 배수는 1.0이다.

## 사용자 중심값 결합

역사 series의 연간 gross return을 log로 바꿔 역사 기하평균 대비 편차만 계산한다. 이 편차를 사용자 CAGR의 log 중심으로 이동하고, 안전 범위 clipping이 발생하면 이분법으로 중심을 다시 맞춘다. 따라서 역사 평균은 사용자 CAGR을 덮어쓰지 않는다. CPI도 같은 방식으로 사용자 기대 인플레이션 중심에 역사 순서 편차만 적용한다.

대표 검증 입력은 실제 사용자 결과가 아닌 테스트 목적이다.

- 초기 ISA 5,000, 연금 10,000, 위탁 15,000
- 기대 인플레이션 3%, 인출률 3.5%, 인출 증가율 2%, 1년 차부터 인출
- 시작 구매력 기준 연간 필수 세후 인출 600
- 절세계좌: QQQ 50%/총수익 CAGR 8%, SPY 50%/7%
- 위탁: SCHD 90%/가격 CAGR 4%/배당률 3.2%/배당성장 5%, JEPQ 10%/2%/9%/1%
- block length 5, 기간 checkpoint 30·40·50·60·70년

## 재중심화 진단

| series | 관측 | 목표 CAGR | 결과 기하평균 | clipping | 비율 | log 표준편차 전 | 후 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| inflation | 55 | 3% | 3% | 0 | 0% | 0.026546 | 0.026546 |
| QQQ tax total-return pattern | 55 | 8% | 8% | 0 | 0% | 0.242080 | 0.242080 |
| SPY tax total-return pattern | 55 | 7% | 7% | 0 | 0% | 0.165385 | 0.165385 |
| SCHD brokerage price pattern | 55 | 4% | 4% | 0 | 0% | 0.148082 | 0.148082 |
| JEPQ brokerage price pattern | 55 | 2% | 2% | 0 | 0% | 0.242080 | 0.242080 |

실데이터 대표 가정에서 clipping은 한 건도 없고 변동성 압축도 없다.

## 10,000회 대표 결과와 seed 비교

| seed | 기간 | 성공률 | 실질원금 50% 이하 | 실질원금 25% 이하 |
| ---: | ---: | ---: | ---: | ---: |
| 730401 | 30년 | 93.27% | 27.67% | 7.82% |
| 730401 | 40년 | 92.61% | 31.72% | 10.86% |
| 730401 | 50년 | 91.51% | 35.44% | 14.13% |
| 730401 | 60년 | 91.01% | 38.21% | 16.63% |
| 730401 | 70년 | 90.74% | 40.01% | 18.54% |
| 730402 | 30년 | 93.76% | 27.51% | 7.67% |
| 730402 | 40년 | 93.00% | 32.08% | 10.63% |
| 730402 | 50년 | 92.02% | 36.02% | 13.69% |
| 730402 | 60년 | 91.36% | 38.96% | 16.34% |
| 730402 | 70년 | 91.12% | 40.60% | 18.40% |
| 730403 | 30년 | 93.72% | 26.80% | 7.77% |
| 730403 | 40년 | 92.94% | 31.42% | 10.67% |
| 730403 | 50년 | 92.05% | 34.99% | 14.08% |
| 730403 | 60년 | 91.51% | 37.66% | 16.60% |
| 730403 | 70년 | 91.34% | 39.66% | 18.42% |

성공률은 기간 증가에 따라 상승하지 않고, 원금 임계값 도달 누적확률은 기간과 함께 증가한다. 모든 기간이 0% 또는 100%인 병리 결과가 아니다. 대형주와 성장 proxy의 연도 series는 동일하지 않다. 기대 인플레이션만 3%에서 5%로 높인 30년 2,000회 민감도에서는 성공률이 92.90%에서 61.90%로 내려가 인플레이션이 실제 결과에 반영됨을 확인했다.

동일 dataset·입력·seed의 10,000회 결과는 객체 전체가 완전히 동일했다. seed 변경 시 분포가 달라졌다. seed 730401의 10,000회와 같은 seed 50,000회 기준 차이는 다음과 같다.

| 기간 | 성공률 절대차 | 50% 확률 절대차 | 25% 확률 절대차 |
| ---: | ---: | ---: | ---: |
| 30년 | 0.276%p | 0.358%p | 0.036%p |
| 40년 | 0.246%p | 0.682%p | 0.152%p |
| 50년 | 0.306%p | 0.744%p | 0.262%p |
| 60년 | 0.210%p | 0.650%p | 0.262%p |
| 70년 | 0.214%p | 0.582%p | 0.374%p |

모든 주요 확률 차이가 사전 기준 2%p 이내이고 최대 차이는 0.744%p여서 이 대표 입력과 데이터셋에서는 10,000회가 후속 UI 계산에 충분히 안정적이다.

## 성능과 후속 UI 실행 권장

Windows, Node.js v24.16.0에서 production artifact를 미리 검증한 뒤 seed 730401로 측정했다.

| 기간 × 횟수 | 시간 | heap delta |
| --- | ---: | ---: |
| 30년 × 10,000 | 124.56 ms | 2.39 MiB |
| 60년 × 10,000 | 163.63 ms | 1.13 MiB |
| 70년 × 10,000 | 186.94 ms | 1.43 MiB |

계산은 200ms 안팎이지만 동기식 main thread에서 실행하면 화면 입력과 animation을 눈에 띄게 막을 수 있다. 후속 UI의 기본 권장은 Web Worker다. dataset은 고정 정적 artifact이고 계산은 seed 기반 순수 함수이므로 서버·cached API의 네트워크 지연과 운영 비용이 필요하지 않다. 캐시가 필요하면 `datasetVersion + 입력 가정 + iterations + blockLength + seed policy + distributionStressPolicyId`를 key로 하는 브라우저 캐시를 Worker 앞에 둘 수 있다. 서버 실행은 여러 기기에서 동일 계산을 공유해야 하는 요구가 생길 때 검토한다.

결과 계약에는 `datasetVersion`, 데이터 기간, `datasetUpdatedAt`, simulation count, block length, seed와 분배 정책 ID가 있다. 계산 시각 대신 dataset 갱신 시각을 넣어 동일 입력·seed의 완전 재현성을 보존한다.

## 실행과 갱신

```powershell
npm.cmd run build:retirement-bootstrap-production-data
npm.cmd run check:retirement-bootstrap-production-data
npm.cmd run validate:retirement-bootstrap-production
npm.cmd run benchmark:retirement-bootstrap-production
```

생성기는 UTF-8로 JSON을 쓴다. 갱신 PR에서는 새 source revision의 표 구조와 값, BLS 연평균, 라이선스 변경 여부를 사람이 먼저 검토해야 한다. `build:`는 고정 Wikimedia revision과 BLS API를 호출하는 검토·갱신 명령이며 BLS 비인증 API 제한의 영향을 받을 수 있으므로 CI에서 실행하지 않는다. `--check`는 외부 네트워크 없이 repository artifact의 schema, 기간, 고정 revision metadata와 SHA-256을 검증한다.

## 남은 이슈

- 성장·배당가치 proxy의 style 순도가 상용 index보다 낮다. 더 정밀한 style index는 명시적 production 재배포 라이선스를 확보한 뒤 교체한다.
- 이번 결과는 대표 테스트 가정의 검증값이며 사용자 화면에 표시하면 안 된다.
- 후속 UI는 Web Worker, 진행/취소 상태, 입력·datasetVersion cache key와 결과 면책 문구를 별도 설계해야 한다.
- production UI 연결 전 실제 사용자 입력 범위에서 clipping 비율과 극단 잔액 overflow를 추가 관찰하는 것이 좋다.
