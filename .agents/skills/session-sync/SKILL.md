# 기술 스킬: 네이버 & Gmail 실시간 세션 동기화 (MV3)

이 문서는 사용자의 실제 계정 비밀번호를 저장하거나 묻지 않고, 크롬 브라우저의 로그인 세션을 활용해 실시간으로 이메일을 획득 및 동기화하기 위한 기술적 구현 가이드를 정의합니다.

---

## 🔑 로그인 세션 공유 원리 (Cookie Sharing)

OmniMail은 크롬 확장 프로그램으로서 네이버와 구글 도메인에 대한 호스트 권한(`host_permissions`)을 획득합니다. 이를 통해 사용자가 일반 웹 브라우저 탭에서 네이버나 Gmail에 로그인해 둔 상태라면, 확장 프로그램 내부 통신 시 해당 쿠키(세션) 정보를 자동으로 얹어서 이메일 서버에 요청을 보낼 수 있습니다.

### 1. 세션 연결성 검증 로직
연동 상태를 점검하기 위해 각 이메일 서버의 목록 엔드포인트에 `fetch` 요청을 전송합니다.
* **Disconnected (미연동):** 요청 결과가 로그인 화면(예: `nid.naver.com` 혹은 `accounts.google.com`)으로 리다이렉트되거나 `401 Unauthorized` 에러가 반환되는 경우.
* **Connected (연동됨):** 정상적으로 메일 리스트 응답을 수신하는 경우.

### 2. 크롬 매니페스트 필수 권한
확장 프로그램이 원활히 동작하기 위해 `manifest.json`에 다음 권한을 선언해야 합니다:
* `permissions`: `["cookies", "webRequest"]`
* `host_permissions`: `["https://mail.naver.com/*", "https://m.mail.naver.com/*", "https://mail.google.com/*", "https://*.google.com/*"]`

---

## 📬 이메일 제공사별 수신 처리 기술

### 1. Gmail RSS (Atom Feed) 파싱
구글은 로그인된 세션에 한해 가장 최근의 안 읽은 메일을 빠르게 긁어올 수 있는 XML 피드를 지원합니다.
* **엔드포인트:** `https://mail.google.com/mail/feed/atom`
* **구현 예시:**
  ```javascript
  const response = await fetch('https://mail.google.com/mail/feed/atom');
  const xmlText = await response.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const entries = xmlDoc.getElementsByTagName("entry");
  
  // 각 entry 태그 내부 노드에서 정보 추출:
  // <title> = 메일 제목
  // <summary> = 본문 요약 (snippet)
  // <author><name> = 발신인 이름
  // <author><email> = 발신인 이메일 주소
  ```

### 2. 네이버 모바일 웹 스크래핑 및 JSON 분석
네이버는 브라우저가 호출하는 비공개 메일 목록 API 또는 모바일 메일함 구조를 활용합니다.
* **엔드포인트:** `https://mail.naver.com/json/list/` (혹은 모바일 경로 `https://m.mail.naver.com/`)
* **구현 예시:**
  * 일반 크롬 브라우저 사용자처럼 보이도록 User-Agent 및 기본 헤더를 요청에 포함합니다.
  * 응답 데이터(JSON)에서 발신인, 제목, 수신 시간, 읽음 상태 등을 정형화된 JSON 객체로 파싱합니다.

---

## ⏰ 백그라운드 동기화 사이클
사용자가 대시보드를 켜두지 않아도 신규 메일을 실시간으로 모니터링하기 위해 크롬 백그라운드 프로세스를 가동합니다.
1. **백그라운드 알람 등록:** `chrome.alarms.create("sync-emails", { periodInMinutes: 5 });`를 사용하여 5분 주기로 동기화 명령을 호출합니다.
2. **신규 메일 감지:** `background.js`에서 조용히 메일을 가져온 후, 안 읽은 편지 수가 늘어났다면:
   * 확장 프로그램 아이콘 배지 업데이트: `chrome.action.setBadgeText({ text: newCount.toString() });`
   * 시스템 바탕화면 알림(Toaster) 팝업 발생: `chrome.notifications.create(...)`
3. **로컬 스토리지 연동:** 수집된 메일은 `chrome.storage.local`에 저장됩니다. 대시보드 화면(React)은 스토리지 변경 이벤트를 실시간 리스닝하여 화면을 부드럽게 새로고침합니다.
