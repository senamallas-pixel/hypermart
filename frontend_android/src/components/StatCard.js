import { View, Text } from 'react-native';
import { Colors, BorderRadius, Spacing } from '../constants/theme';

export default function StatCard({ label, value, icon }) {
  return (
    <View style={{
      backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
      padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
      flex: 1, minWidth: '45%',
    }}>
      {icon && (
        <View style={{
          width: 40, height: 40, borderRadius: BorderRadius.md,
          backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ fontSize: 18 }}>{icon}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.textPrimary }}>{value}</Text>
        <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>{label}</Text>
      </View>
    </View>
  );
}
