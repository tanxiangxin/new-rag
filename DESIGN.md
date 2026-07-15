# RAG 知识库问答系统 — 设计方案

## 一、系统架构总览

```
┌──────────────┐      SSE/JSON      ┌───────────────┐
│  前端 (React) │ ◄──────────────► │  后端 (FastAPI) │
│  Vite + TW   │      REST API     │   LangChain    │
└──────────────┘                   └───────┬───────┘
                                           │
                          ┌────────────────┼────────────────┐
                          ▼                ▼                ▼
                     ┌─────────┐    ┌──────────┐    ┌──────────┐
                     │ SQLite  │    │ ChromaDB │    │ 本地磁盘  │
                     │ 会话/元  │    │ 向量存储 │    │ 文件存储  │
                     │ 数据管  │    │          │    │  data/   │
                     │ 理     │    │          │    │          │
                     └─────────┘    └──────────┘    └──────────┘
```

| 层级 | 技术 | 职责 |
|------|------|------|
| 前端 | React 19 + Vite + Tailwind CSS 4 | 用户界面，流式对话展示 |
| 后端 | FastAPI + LangChain + SSE | API 服务，RAG 流程编排 |
| 向量库 | ChromaDB | 文档向量存储与相似度检索 |
| 元数据 | SQLite | 会话/知识库/文档/消息的 CRUD |
| 文件存储 | 本地 `data/` 目录 | 上传文件持久化 |

---

## 二、项目结构

```
rag-qa/
├── .env                          # OpenAI 等配置
├── .env.example                  # 配置模板
├── requirements.txt              # Python 依赖
├── DESIGN.md                     # 本文档
├── start.sh                      # 一键启动脚本
├── data/                         # 上传文件存储
│   └── {kb_id}/{filename}
├── db/                           # SQLite + Chroma 持久化
│   ├── rag.db                    # SQLite 数据库文件
│   └── chroma/                   # ChromaDB 持久化目录
├── backend/
│   ├── __init__.py
│   ├── main.py                   # FastAPI 入口，注册路由，CORS
│   ├── config.py                 # 从 .env 读取配置
│   ├── database.py               # SQLite 建表与 CRUD 操作
│   ├── models.py                 # Pydantic 请求/响应模型
│   ├── router/
│   │   ├── __init__.py
│   │   ├── knowledge_base.py     # 知识库 CRUD
│   │   ├── document.py           # 文件上传/删除
│   │   ├── session.py            # 会话 CRUD
│   │   └── chat.py               # 流式问答 SSE
│   └── service/
│       ├── __init__.py
│       ├── loader.py             # 文档解析器 (PDF/Word/TXT)
│       ├── vector_store.py       # ChromaDB 集合管理
│       └── rag_chain.py          # 检索 + 生成链（流式）
├── frontend/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx               # 主布局（侧边栏 + 聊天区）
│       ├── index.css             # Tailwind 入口
│       ├── components/
│       │   ├── Sidebar.jsx       # 左侧面板（知识库 + 会话列表）
│       │   ├── ChatArea.jsx      # 聊天主区域（消息流 + 输入框）
│       │   ├── MessageBubble.jsx # 消息气泡（含来源引用）
│       │   ├── UploadDialog.jsx  # 文件上传弹窗
│       │   └── KnowledgePanel.jsx# 知识库管理面板
│       └── hooks/
│           └── useChat.js        # SSE 流式请求 Hook
└── README.md
```

---

## 三、数据库设计 (SQLite)

### 3.1 ER 关系

```
knowledge_bases  1 ── N   documents
knowledge_bases  1 ── N   sessions
knowledge_bases  1 ── 1   chroma_collection (同名)
sessions         1 ── N   messages
```

### 3.2 表结构

#### knowledge_bases

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (UUID) | 主键 |
| name | TEXT | 知识库名称 |
| description | TEXT | 描述 |
| doc_count | INTEGER | 文档数量 |
| chunk_count | INTEGER | 向量分块数量 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

#### documents

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (UUID) | 主键 |
| kb_id | TEXT (UUID) | 所属知识库 ID |
| filename | TEXT | 原始文件名 |
| file_type | TEXT | 类型 (pdf/docx/txt) |
| file_size | INTEGER | 文件大小 (bytes) |
| chunk_count | INTEGER | 分块数量 |
| created_at | DATETIME | 创建时间 |

