<script setup>
import { computed } from 'vue';
import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import 'katex/dist/katex.min.css';

// Configure marked with KaTeX extension — nonStandard cho phép nhận diện $...$
marked.use(markedKatex({
  throwOnError: false,
  output: 'html',
  nonStandard: true,
}));

const props = defineProps({
  message: {
    type: Object,
    required: true
  }
});

const isUser = computed(() => props.message.role === 'user');

const renderedContent = computed(() => {
  let content = props.message.content || '';

  // 1. Chuyển \[ ... \] → $$ ... $$ (block math)
  content = content.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
    return '$$' + math.trim() + '$$';
  });

  // 2. Chuyển \( ... \) → $ ... $ (inline math)
  content = content.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
    return '$' + math.trim() + '$';
  });

  // 3. Sửa lỗi $ có khoảng trắng thừa bên trong: $ ... $ → $...$
  // Giúp marked-katex-extension nhận diện đúng
  content = content.replace(/\$\s+([\s\S]*?)\s+\$/g, (match, math) => {
    // Tránh match nhầm $$ ... $$
    if (match.startsWith('$$')) return match;
    return '$' + math.trim() + '$';
  });

  return marked.parse(content);
});
</script>

<template>
  <div :class="['flex w-full mb-4', isUser ? 'justify-end' : 'justify-start']">
    <div 
      :class="[
        'max-w-[85%] rounded-2xl px-4 py-3 shadow-sm',
        isUser 
          ? 'bg-blue-600 text-white rounded-br-none' 
          : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
      ]"
    >
      <!-- Message Content -->
      <div 
        class="prose prose-sm max-w-none break-words"
        :class="{ 'prose-invert': isUser }"
        v-html="renderedContent"
      ></div>

      <!-- Citations (only for assistant) -->
       <div v-if="!isUser && message.citations && message.citations.length > 0" class="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
         <p class="font-medium mb-1">📚 Nguồn tham khảo:</p>
         <ul class="list-disc pl-4 space-y-1">
           <li v-for="(citation, index) in message.citations" :key="index">
             {{ citation }}
           </li>
         </ul>
       </div>
    </div>
  </div>
</template>
