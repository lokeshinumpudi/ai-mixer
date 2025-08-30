<a href="#">
  <h1 align="center">AI Comparo</h1>
</a>

<p align="center">
    AI Comparo is a comprehensive AI chat platform that lets you compare and interact with multiple AI models from different providers in one unified interface.
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

- **AI SDK Gateway** - Unified access to multiple AI providers through a single interface
- **Dynamic Model Management** - Capability-based features with real-time model switching
- **Streaming Responses** - Real-time chat with tool calling and structured outputs
- **Usage Tracking** - Message limits and billing integration with Razorpay

### 🎨 Artifacts System

- **Code Generation** - Interactive code editor with syntax highlighting and execution
- **Document Creation** - Rich text editor with markdown support and collaborative editing
- **Image Generation** - AI-powered image creation and editing capabilities
- **Spreadsheet Tools** - Dynamic data grid with CSV import/export functionality

### 🔐 Authentication & Authorization

- **Auth.js v5** - Secure authentication with session management
- **Route Protection** - Centralized access control with decorator patterns
- **User Tiers** - Free and Pro plans with model access restrictions
- **Session Configuration** - Type-safe duration management

### 🏗️ Modern Architecture

- **Next.js 15** - App Router with React Server Components and Server Actions
- **TypeScript Strict Mode** - Full type safety with enhanced error checking
- **Drizzle ORM** - Type-safe database operations with PostgreSQL
- **Real-time Updates** - SWR for data synchronization and optimistic updates

### 🎯 Developer Experience

- **Pre-commit Hooks** - Automated code quality enforcement with Husky
- **Linting & Formatting** - ESLint + Biome with strict CI validation
- **Database Migrations** - Automated schema management and version control
- **E2E Testing** - Playwright test suite for comprehensive validation

## AI Models

AI Comparo provides access to cutting-edge AI models through a unified gateway system:

### Currently Supported Models

- **Google Gemini 2.5 Flash Lite** - Fast, efficient model for general conversations (Free tier)
- **xAI Grok Code Fast** - Specialized coding model with enhanced reasoning (Pro tier)
- **xAI Grok 3 Mini** - Default conversational model with balanced performance

### Model Capabilities

All models support:

- ✅ **Reasoning** - Step-by-step problem solving and explanation
- ✅ **Artifacts** - Code, document, image, and spreadsheet generation
- ✅ **Tool Calling** - Weather data, document management, and more
- ✅ **Streaming** - Real-time response generation

### Adding New Models

The platform uses the [AI SDK Gateway](https://sdk.vercel.ai/docs/ai-sdk-gateway) for easy provider integration. Add new models by updating the configuration in `lib/constants.ts` and `lib/ai/providers.ts`.

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

### 🆓 Free Plan

- **20 messages per day** with basic models
- Access to Google Gemini 2.5 Flash Lite
- Full artifacts system access
- Basic tool calling features

### 💎 Pro Plan - ₹249/month

- **1000 messages per month** with all models
- Access to premium models (xAI Grok Code Fast)
- Priority support and faster responses
- Advanced features and integrations
- Razorpay payment integration

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

#Storage
BLOB_READ_WRITE_TOKEN=""

# Authentication
AUTH_SECRET="your-auth-secret"
NEXTAUTH_URL="http://localhost:3000"

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
# Code quality
pnpm lint              # Check linting and types
pnpm format            # Format code with Biome
pnpm type-check        # TypeScript validation

# Database operations
pnpm db:generate       # Generate new migration
pnpm db:migrate        # Run migrations
pnpm db:studio         # Open Drizzle Studio

# Testing
pnpm test              # Run Playwright e2e tests
```

Your AI Comparo instance will be running on [localhost:3000](http://localhost:3000).

### Project Structure

```
app/                   # Next.js App Router
├── (auth)/           # Authentication routes
└── (chat)/           # Chat interface and API
components/           # Reusable UI components
lib/                  # Core application logic
├── ai/              # AI SDK integration
├── db/              # Database schema and queries
└── auth/            # Authentication configuration
artifacts/           # Artifact system implementations
hooks/               # Custom React hooks
```

---

Built by [Lokesh Inumpudi](https://github.com/lokeshinumpudi) with ❤️ using Next.js 15 and the AI SDK.
