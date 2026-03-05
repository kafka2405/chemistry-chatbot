const OpenAI = require('openai');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function main() {
  console.log("Starting Assistant Setup...");

  // Check OpenAI version
  try {
    const packageJsonPath = path.join(__dirname, 'node_modules', 'openai', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log("OpenAI SDK Version:", packageJson.version);
    
    // Warn if version is too old
    const version = packageJson.version;
    const major = parseInt(version.split('.')[0]);
    const minor = parseInt(version.split('.')[1]);
    if (major < 4 || (major === 4 && minor < 20)) {
      console.warn("\n⚠️  WARNING: OpenAI SDK version is too old!");
      console.warn("Please run: npm install openai@latest\n");
    }
  } catch (e) {
    console.log("Could not check OpenAI version");
  }

  // 1. Upload files
  const dataDir = path.join(__dirname, 'data');
  let fileIds = [];

  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir).filter(file => 
      file.endsWith('.pdf') || file.endsWith('.txt')
    );
    console.log(`\nFound ${files.length} files in ${dataDir}`);

    for (const file of files) {
      console.log(`📤 Uploading ${file}...`);
      const fileStream = fs.createReadStream(path.join(dataDir, file));
      const openaiFile = await openai.files.create({
        file: fileStream,
        purpose: 'assistants',
      });
      fileIds.push(openaiFile.id);
      console.log(`   ✅ Uploaded (ID: ${openaiFile.id})`);
    }
  } else {
    console.log("\n⚠️  No data directory found, skipping file upload.");
    console.log("   Create backend/data/ and add PDF files if needed.");
  }

  // 2. Create Vector Store (with error handling)
  let vectorStoreId = null;
  if (fileIds.length > 0) {
    console.log("\n🗂️  Creating Vector Store...");
    
    try {
      // Check if vectorStores API exists
      if (!openai.beta.vectorStores) {
        throw new Error("vectorStores API not available. Please update OpenAI SDK: npm install openai@latest");
      }

      const vectorStore = await openai.beta.vectorStores.create({
        name: "SGK Hoa Hoc 10-12",
        file_ids: fileIds
      });
      vectorStoreId = vectorStore.id;
      console.log(`   ✅ Vector Store created (ID: ${vectorStoreId})`);

      // Wait for indexing to complete
      console.log("\n⏳ Waiting for files to be indexed...");
      let allCompleted = false;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds timeout

      while (!allCompleted && attempts < maxAttempts) {
        const files = await openai.beta.vectorStores.files.list(vectorStoreId);
        const statuses = files.data.map(f => f.status);
        allCompleted = statuses.every(s => s === 'completed');
        
        if (!allCompleted) {
          process.stdout.write('.');
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }
      console.log(allCompleted ? '\n   ✅ Indexing completed!' : '\n   ⚠️  Indexing timeout, but continuing...');

    } catch (error) {
      console.error("\n❌ Error creating Vector Store:", error.message);
      console.log("\n💡 Fallback: Creating assistant without file_search (files will still be attached)");
      vectorStoreId = null;
    }
  }

  // 3. Create Assistant
  console.log("\n🤖 Creating Assistant...");
  const instructions = `Bạn là trợ lý Hóa học cho học sinh phổ thông Việt Nam (lớp 10-12).

NHIỆM VỤ:
- Trả lời câu hỏi Hóa học bằng tiếng Việt
- Dựa trên sách giáo khoa đã upload (nếu có)
- Giải thích rõ ràng, từng bước
- Trích dẫn nguồn SGK khi có

QUY TẮC:
- LUÔN trả lời tiếng Việt
- Format đẹp với markdown
- Cân bằng phương trình chính xác
- Giải thích công thức chi tiết
- Nếu không biết, nói thẳng

VÍ DỤ:
"Phản ứng thế là phản ứng hóa học trong đó nguyên tử hay nhóm nguyên tử được thay thế bởi nguyên tử/nhóm khác.

📖 SGK Hóa 11, trang 45

Ví dụ: CH₄ + Cl₂ → CH₃Cl + HCl"`;

  // Configure assistant based on whether we have vector store
  const assistantConfig = {
    name: "Trợ lý Hóa học phổ thông",
    instructions: instructions,
    model: "gpt-4o-mini",
  };

  if (vectorStoreId) {
    // Use file_search with vector store
    assistantConfig.tools = [{ type: "file_search" }];
    assistantConfig.tool_resources = {
      file_search: {
        vector_store_ids: [vectorStoreId]
      }
    };
  } else if (fileIds.length > 0) {
    // Fallback: attach files directly to assistant (legacy method)
    console.log("   ℹ️  Using legacy file attachment method");
    assistantConfig.tools = [{ type: "retrieval" }]; // older API
    assistantConfig.file_ids = fileIds;
  } else {
    // No files, just use base model
    console.log("   ℹ️  No files attached, using base model only");
    assistantConfig.tools = [];
  }

  const assistant = await openai.beta.assistants.create(assistantConfig);

  console.log("\n" + "=".repeat(60));
  console.log("✅ SETUP COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📋 Configuration:");
  console.log(`   Assistant ID: ${assistant.id}`);
  if (vectorStoreId) {
    console.log(`   Vector Store ID: ${vectorStoreId}`);
  }
  console.log(`   Files uploaded: ${fileIds.length}`);
  console.log(`   Model: ${assistant.model}`);
  console.log("\n📝 Next steps:");
  console.log(`   1. Copy this to your .env file:`);
  console.log(`      ASSISTANT_ID=${assistant.id}`);
  if (vectorStoreId) {
    console.log(`      VECTOR_STORE_ID=${vectorStoreId}`);
  }
  console.log(`   2. Run: npm start`);
  console.log(`   3. Open: http://localhost:3000`);
  console.log("\n" + "=".repeat(60));
}

main().catch(error => {
  console.error("\n❌ Fatal Error:", error.message);
  console.error("\n🔍 Debug info:", error);
  process.exit(1);
});
