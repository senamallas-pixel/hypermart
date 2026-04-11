import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal,
} from 'react-native';
import { aiChat } from '../api/client';
import { useApp } from '../context/AppContext';
import { Colors, BorderRadius, Spacing } from '../constants/theme';

export default function AIChatWidget() {
  const { currentUser, aiAvailable } = useApp();
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatRef = useRef();

  if (!aiAvailable) return null;

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await aiChat(userMsg.content, null, currentUser?.role || 'customer', history);
      const reply = res.data?.reply || res.data?.message || 'No response';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  return (
    <>
      {/* FAB */}
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={{
          position: 'absolute', bottom: 80, right: 16,
          width: 52, height: 52, borderRadius: 26,
          backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
          shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
        }}
      >
        <Text style={{ fontSize: 22 }}>{'\u2728'}</Text>
      </TouchableOpacity>

      {/* Chat modal */}
      <Modal visible={visible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{
            backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xxl,
            borderTopRightRadius: BorderRadius.xxl, height: '70%',
          }}>
            {/* Header */}
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border,
            }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700' }}>{'\u2728'} AI Assistant</Text>
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>Ask me anything about HyperMart</Text>
              </View>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Text style={{ fontSize: 18, color: Colors.textMuted }}>{'\u2715'}</Text>
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <FlatList
              ref={flatRef}
              data={messages}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={{ padding: Spacing.lg }}
              renderItem={({ item }) => (
                <View style={{
                  alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: item.role === 'user' ? Colors.primary : Colors.background,
                  borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm,
                  maxWidth: '80%',
                }}>
                  <Text style={{
                    fontSize: 13, lineHeight: 19,
                    color: item.role === 'user' ? '#fff' : Colors.textPrimary,
                  }}>
                    {item.content}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingTop: 40 }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>{'\uD83E\uDD16'}</Text>
                  <Text style={{ fontSize: 14, color: Colors.textMuted }}>Start a conversation</Text>
                </View>
              }
            />

            {/* Typing indicator */}
            {loading && (
              <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: 8 }}>
                <View style={{
                  alignSelf: 'flex-start', backgroundColor: Colors.background,
                  borderRadius: BorderRadius.lg, padding: 10,
                }}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              </View>
            )}

            {/* Input */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border,
            }}>
              <TextInput
                style={{
                  flex: 1, backgroundColor: Colors.background, borderRadius: BorderRadius.lg,
                  paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary,
                }}
                placeholder="Type a message..."
                placeholderTextColor={Colors.textLight}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={!input.trim() || loading}
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: input.trim() ? Colors.primary : Colors.border,
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{'\u2191'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
