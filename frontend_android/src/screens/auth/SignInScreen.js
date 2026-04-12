import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { login, register } from '../../api/client';
import { Colors, BorderRadius, Spacing, Shadow } from '../../constants/theme';
import { DEMO_ACCOUNTS } from '../../constants/config';
import LanguageSelector from '../../components/LanguageSelector';

const ROLES = [
  { key: 'customer', label: 'Customer', desc: 'Browse shops & order', icon: 'storefront-outline' },
  { key: 'owner', label: 'Shop Owner', desc: 'List & manage your shop', icon: 'briefcase-outline' },
];

function InputField({ label, icon, value, onChangeText, secureTextEntry, showToggle, onToggleShow, keyboardType, autoCapitalize, placeholder }) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      {label && (
        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 5 }}>
          {label.toUpperCase()}
        </Text>
      )}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.background, borderRadius: BorderRadius.md,
        paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border,
        gap: 8,
      }}>
        {icon && <Ionicons name={icon} size={16} color={Colors.textMuted} />}
        <TextInput
          style={{ flex: 1, fontSize: 14, color: Colors.textPrimary, paddingVertical: 13 }}
          placeholder={placeholder}
          placeholderTextColor={Colors.textLight}
          secureTextEntry={secureTextEntry}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType || 'default'}
          autoCapitalize={autoCapitalize || 'sentences'}
          autoCorrect={false}
        />
        {showToggle && (
          <TouchableOpacity onPress={onToggleShow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={secureTextEntry ? 'eye-outline' : 'eye-off-outline'} size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function SignInScreen({ navigation }) {
  const { signIn } = useApp();
  const [tab, setTab] = useState('login');
  const [showPw, setShowPw] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.');
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={{
            backgroundColor: Colors.primary,
            paddingHorizontal: Spacing.xxl, paddingTop: 48, paddingBottom: 36,
            borderBottomLeftRadius: BorderRadius.xxl, borderBottomRightRadius: BorderRadius.xxl,
          }}>
            {/* Language selector */}
            <View style={{ position: 'absolute', top: 16, right: Spacing.lg }}>
              <LanguageSelector />
            </View>

            <View style={{
              width: 56, height: 56, backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: BorderRadius.xl, justifyContent: 'center', alignItems: 'center',
              marginBottom: Spacing.lg,
            }}>
              <Ionicons name="storefront" size={26} color="#fff" />
            </View>
            <Text style={{ fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.5 }}>HyperMart</Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
              Your neighbourhood marketplace
            </Text>
          </View>

          <View style={{ padding: Spacing.lg }}>
            {/* Tab switcher */}
            <View style={{
              flexDirection: 'row', backgroundColor: Colors.backgroundAlt,
              borderRadius: BorderRadius.lg, padding: 4, marginBottom: Spacing.xl,
            }}>
              {[
                { key: 'login', label: 'Sign In' },
                { key: 'register', label: 'Register' },
              ].map(tb => (
                <TouchableOpacity
                  key={tb.key}
                  onPress={() => { setTab(tb.key); setError(''); }}
                  style={{
                    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: BorderRadius.md,
                    backgroundColor: tab === tb.key ? Colors.white : 'transparent',
                    ...( tab === tb.key ? Shadow.sm : {} ),
                  }}
                >
                  <Text style={{
                    fontSize: 13, fontWeight: '700',
                    color: tab === tb.key ? Colors.primary : Colors.textMuted,
                  }}>
                    {tb.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Login form */}
            {tab === 'login' ? (
              <View>
                <InputField
                  label="Email"
                  icon="mail-outline"
                  value={email}
                  onChangeText={v => { setEmail(v); setError(''); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="you@example.com"
                />
                <InputField
                  label="Password"
                  icon="lock-closed-outline"
                  value={password}
                  onChangeText={v => { setPassword(v); setError(''); }}
                  secureTextEntry={!showPw}
                  showToggle
                  onToggleShow={() => setShowPw(v => !v)}
                  placeholder="Your password"
                />

                {!!error && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 7,
                    backgroundColor: Colors.dangerBg, borderRadius: BorderRadius.md,
                    padding: Spacing.md, marginBottom: Spacing.md,
                  }}>
                    <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
                    <Text style={{ color: Colors.danger, fontSize: 13, fontWeight: '600', flex: 1 }}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => handleLogin()}
                  disabled={loading}
                  style={{
                    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
                    paddingVertical: 15, alignItems: 'center',
                    flexDirection: 'row', justifyContent: 'center', gap: 8,
                    opacity: loading ? 0.7 : 1, ...Shadow.md,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="log-in-outline" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 }}>Sign In</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate('ForgotPassword')}
                  style={{ alignItems: 'center', paddingVertical: 12 }}
                >
                  <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '600' }}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>

                {/* Demo accounts */}
                {DEMO_ACCOUNTS?.length > 0 && (
                  <View style={{ marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
                      <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
                      <Text style={{ marginHorizontal: 12, fontSize: 11, fontWeight: '700', color: Colors.textLight, letterSpacing: 1 }}>
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
                            backgroundColor: Colors.white, borderWidth: 1.5,
                            borderColor: Colors.border, borderRadius: BorderRadius.lg,
                            paddingVertical: 12, ...Shadow.sm,
                          }}
                        >
                          <View style={{
                            width: 34, height: 34, borderRadius: 17,
                            backgroundColor: Colors.primaryBg,
                            justifyContent: 'center', alignItems: 'center',
                          }}>
                            <Ionicons
                              name={d.role === 'admin' ? 'shield-outline' : d.role === 'owner' ? 'storefront-outline' : 'person-outline'}
                              size={16}
                              color={Colors.primary}
                            />
                          </View>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textSecondary }}>
                            {d.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              /* Register form */
              <View>
                <InputField
                  label="Full Name"
                  icon="person-outline"
                  value={regName}
                  onChangeText={v => { setRegName(v); setError(''); }}
                  placeholder="Your full name"
                />
                <InputField
                  label="Email"
                  icon="mail-outline"
                  value={regEmail}
                  onChangeText={v => { setRegEmail(v); setError(''); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="you@example.com"
                />
                <InputField
                  label="Phone (optional)"
                  icon="call-outline"
                  value={regPhone}
                  onChangeText={v => { setRegPhone(v); setError(''); }}
                  keyboardType="phone-pad"
                  placeholder="+91 ..."
                />
                <InputField
                  label="Password"
                  icon="lock-closed-outline"
                  value={regPassword}
                  onChangeText={v => { setRegPassword(v); setError(''); }}
                  secureTextEntry={!showRegPw}
                  showToggle
                  onToggleShow={() => setShowRegPw(v => !v)}
                  placeholder="Minimum 6 characters"
                />

                {/* Role selector */}
                <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 8 }}>
                  I WANT TO
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: Spacing.lg }}>
                  {ROLES.map(r => (
                    <TouchableOpacity
                      key={r.key}
                      onPress={() => setRegRole(r.key)}
                      style={{
                        flex: 1, padding: Spacing.md, borderRadius: BorderRadius.lg,
                        borderWidth: 2,
                        borderColor: regRole === r.key ? Colors.primary : Colors.border,
                        backgroundColor: regRole === r.key ? Colors.primaryBg : Colors.white,
                        gap: 6, alignItems: 'flex-start',
                      }}
                    >
                      <Ionicons
                        name={r.icon}
                        size={20}
                        color={regRole === r.key ? Colors.primary : Colors.textMuted}
                      />
                      <Text style={{
                        fontSize: 13, fontWeight: '700',
                        color: regRole === r.key ? Colors.primary : Colors.textPrimary,
                      }}>
                        {r.label}
                      </Text>
                      <Text style={{ fontSize: 11, color: Colors.textMuted }}>{r.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {!!error && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 7,
                    backgroundColor: Colors.dangerBg, borderRadius: BorderRadius.md,
                    padding: Spacing.md, marginBottom: Spacing.md,
                  }}>
                    <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
                    <Text style={{ color: Colors.danger, fontSize: 13, fontWeight: '600', flex: 1 }}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleRegister}
                  disabled={loading}
                  style={{
                    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
                    paddingVertical: 15, alignItems: 'center',
                    flexDirection: 'row', justifyContent: 'center', gap: 8,
                    opacity: loading ? 0.7 : 1, ...Shadow.md,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="person-add-outline" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 }}>Create Account</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
