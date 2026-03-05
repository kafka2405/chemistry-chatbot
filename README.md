# Chatbot Hóa học - Trợ lý ảo cho học sinh phổ thông

Ứng dụng web chatbot giúp học sinh lớp 10-12 học Hóa học, sử dụng OpenAI Assistants API.

## Tính năng
- 💬 Chat trực tiếp với trợ lý ảo
- 📚 Trả lời dựa trên kiến thức SGK chính thống
- 🔐 Đăng nhập bảo mật (Demo)
- 🐳 Dễ dàng triển khai với Docker

## Yêu cầu
- Docker & Docker Compose
- Node.js (để chạy script setup)
- OpenAI API Key

## Cài đặt

### 1. Cấu hình
Tạo file `.env` tại thư mục `backend/` với nội dung:
```env
OPENAI_API_KEY=sk-proj-xxxx...
ASSISTANT_ID=asst_xxxx...
PORT=3000
```

### 2. Setup Assistant (Lần đầu)
Bước này giúp tạo Assistant trên OpenAI và "học" nội dung từ sách giáo khoa.

1. **Chuẩn bị dữ liệu**:
   - Copy file PDF sách giáo khoa (ví dụ: `HoaHoc10.pdf`, `HoaHoc11.pdf`) vào thư mục `backend/data/`.
   - *Lưu ý: Hệ thống chỉ đọc các file .pdf trong thư mục này.*

2. **Chạy script setup**:
```bash
cd backend
npm install
node setup_assistant.js
```
3. **Lấy ID**:
   - Script sẽ in ra `ASSISTANT_ID` (bắt đầu bằng `asst_...`).
   - Copy ID này và dán vào file `.env`: `ASSISTANT_ID=asst_...`

### 3. Khởi chạy ứng dụng
Tại thư mục gốc của dự án:
```bash
docker-compose up --build
```

### 4. Sử dụng
- Truy cập Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- **Tài khoản Demo**: 
    - Username: `admin`
    - Password: `123123`

## Cấu trúc dự án
- `backend/`: Node.js Express Server
- `frontend/`: Vue.js + Vite Client
- `docker-compose.yml`: Cấu hình Docker
