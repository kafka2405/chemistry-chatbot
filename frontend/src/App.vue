<script setup>
import { ref, onMounted, nextTick } from 'vue';
import axios from 'axios';
import ChatMessage from './components/ChatMessage.vue';

// Cấu hình axios gửi cookie
axios.defaults.withCredentials = true;

// ===== State =====
const currentView = ref('loading'); // loading, auth, chat, history, historyDetail
const authTab = ref('login'); // login, register

// Auth state
const user = ref(null);
const loginForm = ref({ username: '', password: '' });
const registerForm = ref({ username: '', password: '', name: '', grade: 10 });
const authError = ref('');
const authLoading = ref(false);

// Chat state
const messages = ref([]);
const inputMessage = ref('');
const isLoading = ref(false);
const threadId = ref(null);
const sessionId = ref(null);
const chatContainer = ref(null);

// History state
const historySessions = ref([]);
const historyDetail = ref(null);
const historyLoading = ref(false);

// ===== Auth Functions =====
const checkAuth = async () => {
  try {
    const res = await axios.get('/api/auth/me');
    user.value = res.data.user;
    currentView.value = 'chat';
    initThread();
  } catch {
    currentView.value = 'auth';
  }
};

const handleLogin = async () => {
  authError.value = '';
  authLoading.value = true;
  try {
    const res = await axios.post('/api/auth/login', loginForm.value);
    user.value = res.data.user;
    currentView.value = 'chat';
    initThread();
  } catch (err) {
    authError.value = err.response?.data?.error || 'Đăng nhập thất bại.';
  } finally {
    authLoading.value = false;
  }
};

const handleRegister = async () => {
  authError.value = '';
  authLoading.value = true;
  try {
    const res = await axios.post('/api/auth/register', registerForm.value);
    user.value = res.data.user;
    currentView.value = 'chat';
    initThread();
  } catch (err) {
    authError.value = err.response?.data?.error || 'Đăng ký thất bại.';
  } finally {
    authLoading.value = false;
  }
};

const logout = async () => {
  try {
    await axios.post('/api/auth/logout');
  } catch { /* ignore */ }
  user.value = null;
  messages.value = [];
  threadId.value = null;
  sessionId.value = null;
  currentView.value = 'auth';
};

// ===== Chat Functions =====
const initThread = async () => {
  try {
    const response = await axios.post('/api/threads/create');
    threadId.value = response.data.threadId;
    sessionId.value = null; // ChatSession sẽ được tạo khi gửi tin nhắn đầu tiên
    messages.value = [];
  } catch (error) {
    console.error('Failed to create thread:', error);
  }
};

const sendMessage = async () => {
  if (!inputMessage.value.trim() || isLoading.value) return;

  const userMsg = {
    id: Date.now().toString(),
    role: 'user',
    content: inputMessage.value
  };

  messages.value.push(userMsg);
  const currentInput = inputMessage.value;
  inputMessage.value = '';
  isLoading.value = true;
  scrollToBottom();

  try {
    const response = await axios.post('/api/chat', {
      threadId: threadId.value,
      message: currentInput,
      sessionId: sessionId.value || undefined
    });

    // Lưu sessionId từ response (tạo mới ở tin nhắn đầu tiên)
    if (response.data.sessionId) {
      sessionId.value = response.data.sessionId;
    }

    messages.value.push({
      id: response.data.messageId || Date.now().toString(),
      role: 'assistant',
      content: response.data.answer,
      citations: response.data.citations
    });
  } catch (error) {
    console.error('Chat error:', error);
    messages.value.push({
      id: Date.now().toString(),
      role: 'system',
      content: '⚠️ Có lỗi xảy ra, vui lòng thử lại.'
    });
  } finally {
    isLoading.value = false;
    scrollToBottom();
  }
};

const createNewChat = () => {
  messages.value = [];
  threadId.value = null;
  sessionId.value = null;
  initThread();
};

const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

// ===== History Functions =====
const loadHistory = async () => {
  historyLoading.value = true;
  currentView.value = 'history';
  try {
    const res = await axios.get('/api/history');
    historySessions.value = res.data.sessions;
  } catch (error) {
    console.error('History error:', error);
  } finally {
    historyLoading.value = false;
  }
};

const viewHistoryDetail = async (id) => {
  historyLoading.value = true;
  currentView.value = 'historyDetail';
  try {
    const res = await axios.get(`/api/history/${id}`);
    historyDetail.value = res.data;
  } catch (error) {
    console.error('History detail error:', error);
  } finally {
    historyLoading.value = false;
  }
};

