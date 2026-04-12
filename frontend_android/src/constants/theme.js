export const Colors = {
  primary: '#5A5A40',
  primaryDark: '#3E3E2A',
  primaryLight: '#8A8A65',
  primaryBg: 'rgba(90,90,64,0.08)',
  background: '#F5F5F0',
  backgroundAlt: '#EFEFEA',
  white: '#FFFFFF',
  border: '#E8E8E2',
  borderDark: '#D0D0C8',
  textPrimary: '#1A1A1A',
  textSecondary: '#555550',
  textMuted: '#9A9A90',
  textLight: '#BBBBB0',
  success: '#10B981',
  successDark: '#059669',
  successBg: '#ECFDF5',
  danger: '#EF4444',
  dangerDark: '#DC2626',
  dangerBg: '#FEF2F2',
  warning: '#F59E0B',
  warningDark: '#D97706',
  warningBg: '#FFFBEB',
  info: '#3B82F6',
  infoDark: '#2563EB',
  infoBg: '#EFF6FF',
  purple: '#8B5CF6',
  purpleBg: '#F5F3FF',
  star: '#F59E0B',
  overlay: 'rgba(0,0,0,0.5)',
  card: '#FFFFFF',
  shadow: '#00000010',
};

export const Fonts = {
  regular: { fontSize: 14, color: Colors.textPrimary },
  bold: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  heading: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  subheading: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary },
  caption: { fontSize: 12, color: Colors.textSecondary },
  small: { fontSize: 11, color: Colors.textMuted },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BorderRadius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};
