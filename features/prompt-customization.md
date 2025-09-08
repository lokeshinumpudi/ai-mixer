# Customizable System Prompt Feature - Implementation Plan

## Overview

This document outlines the implementation plan for a customizable system prompt feature that allows users to define their own AI personality and behavior preferences. The system will collect user information and preferences, store them securely, and integrate them into AI conversations.

## 🎯 Core Requirements

### User Data Collection

- **User Name**: Basic identification
- **What they do**: Professional/role information
- **Traits**: Array of up to 50 personality traits (max 100 chars each)
- **Preferences**: Free-form text (max 3000 characters) for detailed instructions

### Technical Specifications

- ✅ **Scope**: Applied to all models uniformly
- ✅ **Storage**: JSON in existing user settings table
- ✅ **Integration**: Only compare/stream endpoint
- ✅ **Validation**: Client + Server + Database enforcement
- ✅ **Caching**: User prompts cached for performance
- ✅ **UI**: Simple form in settings customization tab

## 🏗️ System Architecture

### Database Schema

```typescript
// lib/db/schema.ts - No changes needed
// Uses existing userSettings.settings JSON field

interface UserSystemPrompt {
  name: string; // User name
  profession: string; // What they do
  traits: string[]; // Array of traits (max 50, each max 100 chars)
  preferences: string; // Free text (max 3000 chars)
  updatedAt: string; // ISO timestamp
}
```

### API Endpoints

```typescript
// PATCH /api/user/settings - Existing endpoint extended
// GET /api/models - Existing endpoint returns prompt data
```

### Data Flow

```
User Form → Client Validation → API Patch → DB Storage → Cache Update → AI Integration
    ↓           ↓              ↓         ↓          ↓            ↓
Settings → Zod Schema → Server Val → userSettings → SWR Cache → compare/stream
```

## 📋 Implementation Plan

### Phase 1: Database & Types (Foundation)

#### Tasks:

1. **Define TypeScript interfaces** in `lib/types.ts`
2. **Create Zod schemas** for validation in `lib/validations.ts`
3. **Update existing queries** to handle prompt data
4. **Test database operations**

### Phase 2: Backend Integration (API Layer)

#### Tasks:

1. **Extend `/api/user/settings`** with prompt validation
2. **Update `/api/models`** to include prompt data in response
3. **Add prompt caching** in API layer
4. **Integrate with compare/stream** endpoint
5. **Test API endpoints**

### Phase 3: Frontend Components (UI Layer)

#### Tasks:

1. **Create prompt form component** (`SystemPromptForm.tsx`)
2. **Add to customization tab** in settings page
3. **Implement real-time validation** with character counts
4. **Add loading states** and error handling
5. **Test form interactions**

### Phase 4: AI Integration (Core Logic)

#### Tasks:

1. **Update system prompt builder** in `lib/ai/prompts.ts`
2. **Modify compare/stream** to use custom prompts
3. **Test prompt injection** with different scenarios
4. **Performance optimization**

### Phase 5: Testing & Optimization (Polish)

#### Tasks:

1. **Unit tests** for validation and utilities
2. **Integration tests** for API endpoints
3. **E2E tests** for form functionality
4. **Performance testing** and optimization

## 🔧 Detailed Implementation

### 1. Database Layer

#### Schema Extension

```typescript
// No database changes needed - uses existing JSON field
// userSettings.settings will store UserSystemPrompt object
```

#### Query Functions

```typescript
// lib/db/queries.ts
export async function getUserSystemPrompt(
  userId: string
): Promise<UserSystemPrompt | null>;
export async function updateUserSystemPrompt(
  userId: string,
  prompt: UserSystemPrompt
): Promise<void>;
```

### 2. API Layer

#### Validation Schema

```typescript
// lib/validations.ts
export const systemPromptSchema = z.object({
  name: z.string().max(100).optional(),
  profession: z.string().max(200).optional(),
  traits: z.array(z.string().max(100)).max(50).optional(),
  preferences: z.string().max(3000).optional(),
});
```

#### API Integration

```typescript
// PATCH /api/user/settings - extend existing
const validatedPrompt = systemPromptSchema.parse(promptData);
await updateUserSystemPrompt(user.id, validatedPrompt);
```

### 3. Frontend Components

#### Form Component Structure

```tsx
// components/settings/SystemPromptForm.tsx
interface SystemPromptFormProps {
  initialData?: UserSystemPrompt;
  onSave: (data: UserSystemPrompt) => Promise<void>;
}

export function SystemPromptForm({
  initialData,
  onSave,
}: SystemPromptFormProps) {
  // Form implementation with validation
}
```

#### Settings Integration

```tsx
// app/(chat)/settings/page.tsx - Customization Tab
function CustomizationTab() {
  return (
    <div className="space-y-6">
      <SystemPromptForm />
      {/* Other customization options */}
    </div>
  );
}
```

### 4. AI Integration

#### Prompt Builder

```typescript
// lib/ai/prompts.ts
export function buildUserSystemPrompt(userPrompt: UserSystemPrompt): string {
  // Combine user data with existing system prompts
  const customPrompt = `
    User Information:
    - Name: ${userPrompt.name || "Not specified"}
    - Profession: ${userPrompt.profession || "Not specified"}
    - Personality Traits: ${userPrompt.traits?.join(", ") || "Not specified"}
    - Preferences: ${userPrompt.preferences || "Not specified"}
  `;

  return customPrompt;
}
```

#### Stream Integration

```typescript
// app/(chat)/api/compare/stream/route.ts
const userPrompt = await getUserSystemPrompt(user.id);
const customPrompt = userPrompt ? buildUserSystemPrompt(userPrompt) : "";

const fullSystemPrompt = `${existingSystemPrompt}\n\n${customPrompt}`;
```

