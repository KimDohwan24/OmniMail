import { describe, it, expect, beforeEach } from 'vitest';
import { useMailStore } from '../store';

describe('Zustand store - Theme state tests', () => {
  beforeEach(() => {
    // 테스트 전에 html(documentElement) 클래스 및 로컬스토리지 초기화
    document.documentElement.className = '';
    localStorage.clear();
  });

  it('기본 테마는 dark로 설정되어 있어야 한다용', () => {
    const state = useMailStore.getState();
    expect(state.theme).toBe('dark');
  });

  it('toggleTheme을 호출하면 theme 상태가 반전되어야 한다용 (dark -> light -> dark)', () => {
    const { toggleTheme } = useMailStore.getState();
    
    // 테마 상태를 명시적으로 'dark'로 초기 세팅(필요시) 후 테스트
    if (useMailStore.getState().theme !== 'dark') {
      toggleTheme();
    }
    
    // dark -> light
    toggleTheme();
    expect(useMailStore.getState().theme).toBe('light');

    // light -> dark
    toggleTheme();
    expect(useMailStore.getState().theme).toBe('dark');
  });

  it('theme 상태에 따라 document.documentElement의 classList가 동기화되어야 한다용', () => {
    const { toggleTheme } = useMailStore.getState();
    
    // 테마가 'light'일 때 html에는 'light' 클래스가 있고 'dark' 클래스는 없어야 함
    if (useMailStore.getState().theme === 'dark') {
      toggleTheme(); // -> light
    }
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // 테마가 'dark'일 때 html에는 'dark' 클래스가 있고 'light' 클래스는 없어야 함
    toggleTheme(); // -> dark
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('테마 상태가 localStorage에 저장 및 로드되어야 한다용', () => {
    const { toggleTheme } = useMailStore.getState();
    
    // 테마 토글 시 로컬스토리지 값 확인
    if (useMailStore.getState().theme === 'dark') {
      toggleTheme(); // -> light
    }
    expect(localStorage.getItem('omnimail-theme')).toBe('light');
    
    toggleTheme(); // -> dark
    expect(localStorage.getItem('omnimail-theme')).toBe('dark');
  });
});
