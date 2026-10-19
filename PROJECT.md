# 프로젝트 설계

작성: 2026-10-18 / 현재 단계: FLOW 0.1.0 구현 및 설치 검증. 아래 초기 설계와 후반의 실제 구현 결정을 함께 기록합니다.

## 제품 목표와 디자인 브리프

YouTube와 Instagram 링크를 실제 미디어 파일로 저장하는 Windows 11 데스크톱 앱.
기본 화이트, 한국어, 절제된 포인트 색, 읽기 쉬운 글자와 일관된 아이콘.
4K의 빠른 붙여넣기 흐름을 참고하되 화면을 복제하지 않습니다. Linear의 정보 위계와 Notion의 여백을 참고합니다.
Product Design의 index → user-context preflight → get-context → ideate 절차를 사용했습니다. 저장된 디자인 컨텍스트는 없었습니다.
사용자가 결합 시안과 파란색 강조색을 선택해 레이아웃을 확정했습니다. 초기 정적 시안은 보존하고 실제 구현·검증 상태는 TASKS.md와 VERIFICATION.md에서 관리합니다.

## 핵심 사용자 흐름

1. 하나 또는 여러 URL 입력/붙여넣기/드롭 → 지원 호스트 및 URL 경로 확인.
2. 비동기 분석 → 썸네일·제목·길이·업로더와 실제 formats 표시.
3. 일반 모드: 영상/오디오, 가능한 형식·화질, 자막, 폴더 선택.
4. 스마트 모드: 명시적 붙여넣기 동작 시 저장된 설정으로 분석 후 대기열 추가. 백그라운드 클립보드 감시는 하지 않음.
5. 다운로드 → 필요시 병합/변환 → FFprobe 검증 → 완료, 파일/폴더 열기.
6. 실패 원인 안내 → 제한적 네트워크 재시도 또는 사용자 재시도.

재생목록과 채널은 전체 다운로드 전에 항목 수와 선택 목록을 표시합니다. 항목별 실제 형식은 각 항목 분석으로 확인합니다.
중복은 플랫폼/미디어 ID/선택 옵션으로 판별하고 사용자가 다시 저장할 수 있도록 안내합니다.

## 아키텍처 결정

- Renderer: React + TypeScript + Tailwind. 표현과 입력 검증 담당. 파일/프로세스 직접 접근 금지.
- Preload: contextBridge를 통한 목적별 최소 API. 원시 ipcRenderer 노출 금지.
- Main: IPC 입력/발신 프레임 검증, 저장 폴더 선택, 알림, 파일 열기와 설정 저장.
- Engine: yt-dlp 어댑터, 형식 선택기, 진행률 파서, 프로세스 감독, 오류 분류.
- Queue: 동시 실행 제한, 취소/재시도, 앱 종료 및 재시작 복구 정책.
- Storage: SQLite 트랜잭션으로 settings/jobs/history 저장. Electron ABI에 맞는 드라이버를 선택하고 패키징 검증 후 고정.
- Resources: yt-dlp, FFmpeg, FFprobe와 필요한 YouTube JS 실행환경/EJS를 앱 리소스로 배포. 개발 PC PATH 의존 금지.
- Installer: electron-builder NSIS .exe를 우선 검토. 설치/실행/제거와 데이터 유지 정책 검증 후 배포.

예정 구조: `src/renderer`, `src/shared`, `electron/main`, `electron/preload`, `electron/engine`, `electron/queue`, `electron/storage`, `resources/bin`, `tests`.
버전은 구현 시작 시 공식 릴리스/패키지 정보를 다시 확인하고 lockfile에 고정합니다. 현재 최신 안정 버전 번호를 확정한 상태는 아닙니다.

## 엔진과 데이터 계약

- spawn(executable, args, {shell:false, windowsHide:true}), 사용자 URL은 별도 인수로 전달. 임의 CLI 옵션 및 --exec 허용 금지.
- URL 파서로 HTTPS와 정확한 YouTube/Instagram 호스트/지원 경로 허용. 임의 로컬/사설망 URL 배제.
- 분석: --ignore-config, JSON 출력, 시간 제한/출력 크기 제한. 플레이리스트는 flat 조회 후 선택 항목 상세 분석.
- formats의 해상도/코덱/컨테이너/오디오 유무로 선택지 생성. 최고 화질은 실제 가능한 최선 조합. 호환되지 않는 코덱을 단순 확장자 변경으로 MP4라 표시하지 않음.
- 진행률은 --newline/--progress-template으로 전달. 전체 용량·ETA 미확인은 null 및 '—'. 다운로드 100%와 변환 완료를 구별.
- 상태: queued → analyzing → downloading → processing → completed. 별도 failed/canceled/interrupted.
- 완료는 프로세스 정상 종료, 최종 경로 존재, FFprobe 스트림 검증 후 확정. WAV/MP3 변환, M4A/원본 유지 각각 별도 경로.
- 작업별 임시 디렉터리, ID 포함 파일명, 기존 파일 덮어쓰기 방지. 정리 대상은 해당 작업 임시 파일로 제한.
- Windows 취소는 yt-dlp 및 하위 FFmpeg 프로세스 트리 종료를 검증. 취소 중 완료 이벤트 경쟁 방지.
- 시작 시 이전 실행 중 작업은 interrupted로 복구하고 명시적 재시도 제공. 이어받기/일시정지 보장은 검증 전 제공하지 않음.
- 네트워크 일시 장애만 횟수 제한/backoff 재시도. 인증/삭제/지원 불가 오류를 무한 재시도하지 않음.

