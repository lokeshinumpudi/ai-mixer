<a href="#">
  <h1 align="center">AI Comparo</h1>
</a>

## Product Images

<p align="center">
  <img src="https://github.com/lokeshinumpudi/ai-mixer/blob/main/ai-mixer-light.png" alt="AI Mixer Light Theme" width="350"/>
  <br/>
  <em>Light Theme</em>
</p>
<p align="center">
  <img src="https://github.com/lokeshinumpudi/ai-mixer/blob/main/ai-mixer-dark.png" alt="AI Mixer Dark Theme" width="350"/>
  <br/>
  <em>Dark Theme</em>
</p>
<p align="center">
  <img src="https://github.com/lokeshinumpudi/ai-mixer/blob/main/model-selector.png" alt="Model Selector" width="350"/>
  <br/>
  <em>Model Selector</em>
</p>

<p align="center">
    AI Comparo is a comprehensive AI chat platform that lets you compare and interact with multiple AI models from different providers in one unified interface. Features offline-first architecture, anonymous user support, usage tracking, real-time streaming, and advanced artifacts generation with Supabase authentication.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#ai-models"><strong>AI Models</strong></a> ·
  <a href="#artifacts-system"><strong>Artifacts</strong></a> ·
  <a href="#pricing-tiers"><strong>Pricing</strong></a> ·
  <a href="#running-locally"><strong>Running Locally</strong></a>
</p>
<br/>

## Features

### 🤖 Multi-Provider AI Integration

- **AI SDK v5 Gateway** - Unified access to multiple AI providers through a single interface
- **Advanced Model Management** - Rich capability system with vision, reasoning, file uploads, and tool calling
- **Real-Time Streaming** - Concurrent model responses with real-time updates
- **Usage Tracking System** - Client-side cost computation with granular token and usage monitoring
- **Intelligent Context Management** - Dynamic token optimization for efficient API usage
- **Compare Mode** - Side-by-side model comparison with up to 3 models simultaneously

### 🎨 Artifacts System

- **Code Generation** - Interactive code editor with syntax highlighting and execution
- **Document Creation** - Rich text editor with markdown support and collaborative editing
- **Image Generation** - AI-powered image creation and editing capabilities
- **Spreadsheet Tools** - Dynamic data grid with CSV import/export functionality

### 🔐 Authentication & Authorization

- **Supabase Auth** - Secure OAuth authentication with Google login
- **Anonymous User Support** - Graceful handling of unauthenticated users
- **Route Protection** - Centralized access control with decorator patterns
- **User Tiers** - Free, Pro, and Anonymous plans with model access restrictions

### 🏗️ Modern Architecture

- **Next.js 15** - App Router with React 19 and Server Actions
- **TypeScript Strict Mode** - Full type safety with enhanced error checking
- **AI SDK v5** - Latest AI SDK with Gateway architecture and tool calling
- **Drizzle ORM** - Type-safe database operations with PostgreSQL
- **Supabase Integration** - Authentication, database, and real-time features
- **Offline-First** - Cache-first data loading with localStorage persistence
- **Real-time Streaming** - Concurrent model responses with SSE optimization
- **Usage Tracking** - Client-side cost computation and token management

### 🎯 Developer Experience

- **Cursor Rules** - Comprehensive AI assistant rules for consistent development patterns
- **Pre-commit Hooks** - Automated code quality enforcement with Husky
- **Linting & Formatting** - ESLint + Biome with strict CI validation
- **Database Migrations** - Automated schema management and version control
- **E2E Testing** - Playwright test suite for comprehensive validation
- **Type-Safe Architecture** - Full TypeScript coverage with strict mode

## AI Models

AI Comparo provides access to cutting-edge AI models through a unified gateway system with support for anonymous users and seamless tier-based access:

### Currently Supported Models

#### Free Models (All Tiers)

