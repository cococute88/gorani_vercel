# 장기 지속 가능성 분석 V2 방법론

## 성공률 계약

- `sustainabilitySuccessRate85`: 인출 시작 이후 모든 인출연도에서 세후 생활비 충족률이 85% 이상이고 checkpoint 종료 전에 자산이 고갈되지 않은 경로 비율이다.
- 세후 생활비 충족률은 `suppliedAfterTaxCashflow / requiredAfterTaxCashflow`로 계산한다.
- 정확히 85%는 성공이며 85% 미만은 실패다. machine-scale 부동소수점 처리도 threshold 자체를 낮추지 않는다.
- `fullFundingSuccessRate100`: 모든 인출연도의 목표 세후 생활비를 100% 충족하고 미고갈인 기존 V1 성공 계약이다.
- deprecated `successRate`는 backward compatibility를 위해 `fullFundingSuccessRate100`과 같은 100% 의미를 유지한다. UI는 명시적인 V2 필드를 사용한다.

## 최종 실질자산 보존 분포

분모는 경로별 실제 첫 인출 적용 직전 총 실질자산이다. 인출 전 축적기간이 있으면 시뮬레이션 최초 자산을 사용하지 않는다. checkpoint 종료 실질자산을 이 분모로 나누고 다음 상호배타 bucket에 넣는다.

- 100% 이상
- 80% 이상~100% 미만
- 50% 이상~80% 미만
- 25% 이상~50% 미만
- 25% 미만

자산 고갈 경로는 25% 미만에 포함된다. 다섯 count의 합은 분모 경로 수와 같고, rounding 전 확률 합계는 1이다.

## 분석 범위

`analysisScope`는 `tax`·`brokerage`·`combined` 중 하나이며 기본값은 기존 계약인 `combined`다.

- `tax`: ISA·연금 자산, 해당 계좌의 세후 인출, 해당 범위의 시작·종료 실질자산만 성공·생활비·자산 지표에 사용한다. 위탁 배당과 위탁자산은 제외한다.
- `brokerage`: 위탁계좌 자산과 세후 배당·분배 현금흐름만 사용한다. ISA·연금 자산과 인출은 제외한다.
- `combined`: ISA·연금·위탁자산, 절세계좌 세후 인출과 위탁 세후 배당을 모두 사용하며 PR #217의 기존 종합 계약과 같다.

기간 중 50%·25% 도달률과 최종자산 보존 분포의 numerator·denominator는 모두 같은 scope를 사용한다. scope별 결과 차이가 시장 표본 차이로 생기지 않도록 dataset·사용자 가정이 같으면 seed를 공유하고, cache key와 Worker/result 계약에는 scope를 포함한다.

## 생활비 하방 위험

각 경로·checkpoint에서 인출연도의 최저 생활비 충족률을 구한다. 생활비 MDD는 `min(0, 최저 충족률 - 1)`이다. 금액 표시는 시작 시점 구매력 기준 목표 월생활비에 최저 충족률을 곱한다.

- 최악 경로: 최저 충족률의 절대 최솟값
- 하위 1%·5% 및 중앙값: 충족률을 오름차순 정렬한 nearest-rank percentile

## 실질 세후 배당 현금흐름 위험

위탁계좌의 세후 배당·분배 현금흐름을 누적 인플레이션으로 나눠 시작 시점 구매력으로 환산한다. 경로 내 이전 최고 실질 세후 현금흐름 대비 drawdown의 최솟값이 경로 MDD다. Worker는 동일 10,000개 경로에서 MDD -20%·-30%·-40%·-50%·-60% 이상 발생 확률을 함께 집계한다. `brokerage`와 `combined`에만 적용하며 `tax`에서는 0%가 아닌 해당 없음으로 처리한다.

이 지표는 실제 명목 배당 삭감 확률이 아니다. 현재 production dataset에는 근거 있는 stochastic 명목 dividend cut/stress series가 없으므로 명목 배당 -20%·-30%·-60% 삭감 확률을 생성하지 않는다. 이를 지원하려면 ETF별 시점·통화·세전 현금배당, corporate action, 분배 정책 구분, 결측·생존편향 처리, stress regime과 proxy 연결 규칙을 포함한 별도 versioned 데이터 계약이 필요하다.

## 실행·cache 계약

scope 계약 추가로 결과 schema와 cache policy는 V3로 올린다. fixed-seed 정책은 V1과의 동일 경로 및 scope 간 공정 비교를 위해 유지한다. 선택 scope의 85%·100% 성공, 기존 기간 중 50%·25% 도달, 최종자산 bucket, 생활비 MDD, 적용 가능한 배당 현금흐름 MDD는 Worker의 단일 경로 루프에서 함께 집계하고 개별 10,000개 경로는 UI payload로 보내지 않는다. 이미 계산한 scope 결과는 scope별 메모리 cache에서 재사용한다.
