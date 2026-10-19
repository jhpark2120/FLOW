# FLOW — Windows 미디어 다운로더

공개 YouTube/Instagram 미디어를 저장하는 한국어 Windows Electron 앱입니다.

## 설치 및 사용

- [Windows x64 설치 파일 다운로드](https://github.com/jhpark2120/FLOW/releases/latest)에서 `FLOW-Setup-0.1.0.exe`를 받으세요. Node.js·Python·FFmpeg 별도 설치가 필요하지 않습니다.
- 설치 파일: `app/release/FLOW-Setup-0.1.0.exe` (아래 빌드 명령으로 생성하며 저장소에는 포함하지 않습니다.)
- 설치 후 바탕 화면의 FLOW 실행 → 공개 YouTube/Instagram 링크 붙여넣기 → 링크 분석 → 실제 제공되는 형식/화질 선택 → 다운로드.
- 스마트 모드를 켜면 붙여넣기 동작 시 기본 설정으로 바로 대기열에 추가합니다.
- 기록에서 검색/상태 필터, 재시도, 파일/폴더 열기, 목록 제거를 사용할 수 있습니다. 목록 제거는 미디어 파일을 삭제하지 않습니다.
- 설정에서 기본 폴더, 동시 다운로드 1~5개, 파일명 규칙, 라이트/다크/시스템 테마, 알림, 엔진 상태를 관리합니다.

Node, Python, FFmpeg를 사용자 PC에 별도로 설치할 필요가 없도록 실행환경을 설치 파일에 포함했습니다. 다른 깨끗한 PC에서의 검증은 아직 하지 않았습니다.

릴리스에는 SHA256 확인 파일과 포함 도구의 라이선스 고지를 제공합니다. 설치 파일에는 코드 서명이 없어 Windows에서 게시자 미확인 알림이 표시될 수 있습니다.

## 지원 범위

구현: 공개 YouTube 일반/Shorts URL, 공개 Instagram 게시물/Reels URL 분석, 영상/오디오 저장, 큐, 취소/재시도, 기록·설정 SQLite 저장, 재생목록/공개 채널 선택(첫 200개), Instagram 복수 영상 선택, 수동 자막 SRT/VTT, 완료 알림.

영상은 MP4(H.264 우선)/MKV/WebM의 호환 가능한 스트림을 선택합니다. 오디오는 MP3/M4A/WAV/원본 코덱 유지를 제공합니다. 설정의 해상도는 최대값 선호 설정이며 실제로 없는 화질을 만들어내지 않습니다. 접근 제한·삭제·네트워크 오류는 한국어로 안내합니다.

실제 검증: 공식 Blender YouTube 영상 메타데이터, 144p MP4 저장(H.264+AAC), MP3 추출/변환, 전체 파일 디코딩. Instagram 공식 테스트 릴스 메타데이터(9개 스트림) 확인. **Instagram 파일 저장, Shorts, 채널/재생목록 일괄 저장, 복수 Instagram 미디어, 자막·앨범 아트·알림의 전 상황은 아직 실제 검증하지 않았습니다.**

일시정지·이어받기 UI, 비공개 계정 로그인/쿠키 추출, DRM/접근 제한 우회는 제공하지 않습니다. 사용자 지정 파일명은 자유 텍스트 대신 안전한 두 가지 규칙을 제공합니다. 여러 URL을 함께 넣을 때는 개별 영상 링크를 사용하고, 재생목록/채널 링크는 한 번에 하나씩 분석해 항목을 선택하세요.

## 개발

Node.js 24+, pnpm 11+, 도구 준비에 Python 3 필요.

```powershell
cd app
pnpm install
python scripts/setup-tools.py
pnpm run typecheck
pnpm test
pnpm run build
pnpm run desktop
pnpm run package:win
```

`pnpm run dev -- --host 127.0.0.1 --port 4173`은 브라우저 UI 미리보기입니다. Electron의 파일/프로세스 권한을 브라우저에 노출하지 않으며 브라우저에서 실제 다운로드가 동작한다고 표시하지 않습니다.

도구 준비는 공식 릴리스와 SHA256을 검증합니다. `resources/licenses/build-manifest.json`에 실제 버전과 출처가 남습니다. 엔진 업데이트는 이 도구 준비·테스트·앱 재배포 흐름으로 수행합니다. 실행 중 자체 업데이트는 제공하지 않습니다.

## 구조

- `app/src/`: React/TypeScript 화면 및 공통 컴포넌트
- `app/electron/main.cjs`, `preload.cjs`: Windows 연동과 제한된 IPC
- `app/electron/engine.cjs`: 추출·형식 선택·프로세스·큐
- `app/electron/store.cjs`: SQLite 설정/작업과 재시작 복구
- `app/resources/licenses/`: 포함 도구 고지와 릴리스 manifest
- `app/scripts/`: 도구 준비와 빌드 스크립트
- `app/tests/`: 엔진과 웹 미리보기 빌드 검증

디자인 시안·스크린샷·작업 기록은 저장소에 포함하지 않습니다. 앱 실행·빌드에 사용하는 소스, 설정, 에셋, 테스트와 라이선스를 유지합니다.

설정/기록은 Windows 사용자 AppData의 FLOW 앱 데이터에 저장되며 미디어는 선택한 폴더에 저장됩니다. 설치 제거 시 미디어와 사용자 기록을 자동 삭제하지 않습니다.

Electron 실행환경 다운로드에 환경상 문제가 있으면 `python scripts/setup-electron.py`로 공식 동일 ZIP을 내려받아 패키지 SHA256과 검증할 수 있습니다. 도구 캐시는 릴리스별로 분리해 업데이트 시 이전 바이너리를 잘못 재사용하지 않도록 했습니다.