- **Amazon Nova Lite** - Fast, efficient model with vision capabilities
- **Google Gemini 2.0 Flash** - Advanced multimodal model with superior reasoning
- **Anthropic Claude 3.5 Haiku** - Balanced performance with strong reasoning

#### Pro Models (Paid Tier Only)

- **OpenAI GPT-5 Nano** - Lightweight conversational model
- **OpenAI GPT-5 Mini** - Enhanced model with file upload support
- **OpenAI GPT-OSS-20b** - Open-source optimized model
- **xAI Grok Code Fast** - Specialized coding and reasoning model
- **Moonshot AI Kimi K2** - Advanced conversational AI
- **Alibaba Qwen 3 32B** - Large language model for complex tasks
- **OpenAI GPT-4o Mini** - Vision-capable model with tool calling

### Model Capabilities

Models support various advanced capabilities:

#### Core Features (All Models)

- ✅ **Artifacts Generation** - Code, documents, images, and spreadsheets
- ✅ **Tool Calling** - Weather data, document management, and custom tools
- ✅ **Real-Time Streaming** - Concurrent responses with live updates
- ✅ **Context Optimization** - Intelligent token management for efficiency

#### Advanced Features (Model-Specific)

- 🖼️ **Vision Support** - Image analysis and understanding
- 📎 **File Uploads** - PDF processing and document analysis
- 🧠 **Advanced Reasoning** - Step-by-step problem solving
- 🔧 **Enhanced Tool Calling** - Weather, document management, and more

### Adding New Models

