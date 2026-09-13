# Money Level — Time of Day & Weather Visual References

이 폴더의 이미지는 「곰라니 머니레벨」 Forest의
시간대별 / 날씨별 비주얼 레퍼런스다.

중요:
- 이 PNG 파일들을 runtime 배경으로 그대로 사용하는 것이 아니다.
- 현재 Forest scene 구조, House/Camp asset, Pond/Dock, Spine 캐릭터 구조는 유지한다.
- 각 이미지는 색감, 광원, 하늘, 원경, 수면 반사, 집/랜턴 조명, 날씨 분위기의 목표 기준으로만 사용한다.
- HUD/UI는 시간대/날씨 tint의 영향을 받지 않는다.
- 시간대와 날씨는 서로 독립적인 축으로 합성한다.

예:
- 오후 + 맑음
- 오후 + 흐림
- 오후 + 비
- 밤 + 비
- 밤 + 천둥번개

등이 모두 가능해야 한다.


---

# 1. Time of Day References

## `morning.png`
### 새벽 ~ 아침
**시간: 05:00 이상 ~ 09:00 미만**

목표 분위기:
- 하루가 막 시작되는 느낌
- 새벽빛이 약간 남아 있음
- 차가운 파랑/보라 계열과 따뜻한 일출빛이 함께 존재
- 먼 산과 들판에 약한 안개나 물안개 표현 가능
- 해는 낮은 위치
- 물에 아침빛이 은은하게 반사됨
- 집 창문/랜턴 불빛이 일부 남아 있어도 자연스러움
- 캐릭터는 충분히 식별 가능

핵심:
**차가운 새벽색 + 따뜻한 일출빛**


---

## `am.png`
### 오전
**시간: 09:00 이상 ~ 12:00 미만**

목표 분위기:
- 해가 충분히 떠 있음
- 밝고 산뜻한 오전
- 맑은 파란 하늘
- 따뜻하지만 노란색이 과하지 않은 자연광
- 숲과 잔디의 초록색이 선명함
- 집 내부 조명은 기본적으로 꺼짐
- 창문은 자연광만 보임
- 물은 밝은 파란색
- 전체적으로 깨끗하고 활기찬 느낌

핵심:
**상쾌하고 밝은 오전의 자연광**


---

## `pm.png`
### 오후
**시간: 12:00 이상 ~ 16:00 미만**

목표 분위기:
- 가장 중립적인 기본 Forest 색감
- 밝은 낮
- 해는 충분히 떠 있지만 일부 구름에 가려져 있음
- 직사광선이 지나치게 강하지 않음
- 오전보다 햇빛이 조금 더 부드럽고 따뜻함
- 숲, 집, 꽃, 연못의 원래 색상이 가장 잘 보임
- 집 내부 조명은 꺼짐
- 물은 밝고 선명한 파랑
- 너무 어둡거나 회색빛이 돌면 안 됨

핵심:
**밝고 편안한 한낮~오후의 기본 Forest**


---

## `evening.png`
### 저녁 / Golden Hour
**시간: 16:00 이상 ~ 19:00 미만**

목표 분위기:
- 시간대 변화가 한눈에 느껴져야 함
- 확실한 주황빛 / 복숭아빛 / 분홍빛 노을
- 하늘은 warm orange → pink → mauve 계열
- 숲과 잔디에도 golden-hour 빛이 들어옴
- 물 표면에 주황색/금빛 하늘 반사가 명확히 보임
- 먼 산과 원경에도 노을빛이 들어감
- 집 창문, 랜턴, 캠프파이어의 따뜻한 빛이 강조되기 시작
- 단순히 전체 화면을 어둡게 하거나 회색 필터를 씌우는 방식은 금지
- 초록색과 꽃 색상은 살아 있어야 함

핵심:
**누가 봐도 저녁이라고 느껴지는 노을 + 황금빛 수면 반사**


---

## `night.png`
### 밤
**시간: 19:00 이상 ~ 다음날 05:00 미만**

