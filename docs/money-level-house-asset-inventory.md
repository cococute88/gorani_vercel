# Money Level House Asset Inventory

작성 기준: origin/main 85aa1715acf849e290cee71d2d0ab704bacab6f7

기존 승인 파일은 픽셀을 수정하거나 덮어쓰지 않는다. existing approved는 기존 runtime 자산을 그대로 사용한 단계, new dedicated는 이 작업에서 추가한 계절 중립 alpha WebP를 뜻한다.

| Lv. | art | 위탁 runtime | 절세 runtime | 공유/fallback |
| ---: | --- | --- | --- | --- |
| 0 | clearing | 이미지 없음 | 이미지 없음 | 정상 |
| 1 | camp | existing approved seasonal camp | existing approved seasonal camp | account 공유 |
| 2 | camp-plus | existing approved seasonal camp | existing approved seasonal camp | Lv.1과 공유 |
| 3 | tent-small | existing approved neutral tent | existing approved neutral tent | account 공유 |
| 4 | tent-large | existing approved neutral tent | existing approved neutral tent | Lv.3 source + 전용 frame |
| 5 | tent-color | existing approved yellow tent | existing approved yellow tent | account 공유 |
| 6 | micro-house | new dedicated | new dedicated | 없음 |
| 7 | cabin | existing approved brokerage cabin | new dedicated | 없음 |
| 8 | cabin-expanded | existing approved brokerage alpha cabin | new dedicated | 없음 |
| 9 | house | existing approved brokerage proper house | new dedicated | 없음 |
| 10 | workshop-house | new dedicated | new dedicated | 없음 |
| 11 | two-story | new dedicated | new dedicated | 없음 |
| 12 | two-story-garden | new dedicated | new dedicated | 없음 |
| 13 | two-story-veranda | new dedicated | new dedicated | 없음 |
| 14 | two-story-large | new dedicated | new dedicated | 없음 |
| 15 | two-story-annex | new dedicated | new dedicated | 없음 |
| 16 | mansion | new dedicated | new dedicated | 없음 |
| 17 | mansion-garden | new dedicated | new dedicated | 없음 |
| 18 | grand-mansion | new dedicated | new dedicated | 없음 |
| 19 | grand-mansion-annex | new dedicated | new dedicated | 없음 |

## 원인과 해결

- 기존 resolver는 account를 받지 않아 위탁/절세 identity를 구분하지 못했다.
- micro-house부터 grand-mansion-annex까지 모든 상위 단계가 계절별 temporary-house-fall/winter.webp를 공유했다.
- resolver가 account와 art를 함께 받아 Lv.6~19의 dedicated asset을 고르도록 변경했다.
- 위탁 Lv.7~9 승인 자산을 다시 runtime anchor로 연결하고, 누락된 위탁 11개와 절세 14개만 새로 추가했다.
- 계절별 temporary house는 파일과 fallback 안전장치로 유지하지만 정상 Lv.6~19 경로에서는 사용하지 않는다.
- Lv.1~5 camp/tent source, scale, translation, visual frame은 변경하지 않았다.

## Visual frame 정책

- 신규 alpha 이미지의 실제 visible bounds와 baseline을 기록한다.
- world anchor와 Forest master coordinate는 변경하지 않는다.
- 위탁 Lv.6은 기존 승인 Lv.7보다 작게 보이도록 reference width를 보정한다.
- 이후 단계는 reference width를 완만하게 줄여 성장하면서도 연못, 조각상, 반대편 집 좌표를 이동하지 않는다.

## Reference 조사

| 원본 디렉터리 | 파일 수 | 역할 | feature branch 복사 |
| --- | ---: | --- | --- |
| `C:\gv\gorani_vercel\background` | 80 | 계절/시간/날씨 Forest 합성 reference | 없음 |
| `C:\gv\gorani_vercel\housereference` | 7 | 텐트, 돗자리, fall/winter house 스타일 reference | 없음 |
| `C:\gv\gorani_vercel\public\money-level\art\baseidea` | 2 | 초기 house progression/sign master idea | 없음 |

최종 합성 검증은 feature branch의 production seasonal backgrounds를 기준으로 수행한다.
