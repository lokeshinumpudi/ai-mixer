<h1 align="center">AI Comparo</h1>

<p align="center">
A unified playground for comparing and chatting with multiple AI models simultaneously — fast, intelligent, and beautifully designed.
</p>

---

##  Product Preview

<table align="center">
  <tr>
    <td align="center" style="padding:8px">
      <img src="https://github.com/lokeshinumpudi/ai-mixer/blob/main/ai-mixer-light.png" alt="AI Mixer Light Theme" width="300"/><br/>
      <em>Light Theme</em>
    </td>
    <td align="center" style="padding:8px">
      <img src="https://github.com/lokeshinumpudi/ai-mixer/blob/main/ai-mixer-dark.png" alt="AI Mixer Dark Theme" width="300"/><br/>
      <em>Dark Theme</em>
    </td>
    <td align="center" style="padding:8px">
      <img src="https://github.com/lokeshinumpudi/ai-mixer/blob/main/model-selector.png" alt="Model Selector" width="300"/><br/>
      <em>Multi Model Selector</em>
    </td>
  </tr>
</table>


---

##  Key Highlights

###  Unified AI Hub  
Access and compare models from OpenAI, Google, Anthropic, xAI, Alibaba, and more — all through a single **AI SDK v5 Gateway**.

### ⚡ Parallel Model Streaming  
Watch multiple models generate responses **in real-time**, side-by-side.  
Up to **3 concurrent models** with synchronized streaming for instant comparison.

### Artifacts System  
Create directly within the app —  
- **Code:** Live editor with syntax highlighting and execution  
- **Docs:** Markdown-powered rich text  
- **Images:** AI generation and editing  
- **Sheets:** Smart data grids with import/export  

###  Smart Context & Usage Tracking  
Client-side cost tracking, token optimization, and efficient context handling.  
Every token is accounted for — intelligently.

###  Seamless Auth  
Supabase-powered Google login, anonymous guest access, and tier-based permissions (Free / Pro).

---

##  Architecture

- **Next.js 15 + React 18** — App Router, Server Actions, and Suspense streaming  
- **TypeScript Strict Mode** — End-to-end type safety  
- **Drizzle ORM + PostgreSQL** — Type-safe schema and migrations  
- **Supabase** — Auth, DB, and real-time sync  
- **AI SDK v5** — Gateway for model management and tool calling  
- **Offline-first** caching + **SSE** for low-latency streaming  
- **Razorpay** for payments and webhook verification  


## Run Locally

```bash
pnpm install
pnpm db:migrate
pnpm dev

Requires:
Node.js 18+
PostgreSQL
Supabase project credentials in .env.local
```

## Tech Stack
- **Frontend**: Next.js 15, React 18, Tailwind, shadcn/ui
- **Backend**: Supabase, Drizzle ORM, PostgreSQL
- **AI Gateway**: AI SDK v5 (multi-provider)
- **Payments**: Razorpay
- **Tooling**: Biome, ESLint, Playwright, Husky

## Credits
- Built by [Lokesh Inumpudi](https://www.linkedin.com/in/lokeshinumpudi)
