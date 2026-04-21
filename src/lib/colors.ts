export interface ColorPalette {
  background: string
  surface: string
  surfaceAlt: string
  border: string
  borderSubtle: string
  primaryText: string
  secondaryText: string
  tertiaryText: string
  placeholder: string
  accent: string
  accentText: string
  error: string
  overlay: string
  overlayStrong: string
  star: string
}

export const darkColors: ColorPalette = {
  background: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceAlt: '#242424',
  border: '#2A2A2A',
  borderSubtle: '#1E1E1E',
  primaryText: '#FFFFFF',
  secondaryText: '#666666',
  tertiaryText: '#AAAAAA',
  placeholder: '#555555',
  accent: '#111d4a',
  accentText: '#FFFFFF',
  error: '#FF3B30',
  overlay: 'rgba(13,13,13,0.85)',
  overlayStrong: 'rgba(0,0,0,0.5)',
  star: '#FFFFFF',
}

export const lightColors: ColorPalette = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceAlt: '#EEEEEE',
  border: '#E5E5E5',
  borderSubtle: '#F0F0F0',
  primaryText: '#1A1A1A',
  secondaryText: '#888888',
  tertiaryText: '#555555',
  placeholder: '#AAAAAA',
  accent: '#111d4a',
  accentText: '#FFFFFF',
  error: '#FF3B30',
  overlay: 'rgba(255,255,255,0.85)',
  overlayStrong: 'rgba(0,0,0,0.3)',
  star: '#111d4a',
}