## 📊 Data Validation Rules

### Client-Side Validation

- **Name**: Max 100 characters, optional
- **Profession**: Max 200 characters, optional
- **Traits**: Max 50 items, each max 100 characters
- **Preferences**: Max 3000 characters, optional

### Server-Side Validation

- Same limits as client with Zod schema
- Additional sanitization for security
- Database constraint enforcement

### Database Constraints

- JSON field validation in application code
- No database-level constraints (uses existing JSON field)

## 🚀 Performance Optimizations

### Caching Strategy

```typescript
// SWR cache for user prompts
const { data: userPrompt } = useSWR(
  `user-prompt-${userId}`,
  () => getUserSystemPrompt(userId),
  { revalidateOnFocus: false, dedupingInterval: 300000 }
);
```

### Memory Management

- Cache prompts for 5 minutes
- Automatic cleanup on user logout
- Lazy loading of prompt data

## 🔒 Security Considerations

### Input Sanitization

- Remove potentially harmful content
- HTML escaping for display
- Length limits prevent abuse

### Access Control

- Only authenticated users can set prompts
- Server-side user ownership validation
- No cross-user prompt access

## 🧪 Testing Strategy

### Unit Tests

```typescript
describe("SystemPromptForm", () => {
  test("validates character limits", () => {
    /* ... */
  });
  test("handles trait array limits", () => {
    /* ... */
  });
});

describe("buildUserSystemPrompt", () => {
  test("formats prompt correctly", () => {
    /* ... */
  });
  test("handles missing data gracefully", () => {
    /* ... */
  });
});
```

### Integration Tests

- Form submission and validation
- API endpoint functionality
- Database storage and retrieval
- AI prompt integration

### E2E Tests

- Complete user flow from form to AI response
- Error handling scenarios
- Performance validation

## 📈 Success Metrics

### Functional Metrics

- ✅ Form validation accuracy: 100%
- ✅ API response time: < 200ms
- ✅ Data persistence: 100%
- ✅ AI integration: 100%

### Performance Metrics

- ✅ Page load time: No degradation
- ✅ API latency: < 100ms cached, < 300ms uncached
- ✅ Memory usage: < 50KB per user session

### User Experience Metrics

- ✅ Form completion rate: > 90%
- ✅ Error rate: < 5%
- ✅ User satisfaction: > 4.5/5

## 🚨 Risk Mitigation

### Technical Risks

- **Database Migration**: No schema changes needed
- **API Compatibility**: Backward compatible
- **Performance Impact**: Cached to minimize impact

### Business Risks

- **Data Privacy**: User data encrypted at rest
- **Content Moderation**: Basic sanitization implemented
- **Cost Impact**: Minimal additional database usage

## 📅 Timeline Estimate

### Phase 1: Foundation (2-3 days)

- Database types and validation schemas
- Basic API integration

### Phase 2: Backend (2-3 days)

- API endpoint extensions
- Caching implementation
- AI integration

### Phase 3: Frontend (3-4 days)

- Form component development
- Settings page integration
- Responsive design

### Phase 4: Testing (2-3 days)

- Unit and integration tests
- Performance optimization
- Bug fixes

### Phase 5: Deployment (1 day)

- Production deployment
- Monitoring setup

**Total Estimate: 10-14 days**

## 🔄 Rollback Plan

### Quick Rollback

1. **Feature Flag**: Disable via environment variable
2. **Database**: No schema changes to rollback
3. **API**: Existing endpoints remain functional
4. **Frontend**: Conditional rendering in settings

### Gradual Rollback

1. **Soft Disable**: Hide form but keep data
2. **Data Migration**: Export user prompts if needed
3. **Complete Removal**: Delete code and database entries

## 📚 Documentation Updates

### User Documentation

- Settings page help text
- Prompt customization guide
- Best practices for writing prompts

### Developer Documentation

- API endpoint documentation
- Component usage examples
- Testing guidelines

## 🎯 Next Steps

1. **Approval**: Review and approve this implementation plan
2. **Kickoff**: Set up development environment
3. **Phase 1**: Start with database types and validation
4. **Daily Standups**: Regular progress updates
5. **Testing**: Comprehensive testing before deployment

---

## 📋 Implementation Checklist

### Pre-Implementation

- [ ] Plan review and approval
- [ ] Development environment setup
- [ ] Branch creation (`feature/system-prompt`)

### Phase 1: Foundation

- [ ] TypeScript interfaces in `lib/types.ts`
- [ ] Zod validation schemas in `lib/validations.ts`
- [ ] Database query functions in `lib/db/queries.ts`
- [ ] Unit tests for validation

### Phase 2: Backend

- [ ] Extend `/api/user/settings` endpoint
- [ ] Update `/api/models` response
- [ ] Implement caching in API layer
- [ ] Modify compare/stream integration
- [ ] Integration tests

### Phase 3: Frontend

- [ ] Create `SystemPromptForm` component
- [ ] Integrate into settings customization tab
- [ ] Implement real-time validation
- [ ] Add loading states and error handling
- [ ] E2E tests for form functionality

### Phase 4: AI Integration

- [ ] Update `lib/ai/prompts.ts` system prompt builder
- [ ] Test prompt injection in compare/stream
- [ ] Performance optimization
- [ ] Security review

### Phase 5: Testing & Deployment

- [ ] Complete test suite (unit, integration, E2E)
- [ ] Performance testing and optimization
- [ ] Production deployment
- [ ] Monitoring and alerting setup

---

_This implementation plan ensures a robust, scalable, and maintainable system prompt customization feature that integrates seamlessly with the existing AI chat platform._
