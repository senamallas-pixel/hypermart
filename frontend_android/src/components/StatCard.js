import { View, Text } from 'react-native';
import { Colors, BorderRadius, Shadow } from '../constants/theme';

const ACCENT_COLORS = {
  revenue:  { bg: Colors.successBg,  text: Colors.successDark,  bar: Colors.success },
  orders:   { bg: Colors.infoBg,     text: Colors.infoDark,     bar: Colors.info },
  warning:  { bg: Colors.warningBg,  text: Colors.warningDark,  bar: Colors.warning },
  danger:   { bg: Colors.dangerBg,   text: Colors.dangerDark,   bar: Colors.danger },
  purple:   { bg: Colors.purpleBg,   text: Colors.purple,       bar: Colors.purple },
  default:  { bg: Colors.primaryBg,  text: Colors.primary,      bar: Colors.primary },
};

function detectVariant(icon = '', label = '') {
  const s = (icon + label).toLowerCase();
  if (s.includes('revenue') || s.includes('₹') || s.includes('sales')) return 'revenue';
  if (s.includes('order'))   return 'orders';
  if (s.includes('low') || s.includes('stock') || s.includes('⚠')) return 'warning';
  if (s.includes('user') || s.includes('shop') || s.includes('🏪')) return 'purple';
  return 'default';
}

export default function StatCard({ label, value, icon, variant }) {
  const v = variant || detectVariant(icon, label);
  const c = ACCENT_COLORS[v] || ACCENT_COLORS.default;

  return (
    <View style={{
      backgroundColor: Colors.white,
      borderRadius: BorderRadius.lg,
      padding: 16,
      flex: 1,
      minWidth: '45%',
      overflow: 'hidden',
      ...Shadow.sm,
    }}>
      {/* Colored top bar */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: c.bar, borderTopLeftRadius: BorderRadius.lg, borderTopRightRadius: BorderRadius.lg }} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginTop: 4 }}>{value}</Text>
          <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 3, fontWeight: '500' }}>{label}</Text>
        </View>
        {icon && (
          <View style={{
            width: 38, height: 38, borderRadius: BorderRadius.sm,
            backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ fontSize: 17 }}>{icon}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
