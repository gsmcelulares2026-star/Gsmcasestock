export const theme = {
  colors: {
    background: '#08111f',
    surface: '#10203a',
    surfaceMuted: '#172b4d',
    surfaceSoft: '#1e3964',
    primary: '#4f7cff',
    secondary: '#7e5bef',
    accent: '#58d6a7',
    text: '#f5f7ff',
    textMuted: '#9eafd1',
    border: '#23406f',
    danger: '#ff6a6a',
    warning: '#ffb84d',
    success: '#62d39a',
    overlay: 'rgba(3, 8, 18, 0.82)',
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 20,
    xl: 28,
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 24,
  },
};

export type AppTheme = typeof theme;
