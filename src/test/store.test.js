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

describe('Zustand store - Mail account integration tests', () => {
  it('기본 계정 식별자(gmail, naver)와 초기 연동 해제 상태가 올바르게 존재해야 한다', () => {
    const { accounts } = useMailStore.getState();
    
    expect(accounts).toHaveLength(2);
    
    const gmailAcc = accounts.find(acc => acc.id === 'gmail');
    expect(gmailAcc).toBeDefined();
    expect(gmailAcc.name).toBe('Gmail');
    expect(gmailAcc.connected).toBe(false);
    expect(gmailAcc.email).toBe('');

    const naverAcc = accounts.find(acc => acc.id === 'naver');
    expect(naverAcc).toBeDefined();
    expect(naverAcc.name).toBe('Naver Mail');
    expect(naverAcc.connected).toBe(false);
    expect(naverAcc.email).toBe('');
  });

  it('connectAccount를 호출하면 지정된 계정이 연동 상태로 전환되고 이메일 주소가 업데이트되어야 한다', () => {
    const { connectAccount } = useMailStore.getState();
    
    // gmail 계정 연동 테스트
    connectAccount('gmail', 'test.user@gmail.com');
    let state = useMailStore.getState();
    let gmailAcc = state.accounts.find(acc => acc.id === 'gmail');
    expect(gmailAcc.connected).toBe(true);
    expect(gmailAcc.email).toBe('test.user@gmail.com');

    // naver 계정 연동 테스트
    connectAccount('naver', 'test.user@naver.com');
    state = useMailStore.getState();
    const naverAcc = state.accounts.find(acc => acc.id === 'naver');
    expect(naverAcc.connected).toBe(true);
    expect(naverAcc.email).toBe('test.user@naver.com');
  });

  it('disconnectAccount를 호출하면 지정된 계정의 연동 상태가 해제되고 이메일 주소가 초기화되어야 한다', () => {
    const { connectAccount, disconnectAccount } = useMailStore.getState();
    
    // 먼저 연동 후 해제 테스트
    connectAccount('gmail', 'test.user@gmail.com');
    disconnectAccount('gmail');
    
    const state = useMailStore.getState();
    const gmailAcc = state.accounts.find(acc => acc.id === 'gmail');
    expect(gmailAcc.connected).toBe(false);
    expect(gmailAcc.email).toBe('');
  });
});