The platform uses the [AI SDK Gateway](https://sdk.vercel.ai/docs/ai-sdk-gateway) for easy provider integration. Add new models by updating the configuration in `lib/constants.ts` and `lib/ai/providers.ts`. The system automatically handles model capabilities, access control, and user tier restrictions.

## Compare Mode

AI Comparo features an advanced **Compare Mode** that allows you to interact with multiple AI models simultaneously:

### Key Features

- **Side-by-Side Comparison** - Up to 3 models responding to the same prompt
- **Real-Time Streaming** - Watch responses appear concurrently as models generate them
- **Curated Presets** - Quick access to popular model combinations:
  - **Fast Reasoning Trio**: Gemini 2.0 Flash + GPT-5 Nano + Grok Code Fast
  - **Vision Models**: Gemini 2.0 Flash + GPT-5 Mini + GPT-OSS-120b
  - **Code Specialists**: Grok Code Fast + GPT-5 Mini + Qwen 3 32B
  - **Balanced Duo**: Gemini 2.0 Flash + GPT-4o Mini
- **Unified Interface** - Single input field with smart model routing
- **Persistent History** - Compare conversations are saved and restorable
- **Cost Optimization** - Efficient token usage across multiple models

## Artifacts System

AI Comparo features a comprehensive artifacts system for generating and managing various content types:

### 📝 Text Documents

- Rich text editor with markdown support
- Real-time collaborative editing
- Version history and document management
- Export to multiple formats

### 💻 Code Generation

- Interactive code editor with syntax highlighting
- Support for multiple programming languages
- Live code execution and debugging
- Code sharing and collaboration

### 🖼️ Image Creation

- AI-powered image generation
- Image editing and manipulation tools
- Multiple format support (PNG, JPEG, SVG)
- Gallery management and organization

### 📊 Spreadsheet Tools

- Dynamic data grid interface
- CSV import/export functionality
- Formula support and calculations
- Data visualization capabilities

## Pricing Tiers

### 👤 Anonymous Users

- **20 messages per day** with free models
- Access to Amazon Nova Lite, Google Gemini 2.0 Flash, Anthropic Claude 3.5 Haiku
- Full artifacts system access
- Basic tool calling features
- Usage tracking with cost limits ($0.50, 5,000 tokens)
- Encourages signup for unlimited access

### 🆓 Free Plan

- **50 messages per day** with free models
- Access to all free models with advanced capabilities
- Full artifacts system with code, document, and image generation
- Enhanced tool calling (weather, document management)
- Usage tracking with cost limits ($1.00, 5,000 tokens)
- Vision support and file upload capabilities

### 💎 Pro Plan - ₹249/month

- **1000 messages per month** with all models
- Access to premium models (OpenAI GPT series, Moonshot AI, Alibaba Qwen)
- Advanced features: vision, file uploads, enhanced reasoning
- Priority support and faster responses
- Higher usage limits ($10.00, 100,000 tokens)
- Razorpay payment integration with webhook verification

## Running Locally

### Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL database (local or hosted)
- Environment variables configured

### Environment Setup

Create a `.env.local` file with the following variables:

```bash
# Database
POSTGRES_URL="postgresql://..."

# Supabase Authentication
NEXT_PUBLIC_SUPABASE_URL="your-supabase-project-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"



# Note: NEXT_PUBLIC_SITE_URL is not needed - URLs are constructed dynamically

#Storage
BLOB_READ_WRITE_TOKEN=""

#AI providers
AI_GATEWAY_API_KEY=""

# Payments (optional for development)
RAZORPAY_KEY_ID="your-razorpay-key"
RAZORPAY_KEY_SECRET="your-razorpay-secret"
NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL="your-payment-page-url"
RAZORPAY_WEBHOOK_SECRET="razorpay-webhook-secret-from-dashboard"
```

### Installation & Development

```bash
# Install dependencies
pnpm install

# Set up database
pnpm db:migrate

# Start development server
pnpm dev

# Optional: Open database studio
pnpm db:studio
```

### Development Commands

```bash
# Development
pnpm dev               # Start development server with Turbo
pnpm build             # Production build with database migration
pnpm start             # Start production server

# Code quality
pnpm lint              # Check linting and types
pnpm lint:fix          # Auto-fix linting issues
pnpm lint:check        # Strict linting check
pnpm format            # Format code with Biome
pnpm type-check        # TypeScript validation
pnpm pre-commit        # Run all pre-commit checks

# Database operations
pnpm db:generate       # Generate new migration
pnpm db:migrate        # Run migrations
pnpm db:studio         # Open Drizzle Studio
pnpm db:push           # Push schema changes
pnpm db:pull           # Pull schema from database

# Testing
pnpm test              # Run Playwright e2e tests
npx vitest run         # Run unit tests
npx vitest run lib/__tests__/  # Run specific unit tests
```

Your AI Comparo instance will be running on [localhost:3000](http://localhost:3000).

### Project Structure

```
app/                   # Next.js App Router
├── (auth)/           # Supabase authentication routes
├── (chat)/           # Chat interface and API routes
├── auth/             # Auth callback handling
└── billing/          # Payment integration with Razorpay
components/           # Reusable UI components (shadcn/ui + custom)
├── compare/          # Compare mode specific components
├── ui/               # shadcn/ui component library
└── usage/            # Usage tracking components
lib/                  # Core application logic
├── ai/              # AI SDK v5 Gateway integration and tools
├── db/              # Database schema, queries, and Drizzle ORM
├── supabase/        # Supabase authentication and client setup
├── auth-decorators.ts # Authentication decorators for API routes
├── constants.ts     # Model configurations and pricing
└── types.ts         # TypeScript type definitions
artifacts/           # Artifact implementations (text, code, image, sheet)
hooks/               # Custom React hooks
├── use-usage.ts     # Usage tracking and cost monitoring
├── use-compare-run.ts # Compare mode state management
├── use-models.ts    # Model management and settings
└── use-chat-data.ts # Optimized chat data loading
tests/               # End-to-end tests with Playwright
.cursor/rules/       # Cursor AI assistant rules and patterns
```

---

Built by [Lokesh Inumpudi](https://github.com/lokeshinumpudi) with ❤️ using Next.js 15 and the AI SDK.
