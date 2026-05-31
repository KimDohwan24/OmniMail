import { create } from 'zustand';

export const useMailStore = create((set) => ({
  // Accounts connection state
  accounts: [
    { id: 'gmail', name: 'Gmail', connected: false, email: '', color: 'bg-brand-gmail' },
    { id: 'naver', name: 'Naver Mail', connected: false, email: '', color: 'bg-brand-naver' }
  ],
  
  // Theme state: dark or light
  theme: 'dark',
  
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
    // Update body tag class
    if (nextTheme === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
    return { theme: nextTheme };
  })
}));