const backToChat = () => {
  currentView.value = 'chat';
};

const backToHistory = () => {
  currentView.value = 'history';
};

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleString('vi-VN');
};

onMounted(() => {
  checkAuth();
});
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-50">

    <!-- Loading -->
    <div v-if="currentView === 'loading'" class="flex items-center justify-center h-full">
      <div class="text-center">
        <img src="/logo.jpeg" alt="Logo THPT Hàm Yên" class="w-20 h-20 mx-auto mb-4 rounded-full animate-pulse" />
        <p class="text-gray-500">Đang tải...</p>
      </div>
    </div>

    <!-- ============ AUTH VIEW ============ -->
    <div v-if="currentView === 'auth'" class="flex items-center justify-center h-full bg-gradient-to-br from-indigo-50 to-purple-50">
      <div class="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
        <div class="text-center mb-6">
          <img src="/logo.jpeg" alt="Logo THPT Hàm Yên" class="w-24 h-24 mx-auto mb-3 rounded-full shadow-md" />
          <h1 class="text-xl font-bold text-gray-800">Trợ lý Hóa học AI</h1>
          <p class="text-gray-500 text-sm mt-1">Trường THPT Hàm Yên — Tuyên Quang</p>
        </div>

        <!-- Tabs -->
        <div class="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            @click="authTab = 'login'; authError = ''"
            :class="authTab === 'login' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'"
            class="flex-1 py-2 text-sm font-medium rounded-md transition"
          >Đăng nhập</button>
          <button
            @click="authTab = 'register'; authError = ''"
            :class="authTab === 'register' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'"
            class="flex-1 py-2 text-sm font-medium rounded-md transition"
          >Đăng ký</button>
        </div>

        <!-- Login Form -->
        <form v-if="authTab === 'login'" @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tài khoản</label>
            <input v-model="loginForm.username" type="text" required
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              placeholder="Nhập tài khoản" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
            <input v-model="loginForm.password" type="password" required
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              placeholder="Nhập mật khẩu" />
          </div>
          <div v-if="authError" class="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{{ authError }}</div>
          <button type="submit" :disabled="authLoading"
            class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition shadow-md">
            {{ authLoading ? 'Đang xử lý...' : 'Đăng nhập' }}
          </button>
        </form>

        <!-- Register Form -->
        <form v-if="authTab === 'register'" @submit.prevent="handleRegister" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
            <input v-model="registerForm.name" type="text" required
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              placeholder="Nguyễn Văn A" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tài khoản</label>
            <input v-model="registerForm.username" type="text" required minlength="3"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              placeholder="Tên đăng nhập" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
            <input v-model="registerForm.password" type="password" required minlength="6"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              placeholder="Tối thiểu 6 ký tự" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Lớp</label>
            <select v-model="registerForm.grade"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white">
              <option :value="10">Lớp 10</option>
              <option :value="11">Lớp 11</option>
              <option :value="12">Lớp 12</option>
            </select>
          </div>
          <div v-if="authError" class="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{{ authError }}</div>
          <button type="submit" :disabled="authLoading"
            class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition shadow-md">
            {{ authLoading ? 'Đang xử lý...' : 'Đăng ký' }}
          </button>
        </form>
      </div>
    </div>

    <!-- ============ CHAT VIEW ============ -->
    <template v-if="currentView === 'chat'">
      <header class="bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shrink-0">
        <div class="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div class="flex items-center space-x-3">
            <img src="/logo.jpeg" alt="Logo" class="w-10 h-10 rounded-full border-2 border-white/30" />
            <div>
              <h1 class="text-lg font-bold leading-tight">Trợ lý Hóa học AI — THPT Hàm Yên</h1>
              <p class="text-xs text-white/70">Xin chào, {{ user?.name }} (Lớp {{ user?.grade }})</p>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <button @click="createNewChat"
              class="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition">
              ✨ Chat mới
            </button>
            <button @click="loadHistory"
              class="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition">
              📜 Lịch sử
            </button>
            <button @click="logout"
              class="px-3 py-1.5 bg-red-500/80 hover:bg-red-600 rounded-lg text-sm font-medium transition">
              Thoát
            </button>
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-hidden relative max-w-4xl w-full mx-auto">
        <div ref="chatContainer" class="h-full overflow-y-auto p-4 space-y-4 scroll-smooth">
          <!-- Welcome -->
          <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
            <img src="/logo.jpeg" alt="Logo THPT Hàm Yên" class="w-24 h-24 rounded-full shadow-lg mb-2" />
            <p class="text-lg font-medium">Xin chào! Bạn muốn hỏi gì về Hóa học hôm nay?</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg w-full text-sm">
              <button @click="inputMessage = 'Phản ứng thế là gì?'; sendMessage()"
                class="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-left shadow-sm">
                🧪 Phản ứng thế là gì?
              </button>
              <button @click="inputMessage = 'Cân bằng: Fe + H2SO4'; sendMessage()"
                class="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-left shadow-sm">
                ⚖️ Cân bằng: Fe + H2SO4
              </button>
            </div>
          </div>

          <!-- Messages -->
          <ChatMessage v-for="msg in messages" :key="msg.id" :message="msg" />

          <!-- Loading -->
          <div v-if="isLoading" class="flex justify-start mb-4">
            <div class="bg-white px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center space-x-2 border border-gray-100">
              <div class="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
              <div class="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
              <div class="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
            </div>
          </div>
        </div>
      </main>

      <footer class="bg-white border-t border-gray-100 p-4 shrink-0">
        <div class="max-w-4xl mx-auto">
          <form @submit.prevent="sendMessage" class="flex items-end space-x-2">
            <textarea v-model="inputMessage" @keydown.enter.exact.prevent="sendMessage"
              placeholder="Nhập câu hỏi Hóa học của bạn..." rows="1"
              class="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none max-h-32"
              style="min-height: 48px;"></textarea>
            <button type="submit" :disabled="!inputMessage.trim() || isLoading"
              class="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition shrink-0 shadow-sm">
              {{ isLoading ? '...' : 'Gửi' }}
            </button>
          </form>
          <div class="text-center mt-2 text-xs text-gray-400">
            THPT Hàm Yên — AI có thể mắc lỗi. Hãy kiểm tra lại thông tin quan trọng từ SGK.
          </div>
        </div>
      </footer>
    </template>

    <!-- ============ HISTORY LIST VIEW ============ -->
    <template v-if="currentView === 'history'">
      <header class="bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shrink-0">
        <div class="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div class="flex items-center space-x-3">
            <button @click="backToChat" class="text-white/80 hover:text-white transition">← Quay lại</button>
            <h1 class="text-lg font-bold">📜 Lịch sử trò chuyện</h1>
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto max-w-4xl w-full mx-auto p-4">
        <div v-if="historyLoading" class="text-center text-gray-500 py-12">Đang tải...</div>
        <div v-else-if="historySessions.length === 0" class="text-center text-gray-500 py-12">
          <div class="text-4xl mb-3">📭</div>
          <p>Chưa có lịch sử trò chuyện nào.</p>
        </div>
        <div v-else class="space-y-3">
          <button v-for="s in historySessions" :key="s.id" @click="viewHistoryDetail(s.id)"
            class="w-full text-left bg-white p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition">
            <div class="flex justify-between items-start">
              <div class="flex-1 min-w-0">
                <h3 class="font-medium text-gray-800 truncate">{{ s.title }}</h3>
                <p class="text-sm text-gray-500 mt-1">{{ s.messageCount }} tin nhắn • {{ formatDate(s.createdAt) }}</p>
              </div>
              <span class="text-gray-400 ml-2">→</span>
            </div>
          </button>
        </div>
      </main>
    </template>

    <!-- ============ HISTORY DETAIL VIEW ============ -->
    <template v-if="currentView === 'historyDetail'">
      <header class="bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shrink-0">
        <div class="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div class="flex items-center space-x-3">
            <button @click="backToHistory" class="text-white/80 hover:text-white transition">← Quay lại</button>
            <h1 class="text-lg font-bold truncate">{{ historyDetail?.title }}</h1>
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto max-w-4xl w-full mx-auto p-4 space-y-4">
        <div v-if="historyLoading" class="text-center text-gray-500 py-12">Đang tải...</div>
        <template v-else-if="historyDetail">
          <div class="text-center text-xs text-gray-400 mb-4">
            {{ formatDate(historyDetail.createdAt) }} • Chỉ xem, không thể chat tiếp
          </div>
          <ChatMessage v-for="(msg, index) in historyDetail.messages" :key="index" :message="msg" />
        </template>
      </main>
    </template>

  </div>
</template>