#### sessions

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (UUID) | 主键 |
| kb_id | TEXT (UUID) | 关联的知识库 ID |
| name | TEXT | 会话名称 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 最后活动时间 |

#### messages

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (UUID) | 主键 |
| session_id | TEXT (UUID) | 所属会话 ID |
| role | TEXT | user 或 assistant |
| content | TEXT | 消息内容 |
| sources | TEXT (JSON) | 引用来源信息 |
| tokens | INTEGER | token 数 |
| created_at | DATETIME | 创建时间 |

---

## 四、API 接口设计

### 4.1 知识库管理

| 方法 | 路径 | 功能 | 请求体 |
|------|------|------|--------|
| POST | `/api/knowledge-bases` | 创建知识库 | `{name, description?}` |
| GET | `/api/knowledge-bases` | 获取知识库列表 | — |
| GET | `/api/knowledge-bases/{id}` | 获取知识库详情 | — |
| DELETE | `/api/knowledge-bases/{id}` | 删除知识库（含向量） | — |

### 4.2 文档管理

| 方法 | 路径 | 功能 | 请求体 |
|------|------|------|--------|
| POST | `/api/knowledge-bases/{id}/documents` | 上传文件 | multipart/form-data |
| GET | `/api/knowledge-bases/{id}/documents` | 获取文档列表 | — |
| DELETE | `/api/knowledge-bases/{id}/documents/{doc_id}` | 删除文档 | — |

### 4.3 会话管理

| 方法 | 路径 | 功能 | 请求体 |
|------|------|------|--------|
| POST | `/api/sessions` | 创建会话 | `{kb_id?, name?}` |
| GET | `/api/sessions` | 获取会话列表 | — |
| GET | `/api/sessions/{id}` | 获取会话详情（含消息） | — |
| PATCH | `/api/sessions/{id}` | 修改会话名称 | `{name}` |
| DELETE | `/api/sessions/{id}` | 删除会话 | — |

### 4.4 问答

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/chat/stream` | 流式问答 (SSE) |

**请求体：**
```json
{
  "session_id": "uuid",
  "knowledge_base_id": "uuid",
  "question": "RAG 的原理是什么？"
}
```

**SSE 响应格式：**
```
data: {"type":"token","content":"RAG"} \n
data: {"type":"token","content":" 的全称是"} \n
data: {"type":"token","content":" Retrieval-Augmented"} \n
data: {"type":"token","content":" Generation..."} \n
data: {"type":"done","sources":[{"filename":"doc.pdf","content":"第3段原文..."}]} \n
```

---

## 五、核心业务流程

### 5.1 上传文件 → 索引

```
用户选择知识库 → 上传文件 (multipart)
    │
    ▼
后端接收文件 → 保存到 data/{kb_id}/{filename}
    │
    ▼
识别文件类型 (pdf/docx/txt) → 调用对应 Loader 解析
    │
    ▼
RecursiveCharacterTextSplitter 分块 (chunk_size=1000, overlap=200)
    │
    ▼
OpenAIEmbeddings 向量化 → 存入 ChromaDB collection
    │
    ▼
更新 SQLite：
  - documents 表新增记录
  - knowledge_bases 更新 doc_count / chunk_count
```

### 5.2 问答流程（流式）

```
用户输入问题 + 选定知识库 + 会话
    │
    ▼
从 SQLite 加载会话历史（最近 10 轮）
    │
    ▼
OpenAIEmbeddings 问题向量化
    │
    ▼
ChromaDB 检索相似 Top-K（默认 k=4）
    │
    ▼
组装 Prompt：
  System: 你是一个知识库助手，基于以下上下文回答问题...
  Context: [检索到的 K 个文本块，含文件名]
  History: [最近对话历史]
  User: [当前问题]
    │
    ▼
调用 OpenAI 流式 API (stream=True)
    │
    ▼
通过 SSE 逐 token 推送到前端
    │
    ▼
前端逐字渲染到 MessageBubble
    │
    ▼
