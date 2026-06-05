import { create } from 'zustand';
import { createSyncSlice } from './features/mail-sync/syncSlice';
import { createClassifierSlice } from './features/mail-classifier/classifierSlice';

// 테마를 body 태그 클래스 및 localStorage와 동기화하는 헬퍼 함수
const syncTheme = (theme) => {
  if (typeof document !== 'undefined') {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
    console.log('[OmniMail Theme Debug] Current Theme:', theme);
    console.log('[OmniMail Theme Debug] HTML Classes:', document.documentElement.className);
  }
  try {
    localStorage.setItem('omnimail-theme', theme);
  } catch (e) {
    console.error('Failed to save theme to localStorage:', e);
  }
};

// 초기 테마 로드
const getInitialTheme = () => {
  try {
    return localStorage.getItem('omnimail-theme') || 'dark';
  } catch {
    return 'dark';
  }
};

const initialTheme = getInitialTheme();
syncTheme(initialTheme);

/**
 * OmniMail 통합 상태 저장소 (useMailStore)
 * 
 * [학습 포인트]
 * 1. 스프레드 연산자(...)를 이용해 독립된 슬라이스 스토어(Sync, Classifier)를 한데 모읍니다.
 * 2. 이를 통해 컴포넌트 측에서는 useMailStore 단 하나의 훅만 바라보고 데이터를 자유롭게 공유할 수 있습니다.
 */
export const useMailStore = create((set, get) => ({
  // 테마 상태 및 액션
  theme: initialTheme,
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    syncTheme(nextTheme);
    return { theme: nextTheme };
  }),

  // 이메일 동기화 및 분류기 슬라이스 병합
  ...createSyncSlice(set, get),
  ...createClassifierSlice(set, get)
}));
