import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { aiChat } from '../api/client';
import { useApp } from '../context/AppContext';
import { Colors, BorderRadius, Spacing, Shadow } from '../constants/theme';

const QUICK_PROMPTS = [
  { label: '🛒 Nearby shops', prompt: 'What shops are available near me?' },
  { label: '📦 Track order', prompt: 'How do I track my order?' },
  { label: '💡 Recommendations', prompt: 'What products do you recommend?' },
];

export default function AIChatWidget() {
  const { currentUser, aiAvailable } = useApp();
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatRef = useRef();

  if (!aiAvailable) return null;

  const handleSend = async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || loading) return;
    const userMsg = { role: 'user', content: text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await aiChat(text, null, currentUser?.role || 'customer', history);
      const reply = res.data?.reply || res.data?.message || 'No response';
      setMessages(prev => [...prev, { role: 'assistant', content: reply, ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.', ts: Date.now(), error: true }]);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <>
      {/* FAB */}
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={{
          position: 'absolute', bottom: 80, right: 16,
          width: 54, height: 54, borderRadius: 27,
          backgroundColor: Colors.primary,
          justifyContent: 'center', alignItems: 'center',
          ...Shadow.lg,
        }}
      >
        <Ionicons name="sparkles" size={22} color="#fff" />
        {/* Pulse ring */}
        <View style={{
          position: 'absolute',
          width: 54, height: 54, borderRadius: 27,
          borderWidth: 2, borderColor: Colors.primary + '40',
          transform: [{ scale: 1.3 }],
        }} />
      </TouchableOpacity>

      {/* Chat modal */}
      <Modal visible={visible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{
            backgroundColor: Colors.white,
            borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl,
            height: '72%',
          }}>
            {/* Header */}
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
              borderBottomWidth: 1, borderBottomColor: Colors.border,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: Colors.primary,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Ionicons name="sparkles" size={16} color="#fff" />
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: Colors.textPrimary }}>AI Assistant</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success }} />
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>Powered by Gemini</Text>
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {messages.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setMessages([])}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={22} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Messages */}
            <FlatList
              ref={flatRef}
              data={messages}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={{ padding: Spacing.lg, flexGrow: 1 }}
              ListEmptyComponent={
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 32, paddingBottom: 16 }}>
                  <View style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: Colors.primaryBg,
                    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
                  }}>
                    <Ionicons name="sparkles-outline" size={24} color={Colors.primary} />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 }}>
                    Ask me anything
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 }}>
                    I can help with orders, products,{'\n'}shops, and more.
                  </Text>

                  {/* Quick prompts */}
                  <View style={{ width: '100%', gap: 8, marginTop: Spacing.xl }}>
                    {QUICK_PROMPTS.map((qp, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => handleSend(qp.prompt)}
                        style={{
                          backgroundColor: Colors.background, borderRadius: BorderRadius.lg,
                          paddingHorizontal: Spacing.md, paddingVertical: 10,
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                          borderWidth: 1, borderColor: Colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: Colors.textSecondary, fontWeight: '500' }}>
                          {qp.label}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              }
              renderItem={({ item }) => (
                <View style={{
                  alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  marginBottom: Spacing.md,
                }}>
                  {item.role === 'assistant' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      <View style={{
                        width: 18, height: 18, borderRadius: 9,
                        backgroundColor: Colors.primary,
                        justifyContent: 'center', alignItems: 'center',
                      }}>
                        <Ionicons name="sparkles" size={10} color="#fff" />
                      </View>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.textMuted }}>AI</Text>
                    </View>
                  )}
                  <View style={{
                    backgroundColor: item.role === 'user'
                      ? Colors.primary
                      : item.error ? Colors.dangerBg : Colors.background,
                    borderRadius: BorderRadius.lg,
                    borderBottomRightRadius: item.role === 'user' ? 4 : BorderRadius.lg,
                    borderBottomLeftRadius: item.role === 'assistant' ? 4 : BorderRadius.lg,
                    padding: Spacing.md,
                  }}>
                    <Text style={{
                      fontSize: 13, lineHeight: 20,
                      color: item.role === 'user' ? '#fff' : item.error ? Colors.danger : Colors.textPrimary,
                    }}>
                      {item.content}
                    </Text>
                  </View>
                  {item.ts && (
                    <Text style={{
                      fontSize: 9, color: Colors.textLight, marginTop: 3,
                      alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
                    }}>
                      {formatTime(item.ts)}
                    </Text>
                  )}
                </View>
              )}
            />

            {/* Typing indicator */}
            {loading && (
              <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: 4 }}>
                <View style={{
                  alignSelf: 'flex-start',
                  backgroundColor: Colors.background,
                  borderRadius: BorderRadius.lg, borderBottomLeftRadius: 4,
                  paddingHorizontal: 14, paddingVertical: 10,
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                }}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>Typing…</Text>
                </View>
              </View>
            )}

            {/* Input */}
            <View style={{
              flexDirection: 'row', alignItems: 'flex-end', gap: 8,
              padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border,
            }}>
              <View style={{
                flex: 1, backgroundColor: Colors.background, borderRadius: BorderRadius.lg,
                paddingHorizontal: 14, paddingVertical: 2, minHeight: 44,
                justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
              }}>
                <TextInput
                  style={{ fontSize: 14, color: Colors.textPrimary, maxHeight: 80, paddingVertical: 8 }}
                  placeholder="Ask anything..."
                  placeholderTextColor={Colors.textLight}
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={() => handleSend()}
                  returnKeyType="send"
                  multiline
                />
              </View>
              <TouchableOpacity
                onPress={() => handleSend()}
                disabled={!input.trim() || loading}
                style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: input.trim() && !loading ? Colors.primary : Colors.border,
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <Ionicons name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
