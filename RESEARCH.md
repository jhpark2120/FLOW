# 조사 기록

확인일: 2026-10-18. Google Chrome 연결로 아래 공식 페이지를 직접 열어 내용/화면을 확인했습니다.
프로그램 자체를 설치해 사용한 결과가 아니라 공식 웹 자료 조사입니다.

## 참고 프로그램 / UI

- https://www.4kdownload.com/products/videodownloader-42
  - 공식 제품 스크린샷에서 썸네일 목록, 유형별 분류, 붙여넣기, 형식/화질/코덱/파일 크기 선택 흐름 확인.
  - Smart Mode: 저장된 품질·형식 설정을 이후 다운로드에 적용하는 구조.
  - 공식 소개: 플레이리스트/채널, 자막, 정렬/필터, 개별/그룹 진행 관리.
  - 디자인 판단: 반복 작업에 유리한 빠른 붙여넣기와 일괄 처리를 채택. 코덱·형식·화질이 한곳에 몰릴 수 있어 기본 선택과 상세 정보를 분리하고, 오류 이유/처리 단계를 가독성 있게 배치.
  - 자사 프로그램이 동일 범위를 지원한다는 근거로 사용하지 않음. 로그인 보호 콘텐츠/프록시 등은 복제하지 않음.
- https://linear.app/features
  - 공식 기능 페이지의 절제된 색상과 정보 그룹화를 확인. 캡처는 마케팅 페이지이며 로그인 제품 내부 UX를 검증한 것은 아님.
- https://www.notion.com/ko/product
  - 공식 한국어 페이지의 타이포그래피, 여백, 제품 화면 내 사이드바/콘텐츠 구성을 확인. 인증된 워크스페이스는 조작하지 않음.

## 기술 근거

- https://github.com/yt-dlp/yt-dlp
  - Windows standalone 실행파일 배포와 FFmpeg/FFprobe 의존성 확인.
  - 현재 문서는 전체 YouTube 지원을 위해 yt-dlp-ejs와 지원되는 JS 런타임을 요구한다고 설명. Deno 권장, Node.js 등 대안 표시. Electron만 있다고 외부 실행환경 요구가 해결됐다고 가정하지 않음.
  - JSON 메타데이터, formats, --newline, --progress-template, 후처리 옵션을 엔진 어댑터의 근거로 사용.
  - 플랫폼 목록은 실제 URL의 추출 성공 보장이 아님. 실제 공개 URL 테스트는 후속 단계.
  - standalone 배포물에는 소스 프로젝트와 다른 결합 라이선스가 있을 수 있어 배포물 단위 확인 필요.
- https://ffmpeg.org/ffmpeg.html
  - streamcopy는 디코드/인코딩 없이 컨테이너 변경 및 병합이 가능하나 대상 컨테이너와 소스 정보에 따라 불가할 수 있음.
  - 호환되는 경우 streamcopy, 필요한 오디오 변환만 인코딩. 파일 확장자 변경으로 변환을 대체하지 않음.
- https://www.electronjs.org/docs/latest/tutorial/security
  - context isolation, renderer sandbox, Node 통합 제한, CSP, IPC sender 검증, 탐색/새 창 제한, 사용자 제어 openExternal 주의 및 custom protocol 권고 확인.

## 조사 범위와 남은 확인

라이브러리/엔진의 정확한 최신 안정 버전 번호와 설치 도구 상세는 구현 시작 시 공식 릴리스/문서로 재확인해 고정합니다.
React/TypeScript/Tailwind 설치·API 및 NSIS 패키징 문서 상세 조사는 미완료입니다.
4K의 모든 설정 화면, 실제 설치 앱의 인터랙션/애니메이션, 플랫폼별 다운로드 성공 여부는 검증하지 않았습니다.

## 시안

Product Design의 ideate 지침에 따라 실제 Image Gen으로 독립 이미지 3개 생성.
채팅에 표시된 순서가 선택 번호의 기준: `design/concepts/01.png`, `02.png`, `03.png`.
참고 캡처 3장을 생성 요청에 직접 첨부했습니다. 모두 정적 디자인이며 실제 다운로드 진행률은 아닙니다.
사용자 선택 후 프로토타입 제작과 검증을 시작합니다.

## 구현 단계 추가 조사 / 2026-10-18

Chrome에서 React Quick Start(https://react.dev/learn), Tailwind Vite 설치(https://tailwindcss.com/docs/installation/using-vite), TypeScript Handbook(https://www.typescriptlang.org/docs/handbook/intro.html), electron-builder NSIS(https://www.electron.build/nsis.html), Lucide React(https://lucide.dev/guide/react/) 공식 자료를 열어 확인했습니다.

라이브 npm registry 조회와 설치 결과로 버전을 확인하고 pnpm-lock.yaml에 고정했습니다. 최신 주요 버전으로 무조건 이동하는 대신 Product Design 템플릿의 Vite 6/TypeScript 5를 유지했습니다. Electron/React 및 Tailwind는 현재 설치된 안정 릴리스를 사용합니다.

실제 공개 콘텐츠 검증: `https://www.youtube.com/watch?v=aqz-KE-bpKQ`의 공식 Blender 영상 정보와 MP4/MP3 저장을 확인했습니다. `https://www.instagram.com/reel/Chunk8-jurw/`는 yt-dlp 공식 Instagram 추출기 테스트에서 확인한 URL로, 메타데이터만 조회했습니다. `BaW_jenozKc` 예전 yt-dlp 테스트 영상은 현재 unavailable로 실패해 성공 테스트 대상으로 사용하지 않았습니다.

바이너리는 GitHub 공식 릴리스의 digest/SHA256과 대조했습니다. Windows Electron 설치 스크립트의 다운로드가 응답하지 않아 공식 동일 ZIP을 Python으로 받아 패키지 checksums.json과 검증하는 경로로 완료했습니다. 최종 설치 파일은 Electron 44.9.0을 동봉합니다. 초기 화면 테스트에서만 기존 로컬 Electron 44.4.3 런타임을 사용했습니다.

Electron-builder가 오래된 템플릿 package-lock.json을 보고 npm 수집기를 선택해 실패했습니다. 사용하지 않는 package-lock.json을 제거하고 pnpm 버전/빌드 허용 설정을 명시해 해결했습니다. 인증·보안 보호 기능을 끄지 않았습니다.
