# 기술 스킬: 사용자 지정 로컬 이메일 자동 분류기

이 문서는 사용자가 설정한 키워드 및 발신 도메인 규칙을 바탕으로 실시간 유입된 이메일을 중요(`#important`)와 일반(`#regular`) 카테고리로 자동 분류하는 라우팅 엔진의 기술 사양을 정의합니다.

---

## ⚙️ Zustand 규칙 상태(State) 설계

분류 엔진은 전역 Zustand 저장소(`src/store.js`)에 저장된 두 가지 규칙 배열을 활용하여 동작합니다.
1. `importantKeywords`: 중요 키워드 문자열 목록 (예: `["결제", "공지", "프로젝트", "긴급"]`)
2. `importantDomains`: 중요 발신 도메인 혹은 특정 이메일 주소 목록 (예: `["company.com", "github.com", "boss@work.com"]`)

### 스토어 액션 확장 예시
```javascript
export const useMailStore = create((set) => ({
  // 필터 규칙 설정 기본값
  importantKeywords: ["결제", "공지", "프로젝트", "긴급", "urgent"],
  importantDomains: ["company.com", "github.com"],
  
  // 규칙 관리 액션
  addKeyword: (kw) => set((s) => ({ importantKeywords: [...s.importantKeywords, kw.toLowerCase()] })),
  removeKeyword: (kw) => set((s) => ({ importantKeywords: s.importantKeywords.filter(k => k !== kw) })),
  addDomain: (dom) => set((s) => ({ importantDomains: [...s.importantDomains, dom.toLowerCase()] })),
  removeDomain: (dom) => set((s) => ({ importantDomains: s.importantDomains.filter(d => d !== dom) }))
}));
```

---

## 🧠 분류 판단 알고리즘 흐름 (Classification Logic)

이메일이 네이버/Gmail 서버로부터 패치되는 즉시, 아래 분석 함수를 거쳐 카테고리 상태가 결정된 후 React 상태에 누적됩니다.

```javascript
function classifyEmail(email, keywords, domains) {
  const senderEmail = email.senderEmail.toLowerCase();
  const subject = email.subject.toLowerCase();
  const bodySnippet = email.bodySnippet ? email.bodySnippet.toLowerCase() : "";

  // 규칙 1: 발신 도메인 및 특정 이메일 일치 여부 검사
  const matchDomain = domains.some(dom => 
    senderEmail.endsWith(`@${dom}`) || senderEmail === dom
  );
  if (matchDomain) return "important";

  // 규칙 2: 메일 제목 내 중요 키워드 포함 검사
  const matchSubject = keywords.some(kw => subject.includes(kw));
  if (matchSubject) return "important";

  // 규칙 3: 메일 내용 요약본(Snippet) 내 중요 키워드 포함 검사
  const matchBody = keywords.some(kw => bodySnippet.includes(kw));
  if (matchBody) return "important";

  // 매칭 규칙이 없을 시 일반(regular) 카테고리로 반환
  return "regular";
}
```

---

## 🎛️ 설정 화면(Settings UI) 규칙 관리 기능
대시보드의 설정 오버레이 내에 필터 규칙을 직접 편집할 수 있는 컨트롤 화면을 설계해야 합니다.
* **칩(Chip) 형태 렌더링:** 등록된 키워드와 도메인을 제거 아이콘(X)이 달린 둥근 태그 칩 형태로 화면에 표시합니다.
* **인풋 추가 인터페이스:** 텍스트 필드와 [추가] 버튼을 배치하여 실시간으로 전역 스토어에 규칙이 축적되도록 설계합니다.
* **재분류 트리거:** 규칙이 수정되면 기존에 수신되어 로컬 메모리에 저장되어 있던 이메일들을 새로운 규칙으로 즉시 재분류하여 화면을 실시간 업데이트하는 기능을 탑재합니다.