목표 분위기:
- 명확한 한밤중
- 하늘은 짙은 파랑 → 보라 → 거의 검정
- 달과 별 표현 가능
- 숲 전체는 deep blue / teal 계열
- 먼 산과 나무도 밤이라는 것이 확실히 느껴져야 함
- 연못에는 달빛이나 집/랜턴 불빛이 반사될 수 있음
- 집 창문과 랜턴은 따뜻한 주황빛으로 켜짐
- 캠프파이어도 주변을 따뜻하게 비춤
- 고라니와 다람쥐는 충분히 식별 가능
- 화면 전체가 너무 검어서 디테일이 사라지면 안 됨

핵심:
**푸른 밤 + 따뜻한 생활 조명의 대비**


---

# 2. Time Mapping

시간대 판정은 다음과 같이 고정한다.

| 시간 | 상태 | Reference |
|---|---|---|
| 05:00 ≤ time < 09:00 | Morning / Dawn | `morning.png` |
| 09:00 ≤ time < 12:00 | AM | `am.png` |
| 12:00 ≤ time < 16:00 | PM / Day | `pm.png` |
| 16:00 ≤ time < 19:00 | Evening | `evening.png` |
| 19:00 ≤ time < 24:00 | Night | `night.png` |
| 00:00 ≤ time < 05:00 | Night | `night.png` |

경계 시간은 중복되지 않게 위 규칙을 그대로 사용한다.


---

# 3. Weather References

날씨 이미지는 시간대 자체를 대체하지 않는다.

즉:
- `cloudy.png`
- `rain.png`
- `storm.png`

는 기본 시간대 위에 얹는 **날씨 분위기 기준**이다.

예:
- `pm.png` + `cloudy.png`
- `evening.png` + `rain.png`
- `night.png` + `storm.png`

처럼 합성되는 개념이다.


---

## `cloudy.png`
### 흐림 + 약한 바람

목표 분위기:
- 하늘은 회청색 구름
- 밝기는 완전히 죽이지 않음
- 비는 내리지 않음
- 채도는 맑은 날보다 약간 낮음
- 숲과 꽃, 집 색은 여전히 읽힘
- 너무 우중충하거나 비 오기 직전 폭풍처럼 만들지 않음

핵심:
**밝은 흐린 날 + 살짝 바람이 부는 느낌**


### Cloudy Wind FX

흐림 상태에서는 정적인 색감만 쓰지 않고
아주 가벼운 바람 연출을 추가한다.

권장:

- 작은 나뭇잎 particle 4~8개 정도
- 계속 우수수 날리지 않음
- 몇 초에 한 번 1~3장 정도
- 화면을 사선으로 천천히 통과
- 크기/회전/속도 랜덤
- 초록/연두/노랑 계열 잎 2~4종

나뭇잎은 Foreground/World FX로 구현하고
기존 background asset 자체를 수정하지 않는다.

나무 자체를 흔드는 애니메이션은 기본 구현에서 제외한다.

이유:
- 현재 나무는 background illustration에 포함됨
- 나무만 흔들려면 수관 분리 또는 warp가 필요함
- 이미지 틈, 젤리처럼 흔들리는 왜곡 가능성이 큼
- 얻는 효과 대비 구현 난이도가 지나치게 높음

따라서:
**나무 흔들림을 직접 구현하지 않고, 날리는 잎으로 바람을 암시한다.**


선택적으로:
- 아주 약한 구름 그림자 이동
- 매우 투명한 wind streak
- 꽃잎 1~2개

정도를 추가할 수 있다.

과도한 particle은 금지.


---

## `rain.png`
### 비

목표 분위기:
- 흐린 날보다 더 어둡고 차가운 tone
- 부드러운 청록/회색 tint
- 명확한 빗줄기
- 젖은 길과 연못의 차가운 색감
- 꽃/집/캐릭터는 여전히 충분히 식별 가능
- 전체 화면을 지나치게 어둡게 하지 않음

핵심:
**잔잔하지만 확실하게 비 오는 숲**


### Rain FX

