import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { login, register } from '../../api/client';
import { Colors, BorderRadius, Spacing } from '../../constants/theme';
import { DEMO_ACCOUNTS } from '../../constants/config';
import LanguageSelector from '../../components/LanguageSelector';

export default function SignInScreen({ navigation }) {
  const { signIn } = useApp();
  const [tab, setTab] = useState('login');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('customer');

  const handleLogin = async (emailOvr, pwOvr) => {
    const e = (emailOvr || email).trim().toLowerCase();
    const p = pwOvr || password;
    if (!e || !p) { setError('Email and password are required.'); return; }
    setLoading(true); setError('');
    try {
      const res = await login({ email: e, password: p });
      await signIn(res.data.access_token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check credentials.');
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!regName || !regEmail || !regPassword) {
      setError('Name, email and password are required.'); return;
    }
    setLoading(true); setError('');
    try {
      const res = await register({
        display_name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        phone: regPhone.trim() || undefined,
        password: regPassword,
        role: regRole,
      });
      await signIn(res.data.access_token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Try again.');
    } finally { setLoading(false); }
  };

  const ROLES = [
    { key: 'customer', label: 'Customer', desc: 'Browse shops & order' },
    { key: 'owner', label: 'Shop Owner', desc: 'List & manage your shop' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: Spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{
            backgroundColor: Colors.primary, borderTopLeftRadius: BorderRadius.xxl,
            borderTopRightRadius: BorderRadius.xxl, paddingHorizontal: Spacing.xxl,
            paddingTop: 40, paddingBottom: Spacing.xxl,
          }}>
            <View style={{
              width: 52, height: 52, backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: BorderRadius.lg, justifyContent: 'center', alignItems: 'center',
              marginBottom: Spacing.md,
            }}>
              <Text style={{ fontSize: 24, color: '#fff', fontWeight: '700' }}>H</Text>
            </View>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 2 }}>
              HyperMart
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
              Your neighbourhood marketplace
            </Text>
            <View style={{ position: 'absolute', top: 16, right: 16 }}>
              <LanguageSelector />
            </View>
          </View>

          {/* Tabs */}
          <View style={{
            flexDirection: 'row', backgroundColor: Colors.white,
            borderBottomWidth: 1, borderBottomColor: Colors.border,
          }}>
            {['login', 'register'].map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => { setTab(t); setError(''); }}
                style={{
                  flex: 1, paddingVertical: 14, alignItems: 'center',
                  borderBottomWidth: tab === t ? 2 : 0,
                  borderBottomColor: Colors.primary,
                  backgroundColor: tab === t ? 'rgba(90,90,64,0.03)' : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  color: tab === t ? Colors.primary : Colors.textMuted,
                }}>
                  {t === 'login' ? 'Sign In' : 'Register'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Form */}
          <View style={{
            backgroundColor: Colors.white, paddingHorizontal: Spacing.xxl,
            paddingVertical: Spacing.xxl,
            borderBottomLeftRadius: BorderRadius.xxl,
            borderBottomRightRadius: BorderRadius.xxl,
          }}>
            {tab === 'login' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor={Colors.textLight}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={v => { setEmail(v); setError(''); }}
                />
                <View style={{ position: 'relative' }}>
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor={Colors.textLight}
                    secureTextEntry={!showPw}
                    value={password}
                    onChangeText={v => { setPassword(v); setError(''); }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 14, top: 16 }}
                  >
                    <Text style={{ color: Colors.textMuted, fontSize: 12 }}>
                      {showPw ? 'Hide' : 'Show'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {!!error && (
                  <Text style={{ color: Colors.danger, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
                    {error}
                  </Text>
                )}

                <TouchableOpacity
                  onPress={() => handleLogin()}
                  disabled={loading}
                  style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>SIGN IN</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate('ForgotPassword')}
                  style={{ alignItems: 'center', paddingVertical: 8 }}
                >
                  <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>Forgot password?</Text>
                </TouchableOpacity>

                {/* Demo accounts */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 12 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
                  <Text style={{ marginHorizontal: 12, fontSize: 10, fontWeight: '700', color: Colors.textLight, letterSpacing: 1 }}>
                    QUICK DEMO
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {DEMO_ACCOUNTS.map(d => (
                    <TouchableOpacity
                      key={d.role}
                      onPress={() => handleLogin(d.email, d.password)}
                      disabled={loading}
                      style={{
                        flex: 1, alignItems: 'center', gap: 6,
                        backgroundColor: Colors.background, borderWidth: 1,
                        borderColor: Colors.border, borderRadius: BorderRadius.lg,
                        paddingVertical: 12, paddingHorizontal: 4,
                      }}
                    >
                      <View style={{
                        width: 32, height: 32, borderRadius: BorderRadius.md,
                        backgroundColor: 'rgba(90,90,64,0.1)',
                        justifyContent: 'center', alignItems: 'center',
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary }}>
                          {d.label[0]}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.textSecondary }}>
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Full name *"
                  placeholderTextColor={Colors.textLight}
                  value={regName}
                  onChangeText={v => { setRegName(v); setError(''); }}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email address *"
                  placeholderTextColor={Colors.textLight}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={regEmail}
                  onChangeText={v => { setRegEmail(v); setError(''); }}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Phone number (optional)"
                  placeholderTextColor={Colors.textLight}
                  keyboardType="phone-pad"
                  value={regPhone}
                  onChangeText={v => { setRegPhone(v); setError(''); }}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password (min 6 chars) *"
                  placeholderTextColor={Colors.textLight}
                  secureTextEntry={!showPw}
                  value={regPassword}
                  onChangeText={v => { setRegPassword(v); setError(''); }}
                />

                {/* Role selector */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {ROLES.map(r => (
                    <TouchableOpacity
                      key={r.key}
                      onPress={() => setRegRole(r.key)}
                      style={{
                        flex: 1, padding: 12, borderRadius: BorderRadius.lg,
                        borderWidth: 2,
                        borderColor: regRole === r.key ? Colors.primary : Colors.border,
                        backgroundColor: regRole === r.key ? 'rgba(90,90,64,0.05)' : 'transparent',
                      }}
                    >
                      <Text style={{
                        fontSize: 12, fontWeight: '700',
                        color: regRole === r.key ? Colors.primary : Colors.textSecondary,
                      }}>
                        {r.label}
                      </Text>
                      <Text style={{ fontSize: 10, color: Colors.textMuted, marginTop: 2 }}>
                        {r.desc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {!!error && (
                  <Text style={{ color: Colors.danger, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
                    {error}
                  </Text>
                )}

                <TouchableOpacity
                  onPress={handleRegister}
                  disabled={loading}
                  style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>CREATE ACCOUNT</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = {
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1.5,
  },
};
