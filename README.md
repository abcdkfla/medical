# Fed-Batch Lab

한국어 교육용 fed-batch 배양 시뮬레이터입니다. E. coli BL21과 C. glutamicum을 지원합니다.

## GitHub에 업로드하기

1. 이 ZIP을 압축 해제합니다.
2. GitHub에서 빈 저장소를 만듭니다. 예: `fed-batch-lab`.
3. 저장소의 **Add file → Upload files**에서 이 폴더 **안의 내용**을 업로드합니다. ZIP 자체를 업로드하지 마세요.
4. 저장소 최상위에 `README.md`, `docs/`, `package.json`이 보이면 올바른 구조입니다.
5. 업로드 후 **Commit changes**를 누릅니다.

### GitHub Pages로 웹사이트 열기

1. 저장소 **Settings → Pages**를 엽니다.
2. **Source → Deploy from a branch**를 선택합니다.
3. **Branch → main**, **Folder → /docs**를 선택하고 **Save**를 누릅니다.
4. 게시가 완료되면 Pages 설정에 표시된 주소를 엽니다. 이후 `docs/`의 변경사항을 커밋하면 사이트에 반영됩니다.

GitHub Free의 Pages는 공개 저장소에서 사용할 수 있습니다. 비공개 저장소의 Pages 지원 여부는 계정 요금제에 따라 다릅니다.
공식 안내: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## PC에서 실행

`docs/index.html`을 브라우저에서 열 수 있습니다. 별도 빌드나 API 키가 필요하지 않습니다.
일반적인 정적 웹 서버로 `docs/`를 제공해도 됩니다. Pretendard 글꼴은 CDN을 사용하고, 연결이 없으면 시스템 글꼴을 사용합니다. Chart.js는 포함되어 있습니다.

## 포함된 기능

- 배양 개요: 반응기 액면·기포·교반·펌프 상태 시각화, 핵심 지표와 그래프
- 운전 설정: 배치, 균주, 가스, 펌프, pH 설정
- 배지 시약 추가·삭제, 질소 및 탄소 계산
- RUN, 일시정지, 수동 조건 변경, 재개, 종료
- 단계별 레시피, 다중 채널 트렌드, 알람 확인
- 설정 JSON 저장·불러오기, 결과 CSV 및 전체 JSON 저장
- 사용방법 메뉴
- 이전 남색 UI: `docs/previous.html` (구형 계산 로직 그대로 보관)

## 파일 구성

| 파일 | 역할 |
|---|---|
| `docs/index.html` | 최신 화면 진입점 |
| `docs/app.js` | 입력, 화면, 실행, 기록 |
| `docs/engine.js` | 배양 계산 엔진 |
| `docs/visualization.js` | 반응기 시각화와 사용방법 |
| `docs/styles.css` | 화면 스타일 |
| `docs/chart.umd.js` | Chart.js 4.4.8 |
| `test-engine.cjs` | 계산 검증 |

## 개발 및 검증

Node.js 20 이상에서 다음을 실행합니다. 외부 패키지 설치는 필요하지 않습니다.

```sh
npm test
npm run check
```

테스트는 두 균주의 240시간 적분, 질소 수지, 레시피 피드량, 4 L 종료, 잘못된 입력 거부와 시간 간격 민감도를 검사합니다. 실제 브라우저의 외관이나 생물학적 정확성을 보장하는 검사는 아닙니다.

## 데이터와 모델의 한계

실제 기기 연결 기능이 없는 교육용 모델입니다. kLa·pH·산소·아세트산 관련 가정은 앱의 모델 설정에서 확인할 수 있습니다. 실제 실험 데이터로 보정되지 않았으며, 장기 사멸과 다양한 탄소원 대사를 지원하지 않습니다. 최대 240시간은 소프트웨어 범위입니다.

계산 기록은 현재 탭에만 유지됩니다. 새로고침하거나 창을 닫기 전에 CSV/JSON 파일을 저장하세요. GitHub Pages에 게시해도 데이터베이스나 계정 저장 기능이 생기지는 않습니다.

## 라이선스

Chart.js의 MIT 고지는 `docs/CHARTJS-LICENSE.txt`에 포함되어 있습니다. Pretendard는 외부 CDN을 사용하는 글꼴입니다. 프로젝트 자체의 공개 라이선스는 소유자가 선택할 수 있도록 아직 지정하지 않았습니다.

## 원본

2026-09-22 정리된 최신 화면(저장 버전 9) 기준. 원본 커밋: `613aef1045b75b61fcc9d043fc445112c9863ec3`.
기존 홈페이지와 별개로 업로드할 수 있도록 호스팅 서비스 전용 설정 및 Git 이력을 제외했습니다.