回答完成后，保存完整消息 + 来源到 messages 表
```

### 5.3 知识库管理

```
创建知识库:
  1. SQLite 插入一条 knowledge_bases 记录
  2. ChromaDB 创建一个同名 collection (kb_{id})

删除知识库:
  1. ChromaDB 删除对应 collection
  2. SQLite 删除关联的 documents / sessions / messages
  3. 删除 data/{kb_id}/ 目录
  4. SQLite 删除 knowledge_bases 记录
```

---

## 六、ChromaDB 集合映射方案

| 概念 | 实现 |
|------|------|
| 一个知识库 | ChromaDB 中的一个 Collection |
| Collection 命名规则 | `kb_{knowledge_base_id}` |
| 文档向量 metadata | `{doc_id, filename, chunk_index}` |
| 检索范围 | 在当前选中知识库的 collection 内检索 |
| 删除文档 | 根据 metadata.doc_id 过滤删除 |

---

## 七、前端 UI 布局

```
┌──────────────────────────────────────────────┐
│  RAG 知识库问答系统                       ⚙  │
├──────────────┬───────────────────────────────┤
│  📚 知识库    │  ＋ 新建会话                  │
│  ┌─────────┐ │  ┌─────────────────────────┐  │
│  │ ● 技术文 │ │  │                         │  │
│  │   档     │ │  │  用户: RAG 是什么？     │  │
│  │ ○ 产品手 │ │  │                         │  │
│  │   册     │ │  │  AI: RAG (Retrieval-   │  │
│  │ ＋ 新建  │ │  │  Augmented Generation) │  │
│  └─────────┘ │  │  是检索增强生成技术...  │  │
│              │  │                         │  │
│  💬 会话列表 │  │  📎 来源:               │  │
│  ┌─────────┐ │  │   ① 技术文档.pdf 第3页  │  │
│  │ 会话 1  │ │  │   ② 技术文档.pdf 第5页  │  │
│  │ 会话 2  │ │  │                         │  │
│  └─────────┘ │  └─────────────────────────┘  │
│              │  ┌─────────────────────────┐  │
│              │  │  ▸ 输入问题...  [发送]  │  │
│              │  └─────────────────────────┘  │
└──────────────┴───────────────────────────────┘
```

### 交互说明

- **知识库列表**：点击切换选中，右键/悬停显示操作菜单（上传文件、删除、重建索引）
- **会话列表**：点击切换会话，底部「新建会话」按钮
- **聊天区**：消息按时间排列，AI 回答流式打字效果，来源引用以角标 [1][2] 展示，点击可查看原文片段
- **文件上传**：点击知识库旁的「上传」按钮弹出 UploadDialog，支持多文件、拖拽上传，显示上传进度
- **知识库管理**：点击顶部 ⚙ 打开 KnowledgePanel，可查看详情、删除、重建

---

## 八、技术要点

### 后端关键依赖

```
langchain, langchain-community, langchain-openai  → RAG 框架
chromadb                                            → 向量数据库
openai                                              → LLM 客户端
fastapi + uvicorn                                   → Web 服务
python-dotenv                                       → 环境变量管理
pymupdf                                             → PDF 解析
python-docx                                         → Word 解析
sse-starlette                                       → SSE 流式支持
```

### 前端关键依赖

```
react + react-dom   → UI 框架
vite + @vitejs/plugin-react  → 构建工具
tailwindcss + @tailwindcss/vite  → 样式
```

### 配置项 (.env)

```env
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
TOP_K=4
```

---

## 九、实施步骤

| 阶段 | 内容 | 模块 |
|------|------|------|
| 1 | 后端基础设施：config.py / database.py / models.py / main.py | backend |
| 2 | 知识库 + 文档 API：CRUD 路由与逻辑 | router |
| 3 | 文档加载与向量化：loader.py / vector_store.py | service |
| 4 | 流式问答链 + SSE 推送：rag_chain.py / chat.py | service + router |
| 5 | 会话管理 API + 历史消息存储 | router |
| 6 | 前端框架搭建 + 布局：App.jsx / Sidebar / ChatArea | frontend |
| 7 | 前端文件上传 + 知识库管理面板 | frontend |
| 8 | 前端流式对话 + SSE 消费 | frontend |
| 9 | 集成测试与调试 | 全局 |
