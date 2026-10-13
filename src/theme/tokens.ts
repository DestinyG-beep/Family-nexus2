export const spacing = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, xxl: 32 } as const;

export const radii = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

export const lightColors = {
  background: '#f7f1e9',
  surface: '#fffdf9',
  surfaceMuted: '#f1e7db',
  primary: '#a8503b',
  primaryDeep: '#7e392e',
  secondary: '#2d716a',
  heading: '#2f2925',
  body: '#5f5750',
  muted: '#887e74',
  border: '#e7d9ca',
  success: '#39745c',
  warning: '#9b6b2f',
  danger: '#a33e38',
  onPrimary: '#ffffff',
} as const;

export const darkColors = {
  background: '#211c1a',
  surface: '#2c2522',
  surfaceMuted: '#3b2e29',
  primary: '#e07b5d',
  primaryDeep: '#f09575',
  secondary: '#74b8a8',
  heading: '#fff6ed',
  body: '#dbcfc5',
  muted: '#ac9d91',
  border: '#51433b',
  success: '#8bc5a1',
  warning: '#dfae68',
  danger: '#ef8c83',
  onPrimary: '#291713',
} as const;

export type AppColors = typeof lightColors;
