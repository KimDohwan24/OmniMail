/**
 * Mail Classifier Store Slice
 * 
 * [학습 포인트]
 * 1. Zustand Slice 패턴: 전역 스토어의 한 조각(Slice)으로, 이메일 분류와 관련된 상태만 관리합니다.
 * 2. set, get 인자: set은 상태를 업데이트하고, get은 현재 상태값을 읽을 때 사용합니다.
 * 3. 이 슬라이스는 추후 메인 스토어(src/store.js)에서 합쳐집니다.
 */

export const createClassifierSlice = (set) => ({
  // 1. 상태 (State)
  keywords: ['결제', '공지', '프로젝트'], // 중요 분류 키워드 목록
  domains: ['company.com', 'github.com'], // 중요 분류 발신 도메인 목록

  // 2. 액션 (Actions) - 상태 변경 함수들
  addKeyword: (keyword) => set((state) => {
    const trimmed = keyword.trim();
    if (!trimmed || state.keywords.includes(trimmed)) return {};
    return { keywords: [...state.keywords, trimmed] };
  }),

  removeKeyword: (keyword) => set((state) => ({
    keywords: state.keywords.filter((kw) => kw !== keyword)
  })),

  addDomain: (domain) => set((state) => {
    const trimmed = domain.trim().toLowerCase();
    if (!trimmed || state.domains.includes(trimmed)) return {};
    return { domains: [...state.domains, trimmed] };
  }),

  removeDomain: (domain) => set((state) => ({
    domains: state.domains.filter((dom) => dom !== domain)
  }))
});
