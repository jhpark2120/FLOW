# 검증 기록 — FLOW 0.1.0

확인일: 2026-10-18, Windows 11 / 실행 호스트 10.0.26300

## 자동 검사

`pnpm run typecheck`, `pnpm test`, `pnpm run build` 통과. `tests/engine.test.cjs` 10개: URL/호스트 경계, 불명확한 진행률, 실제 코덱 호환성, 인수 배열/오디오 변환 선택, DRM 제외, SQLite 저장/중단 복구, Windows 프로세스 취소, 한국어 오류, 다운로드 옵션 검증과 기본값 분리, 큐 제한/취소/제거.

## 실제 미디어 결과

테스트 영상: 공식 Blender `https://www.youtube.com/watch?v=aqz-KE-bpKQ`.
메타데이터에서 제목·길이·실제 스트림 목록을 확인한 뒤 Windows 앱의 옵션 창에서 144p/MP4와 프로젝트 내부 테스트 폴더를 선택했습니다.

- MP4: 14,878,753 bytes. FFprobe: H.264 256×144, AAC, 634.624580초.
- MP3: 10,155,171 bytes. FFprobe: audio/mp3, 634.578146초. 실제 yt-dlp 다운로드 후 FFmpeg 변환 경로를 실행했습니다.
- 두 파일 모두 `ffmpeg -v error -i FILE -f null -` 전체 디코딩 종료 코드 0, 오류 출력 없음.
- 최종 사용자 설치본에서도 스마트 모드로 같은 영상의 MP3 저장을 재실행했습니다. MP3 192 kbps, 15,232,108 bytes, 634.578146초. 설치 폴더의 FFprobe/FFmpeg로 audio/mp3 및 전체 디코딩 종료 코드 0을 확인했습니다. `installed-export-completed.png`와 `.test-data/installed-export-proof.json`에 근거를 보존했습니다.
- 앱의 실제 다운로드 진행률과 완료 화면을 캡처했습니다. 예시 진행률을 주입하지 않았습니다.
- 파일은 `app/.test-data/output/`에 보존했습니다. 테스트 DB는 `app/.test-data/`에 분리했습니다.

Instagram `https://www.instagram.com/reel/Chunk8-jurw/`는 yt-dlp 공식 테스트 사례에서 URL을 확인해 메타데이터만 조회했습니다. 실제 9개 스트림이 반환됐습니다. 파일 저장 성공으로 확대해서 보고하지 않습니다.

## Windows 앱 및 설치

- Electron 44.4.3 개발 실행에서 첫 다운로드 흐름을 직접 조작했습니다.
- 최종 배포는 Electron 44.9.0을 동봉합니다. 초기 패키지에서 창이 보이지 않는 문제가 발견돼 ASAR 내부 파일을 앱 전용 프로토콜에서 명시적 MIME 응답으로 읽고 창 표시를 명시하도록 수정했습니다. 수정한 패키지의 실제 창 표시를 확인했습니다.
- 패키지에서 기존 실제 다운로드 기록과 폴더 설정이 복원됨을 확인했습니다.
- 엔진 상태 버튼으로 yt-dlp 2026.08.19, FFmpeg/FFprobe N-127617-g94cba3150c-20261017, Deno 2.9.7의 실제 응답을 확인했습니다.
- Windows 네이티브 폴더 선택, 완료 폴더 열기, 잘못된 링크 오류, 다크 테마 적용/라이트 복원 확인.
- `app/.test-install`에 NSIS 설치 종료 0. 제거 종료 0, FLOW.exe 제거 확인. 별도 SQLite와 MP4/MP3 파일은 그대로 유지됐습니다.
- 사용자 설치 경로 `C:/Users/jhpark/AppData/Local/Programs/FLOW/FLOW.exe`에 설치/업데이트. 설치본 창과 기록 복원, 한국어 오류를 재확인했습니다.
- 브라우저 미리보기는 Electron 권한을 노출하지 않습니다. Chrome에서 메뉴/형식 전환/설정/기록/다크 모드 조작, 콘솔 오류 없음, 1040×800 및 1440×1024 가로 넘침 없음 확인.

## 근거

`design/verification/`의 실제 캡처:
- `desktop-progress.png`, `desktop-completed.png`: 실제 저장 진행 및 완료
- `packaged-main.png`, `packaged-engines.png`, `packaged-dark.png`: 패키지 실행/동봉 엔진/다크 모드
- `installed-main.png`, `installed-error.png`: 설치본과 정리된 한국어 오류
- `browser-small-settings.png`: 작은 창과 스크롤 시 고정 창 버튼
- `design-comparison.png`, `design-comparison-controls.png`: 원본 시안과 구현의 병치 비교

## 검증하지 않은 범위

다른 깨끗한 PC, Instagram 실제 저장, Shorts/재생목록/채널/복수 게시물의 실제 저장, 자막·앨범 아트·알림의 모든 상황, M4A/WAV/WebM/MKV 전체 변형, 디스크 공간/권한 및 연결 끊김/장시간 부하의 실제 시험은 미완료입니다. 단위 테스트와 코드 구현을 이 환경 검증의 대체로 보고하지 않습니다.

서명되지 않은 로컬 설치 빌드입니다. 인터넷 공개 배포를 위한 서명/전체 전이 라이선스 및 대응 소스 제공 검토는 별도 작업입니다.

최종 설치 파일 SHA256: `8ba4557d13cbb5ec1968a48df7f7d4f589dae7c5b7bb6c2324f40517701b0509` (256,241,440 bytes). `.exe.sha256` 파일도 함께 생성했습니다.
