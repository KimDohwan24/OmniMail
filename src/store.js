import { create } from 'zustand';

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
  } catch (e) {
    return 'dark';
  }
};

const initialTheme = getInitialTheme();
syncTheme(initialTheme);

export const useMailStore = create((set) => ({
  // Accounts connection state
  accounts: [
    { id: 'gmail', name: 'Gmail', connected: false, email: '', color: 'bg-brand-gmail' },
    { id: 'naver', name: 'Naver Mail', connected: false, email: '', color: 'bg-brand-naver' }
  ],
  
  // Theme state: dark or light
  theme: initialTheme,
  
  // Actions
  connectAccount: (id, email) => set((state) => ({
    accounts: state.accounts.map(acc => 
      acc.id === id ? { ...acc, connected: true, email } : acc
    )
  })),
  
  disconnectAccount: (id) => set((state) => ({
    accounts: state.accounts.map(acc => 
      acc.id === id ? { ...acc, connected: false, email: '' } : acc
    )
  })),
  
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    syncTheme(nextTheme);
    return { theme: nextTheme };
  })
}));
