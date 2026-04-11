import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { forgotPassword } from '../../api/client';
import { Colors, BorderRadius, Spacing } from '../../constants/theme';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) { setError('Please enter your email.'); return; }
    setLoading(true); setError(''); setMessage('');
    try {
      await forgotPassword(email.trim().toLowerCase());
      setMessage('If an account exists with that email, a reset link has been sent.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{
          backgroundColor: Colors.white, borderRadius: BorderRadius.xxl,
          padding: Spacing.xxl, shadowColor: '#000', shadowOpacity: 0.05,
          shadowRadius: 20, elevation: 3,
        }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 }}>
            Forgot Password
          </Text>
          <Text style={{ fontSize: 13, color: Colors.textSecondary, marginBottom: 24 }}>
            Enter your email and we'll send you a reset link.
          </Text>

          <TextInput
            style={{
              backgroundColor: Colors.background, borderRadius: BorderRadius.lg,
              paddingHorizontal: 16, paddingVertical: 14, fontSize: 14,
              color: Colors.textPrimary, marginBottom: 12,
            }}
            placeholder="Email address"
            placeholderTextColor={Colors.textLight}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={v => { setEmail(v); setError(''); setMessage(''); }}
          />

          {!!error && <Text style={{ color: Colors.danger, fontSize: 12, marginBottom: 8 }}>{error}</Text>}
          {!!message && <Text style={{ color: Colors.success, fontSize: 12, marginBottom: 8 }}>{message}</Text>}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={{
              backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
              paddingVertical: 14, alignItems: 'center', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 1.5 }}>
                SEND RESET LINK
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ alignItems: 'center', paddingVertical: 16 }}
          >
            <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '600' }}>
              Back to Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