## 보안 및 배포

contextIsolation:true, nodeIntegration:false, sandbox:true, CSP, 로컬 앱 전용 프로토콜, 외부 탐색/새 창 제한.
파일 열기는 저장된 작업의 검증된 미디어 경로만 사용. 설정과 DB는 userData, 미디어는 사용자가 선택한 폴더에 저장.
엔진 업데이트는 공식 릴리스 확인, 무결성 검증, 별도 스테이징 및 이전 버전 복구 방식으로 설계. 실행 중 교체 금지.
yt-dlp 배포 바이너리와 FFmpeg 빌드별 라이선스 및 소스 제공 의무를 확인해 고지에 포함. 아직 재배포 검토 완료 아님.

## 범위

MVP: 단일 공개 URL 분석, 실제 형식 선택, 영상/오디오 저장, 진행률, 취소, 오류, 최소 영구 저장.
확장: 큐, 기록 검색/필터, 스마트 모드, 복수 URL, 재생목록·공개 채널 선택, Instagram 복수 미디어, 자막, 파일명 규칙, 알림, 다크 모드.
Instagram은 공개 URL도 플랫폼 측 제한으로 실패할 수 있으며 실제 테스트 전 지원 확정하지 않습니다. 로그인/쿠키 추출은 기본 범위에 넣지 않습니다.

## 구현 결정 / 2026-10-18

사용자 선택: `design/concepts/combined-main-sidebar.png`의 결합 구조 + `01.png`의 파란색. 색상 수정 이미지 `design/concepts/selected-blue.png`를 구현 기준으로 사용. 추가 디자인 승인 없이 구현하도록 사용자 지시를 받았습니다.

실제 프로젝트는 `app/`입니다. Product Design 기본 템플릿을 출발점으로 Electron 메인/격리 preload/React TypeScript와 Tailwind Vite를 통합했습니다. 로고는 선택 시안을 실제 Image Gen으로 추출한 PNG이며, 영상 썸네일은 분석된 원본의 HTTPS 썸네일을 사용합니다. 프로그램에 예시 다운로드를 심지 않았습니다.

SQLite는 Electron 44에 포함된 Node의 `node:sqlite`를 사용해 ABI가 필요한 외부 네이티브 드라이버를 줄였습니다. UI 의존성은 React와 Lucide이며, 프론트엔드는 빌드에 번들됩니다. Vite/TypeScript는 템플릿 호환 주요 버전을 유지하고 lockfile로 고정했습니다.

실제 코드 기준 스택: Electron 44.9.0, React 19.3.1, TypeScript 5.9.3, Vite 6.4.4, Tailwind 4.3.3, electron-builder 26.15.3. yt-dlp 2026.08.19, Deno 2.9.7, FFmpeg는 yt-dlp 공식 FFmpeg-Builds의 체크섬 검증 빌드입니다. 정확한 바이너리 해시는 manifest에 기록했습니다.

복수 영상/고해상도 MP4는 코덱 호환성을 검사하고, 소리가 없는 원본은 영상만 저장할 수 있는 선택 경로를 제공합니다. M4A는 가능한 경우 원본 AAC 스트림을 우선해 불필요한 재인코딩을 줄입니다. 자막 언어는 실제 제공 목록에서 선택하고 자동 생성 자막은 현재 선택지에 넣지 않습니다.

전송 진행률의 숫자 100%가 최종 완료를 의미하지 않습니다. FFprobe 검증 후에만 완료 처리합니다. 불명확한 총량/속도/ETA는 null로 유지합니다. 파일명에는 짧은 작업 ID를 덧붙여 서로 다른 형식/화질의 충돌을 방지합니다. 자유 파일명 템플릿과 사용자 임의 엔진 옵션은 노출하지 않습니다.

설치 패키지는 NSIS, 사용자별 설치, 경로 선택 가능, 사용자 데이터 유지 방식입니다. 서명 없는 로컬 빌드이며 앱 아이콘/메타데이터는 적용합니다. 개발 PC의 PATH나 계정 데이터에 의존하지 않습니다.
