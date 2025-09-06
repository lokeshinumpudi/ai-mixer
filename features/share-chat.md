# Chat Sharing Feature - Final Design

## Overview

The chat sharing feature allows users to share their chat conversations with others through a simple, expandable share icon. Users can toggle between public (shareable) and private (owner-only) access modes with clear tooltips explaining the implications.

## Core Functionality

### Share Icon

- **Location**: Sticky positioned in the top-right corner of the chat interface
- **Appearance**: Clean share icon (🔗 or similar)
- **Behavior**: Click expands to show Public/Private options

### Sharing Options

#### Public Mode

- **Purpose**: Makes the chat accessible to anyone with the URL
- **Access Level**: Read-only for non-owners
- **URL Structure**: `/chat/[chatId]` (simple, no tokens)
- **Tooltip**: "Anyone with this link can view your chat in read-only mode until you switch back to private"

#### Private Mode

- **Purpose**: Restricts access to chat owner only
- **Access Level**: Full read/write access for owner
- **Security**: Existing ownership validation applies
- **Tooltip**: "Only you can access this chat"

## Technical Architecture

### Database Schema (Leveraging Existing)

```typescript
// Uses existing chat table
export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  // ... other fields
});
```

### API Endpoints

#### Existing: Update Chat Visibility

- **Endpoint**: `PATCH /api/chat/[id]/visibility`
- **Function**: `updateChatVisiblityById(chatId, visibility)`
- **Purpose**: Toggle between public/private modes

**Note**: No new API endpoints needed - the existing `/chat/[chatId]` URL becomes the shareable URL when visibility is set to "public"

### Access Control Logic

#### For Chat Owners

- Full read/write access regardless of visibility setting
- Can toggle between public/private modes
- Can generate share URLs when in public mode

#### For Non-Owner Visitors (Public Chats)

- Read-only access to chat content
- Cannot send new messages
- Cannot modify chat settings
- Clear visual indication of read-only status

#### For Private Chats

- Only chat owner can access
- 404 or access denied for non-owners
- Existing ownership validation applies

## User Experience Flow

### 1. Share Icon Interaction

```
User clicks share icon → Expandable menu appears
  ├── Public (with tooltip)
  └── Private (with tooltip)
```

### 2. Public Mode Activation

```
User selects Public →
  ├── API call: updateChatVisiblityById(chatId, "public")
  ├── Generate share URL: /chat/[chatId]
  ├── Copy URL to clipboard
  ├── Show success toast: "Link copied! Anyone with this link can view your chat in read-only mode"
```

### 3. Private Mode Activation

```
User selects Private →
  ├── API call: updateChatVisiblityById(chatId, "private")
  ├── Remove public access
  ├── Show success toast: "Chat is now private"
```

### 4. Visitor Experience (Public Chat)

```
Visitor accesses /chat/[chatId] →
  ├── Check if chat exists and is public
  ├── If public: Load chat in read-only mode
  ├── If private: Show "Chat not found" or access denied
  ├── Visual indicators: "Viewing shared chat (read-only)"
```

## Component Architecture

### ShareButton Component

```typescript
interface ShareButtonProps {
  chatId: string;
  currentVisibility: "public" | "private";
  onVisibilityChange: (visibility: "public" | "private") => void;
}

function ShareButton({ chatId, currentVisibility, onVisibilityChange }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)}>
        <ShareIcon />
      </button>

      {isOpen && (
        <ShareMenu
          chatId={chatId}
          currentVisibility={currentVisibility}
          onVisibilityChange={onVisibilityChange}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
```

### ShareMenu Component

```typescript
function ShareMenu({ chatId, currentVisibility, onVisibilityChange, onClose }) {
  const handlePublicClick = async () => {
    await onVisibilityChange("public");
    const url = `/chat/${chatId}`;
    await navigator.clipboard.writeText(window.location.origin + url);
    toast.success(
      "Link copied! Anyone with this link can view your chat in read-only mode"
    );
    onClose();
  };

  const handlePrivateClick = async () => {
    await onVisibilityChange("private");
    toast.success("Chat is now private");
    onClose();
  };

  return (
    <div className="absolute top-full right-0 mt-2 bg-white border rounded-lg shadow-lg p-2">
      <button
        onClick={handlePublicClick}
        className={`block w-full text-left px-3 py-2 rounded ${
          currentVisibility === "public" ? "bg-blue-50" : ""
        }`}
      >
        <div className="flex items-center gap-2">
          <GlobeIcon />
          <span>Public</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Anyone with the link can view in read-only mode
        </div>
      </button>

      <button
        onClick={handlePrivateClick}
        className={`block w-full text-left px-3 py-2 rounded ${
          currentVisibility === "private" ? "bg-blue-50" : ""
        }`}
      >
        <div className="flex items-center gap-2">
          <LockIcon />
          <span>Private</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Only you can access this chat
        </div>
      </button>
    </div>
  );
}
```