권장 애니메이션:
- 얇은 사선 빗줄기
- 일정하지 않은 길이/속도
- Rain layer는 `pointer-events: none`
- 연못에 아주 약한 ripple 가능
- 길/데크에 subtle wet sheen 가능

바람은 흐림보다 약간 강해도 되지만,
나뭇잎 particle은 너무 많이 사용하지 않는다.


---

## `storm.png`
### 천둥번개 + 비바람

목표 분위기:
- 비보다 확실히 강한 폭풍
- 더 짙은 회청색 / 남색 계열
- 강한 비
- 바람에 휘날리는 나뭇잎
- 간헐적인 번개
- 집 창문/랜턴/캠프파이어의 따뜻한 빛 대비
- 캐릭터는 여전히 식별 가능

핵심:
**거센 비바람 + 간헐적 번개**


### Storm Wind FX

Cloudy에서 사용하는 leaf particle 시스템을 재사용한다.

단 storm에서는:
- particle 수 증가
- 속도 증가
- 이동 각도 더 크게
- 회전 속도 증가
- 화면을 가로지르는 빈도 증가

예:
- Cloudy: 1~3장씩 가끔
- Storm: 4~10장씩 더 빠르게


필요하면 일부 particle은:
- 작은 잎
- 꽃잎
- 매우 작은 debris

정도로만 사용한다.

과도한 쓰레기/파편 연출은 금지.


### Lightning FX

- 15~30초 정도의 불규칙한 간격
- 아주 짧게 전체 scene 밝기 증가
- 번개 모양 자체가 원경 하늘에 보일 수 있음
- 계속 깜빡이는 효과 금지
- 오디오 자동재생 금지

`prefers-reduced-motion`에서는:
- lightning flash 비활성화
또는
- 매우 약한 static storm tone만 유지


---

# 4. Weather Intensity Concept

날씨 FX는 가능한 한 공통 시스템으로 만든다.

예:

```ts
type WindIntensity =
  | "none"
  | "breeze"
  | "strong";

추천 매핑:

Weather	Wind
Sunny	none
Cloudy	breeze
Rain	breeze
Thunderstorm	strong

같은 leaf particle 시스템을 재사용하고
개수 / 속도 / 회전 / 빈도만 변경한다.

5. Time × Weather Composition

시간대와 날씨는 독립적인 레이어다.

예:

Afternoon + Cloudy
밝은 오후 기본빛
회청색 구름
약한 바람
나뭇잎 몇 장
Evening + Rain
주황/핑크 노을이 일부 남음
비와 차가운 tint
물 위에 노을빛과 비가 함께 존재
Night + Thunderstorm
푸른 밤
강한 비
강한 바람
날리는 잎
간헐적 번개
집/랜턴/캠프파이어는 따뜻한 색

Weather effect가 Time-of-Day를 완전히 덮어쓰면 안 된다.

6. World Layer / UI Layer

시간대와 날씨 효과는 World Scene에만 적용한다.

World:

sky
distant mountains
forest
grass
houses
camp
pond
dock
props
Gorani
Daramji

다음 UI에는 적용하지 않는다.

HP / MP
Retirement HUD
House labels
Weather / Time chip
Back
Settings
Sync
Bottom status
Phrase bubble
7. Runtime Reference Rule

reference/money-level/의 이미지는
실제 runtime asset으로 사용하지 않는다.

Reference는 오직:

color
lighting
sky
atmosphere
water reflection
window/lantern glow
weather intensity
wind feeling

을 맞추기 위한 visual target이다.

현재 Forest dynamic scene을 유지하면서
각 Reference의 분위기에 최대한 가깝게 구현한다.

8. Implementation Priority

구현 난이도 대비 우선순위는 다음과 같다.

시간대 tint / lighting
Weather tint
Rain animation
Leaf particle wind
Lightning
Cloud shadow
Pond ripple
실제 나무 흔들림

실제 나무 흔들림은
기본 범위에서 제외한다.

이 프로젝트에서는
나뭇잎 particle만으로도 충분히 바람을 표현할 수 있다.