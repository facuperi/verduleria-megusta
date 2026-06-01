import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({});

export const useTheme = () => useContext(ThemeContext);

const THEME_KEY = 'santos-theme';

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem(THEME_KEY) || 'dark';
  });

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