## Integration Points

### Chat Header Integration

- Add ShareButton to ChatHeader component
- Position: `absolute top-4 right-4` (sticky positioning)
- Ensure proper z-index for menu overlay

### Access Control Integration

- Update `useChatAccess` hook to handle read-only mode
- Modify chat page to show read-only indicators for non-owners
- Disable input for read-only visitors

### Chat Page Updates

```typescript
// In chat/[id]/page.tsx
const { chat, isReadOnly, error } = useChatData(id);
const { hasAccess, isOwner } = useChatAccess(chat, id, user);

// Show read-only indicator for non-owners of public chats
{
  !isOwner && chat?.visibility === "public" && (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2 text-blue-700">
        <EyeIcon className="w-4 h-4" />
        <span className="text-sm font-medium">
          Viewing shared chat (read-only)
        </span>
      </div>
    </div>
  );
}

// Disable input for read-only mode
<MultimodalInput
  disabled={isReadOnly}
  placeholder={
    isReadOnly ? "This is a shared chat (read-only)" : "Type your message..."
  }
  // ... other props
/>;
```

## Security Considerations

### Access Validation

- Server-side validation of chat ownership
- JWT-based authentication for API calls
- Proper error handling for unauthorized access

### Rate Limiting

- Limit share URL generation attempts
- Prevent abuse of visibility toggle API
- Monitor for suspicious access patterns

### Data Privacy

- No additional user data exposed in public mode
- Clear user consent through tooltip explanations
- Ability to revoke access by switching to private mode

## Error Handling

### Share URL Generation Failures

```typescript
try {
  await onVisibilityChange("public");
  const url = `${window.location.origin}/chat/${chatId}`;
  await navigator.clipboard.writeText(url);
  toast.success(
    "Link copied! Anyone with this link can view your chat in read-only mode"
  );
} catch (error) {
  toast.error("Failed to share chat. Please try again.");
}
```

### Access Control Errors

- **Chat Not Found**: 404 page with generic message
- **Access Denied**: Clear error message for private chats
- **Server Error**: Graceful fallback with retry option

## Mobile Responsiveness

### Touch-Friendly Design

- Adequate touch targets (44px minimum)
- Proper spacing for mobile dropdowns
- Swipe-to-dismiss for mobile menus

### Mobile Layout Considerations

- Share icon positioned to avoid mobile UI conflicts
- Dropdown menu adapts to screen size
- Toast notifications work on mobile

## Testing Strategy

### Unit Tests

- Share button component behavior
- Visibility toggle API calls
- URL generation and clipboard functionality
- Access control logic for different user types

### Integration Tests

- End-to-end sharing flow
- Public/private mode transitions
- Read-only access for shared chats
- Error handling scenarios

### User Acceptance Tests

- Anonymous user accessing shared chat
- Owner toggling between public/private
- Clipboard functionality across devices
- Mobile responsiveness

## Performance Considerations

### API Optimization

- Minimal payload for visibility updates
- Efficient database queries for access control
- Cached chat visibility state

### UI Performance

- Lazy loading of share menu components
- Optimized re-renders for visibility state changes
- Smooth animations for menu transitions

## Future Enhancements

### Potential Additions (Not in Current Scope)

- Share link expiration dates
- View analytics for shared chats
- Custom share messages
- Social media integration
- Bulk sharing capabilities

## Implementation Checklist

### Core Features ✅

- [ ] Share icon component with expandable menu
- [ ] Public/private toggle functionality
- [ ] Share URL generation and clipboard copy
- [ ] Read-only mode for shared chats
- [ ] Tooltips explaining access levels
- [ ] Mobile-responsive design

### Integration ✅

- [ ] Chat header integration
- [ ] Access control updates
- [ ] Read-only UI indicators
- [ ] Error handling
- [ ] Testing coverage

### Polish ✅

- [ ] Loading states
- [ ] Success/error feedback
- [ ] Accessibility support
- [ ] Performance optimization

This design provides a clean, user-friendly sharing experience while maintaining security and giving users clear control over their chat visibility. The expandable share icon with tooltips ensures users understand the implications of their sharing choices.
