# Session Management Configuration

## Overview

This document outlines the centralized session management system that replaces hardcoded expiry values throughout the application. All session-related constants are now defined in `lib/auth/session-config.ts`.

## Configuration Structure

### Session Expiry Durations

```typescript
SESSION_CONFIG.EXPIRY = {
  DEFAULT: 24 * 60 * 60 * 1000, // 24 hours - Standard session
  SHORT: 60 * 60 * 1000, // 1 hour - Sensitive operations
  EXTENDED: 7 * 24 * 60 * 60 * 1000, // 7 days - Trusted environments
  REMEMBER_ME: 30 * 24 * 60 * 60 * 1000, // 30 days - Remember me sessions
  GUEST: 2 * 60 * 60 * 1000, // 2 hours - Guest users
};
```

### Data Retention Periods

```typescript
SESSION_CONFIG.ANALYTICS = {
  USAGE_HISTORY: 30 * 24 * 60 * 60 * 1000, // 30 days - Usage tracking
  ACTIVITY_LOG: 90 * 24 * 60 * 60 * 1000, // 90 days - Activity logs
  AUDIT_TRAIL: 365 * 24 * 60 * 60 * 1000, // 1 year - Audit trails
};
```

### Session Refresh Settings

```typescript
SESSION_CONFIG.REFRESH = {
  THRESHOLD: 2 * 60 * 60 * 1000, // Refresh when < 2 hours remain
  GRACE_PERIOD: 5 * 60 * 1000, // 5 minutes grace period
};
```

## Usage Examples

### Creating Sessions

```typescript
import { SessionUtils } from "@/lib/auth/session-config";

// Standard 24-hour session
const session = SessionUtils.createSession(user, "DEFAULT");

// Short session for sensitive operations
const shortSession = SessionUtils.createSession(user, "SHORT");

// Guest session
const guestSession = SessionUtils.createSession(guestUser, "GUEST");
```

### Session Validation

```typescript
// Check if session is near expiry
if (SessionUtils.isNearExpiry(session.expires)) {
  // Trigger refresh warning
}

// Check if session is expired
if (SessionUtils.isExpired(session.expires)) {
  // Force logout
}

// Get remaining time
const remainingMs = SessionUtils.getRemainingTime(session.expires);
```

### In API Routes

```typescript
// Before (hardcoded)
const session = {
  user,
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

// After (centralized)
const session = SessionUtils.createSession(user, "DEFAULT");
```

## Security Considerations

### Session Duration Guidelines

| Session Type  | Duration | Use Case                          |
| ------------- | -------- | --------------------------------- |
| `SHORT`       | 1 hour   | Payment processing, admin actions |
| `DEFAULT`     | 24 hours | Normal user sessions              |
| `EXTENDED`    | 7 days   | Trusted devices                   |
| `REMEMBER_ME` | 30 days  | User preference                   |
| `GUEST`       | 2 hours  | Unauthenticated users             |

### Critical Notes

1. **Never hardcode expiry values** - Always use `SESSION_CONFIG` constants
2. **Choose appropriate duration** - Use `SHORT` for sensitive operations
3. **Validate sessions** - Check expiry before processing sensitive requests
4. **Refresh proactively** - Warn users when sessions are near expiry
5. **Audit session usage** - Log session creation and expiry events

## Migration from Hardcoded Values

### Before

```typescript
// ❌ Hardcoded everywhere
const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const historyPeriod = 30 * 24 * 60 * 60 * 1000;
```

### After

```typescript
// ✅ Centralized configuration
const expires = SessionUtils.getExpiryDate("DEFAULT");
const historyPeriod = SESSION_CONFIG.ANALYTICS.USAGE_HISTORY;
```

## Implementation Status

### ✅ Completed

- [x] Created centralized session configuration
- [x] Updated chat route session creation
- [x] Updated database queries usage history
- [x] Added session utility functions
- [x] Added comprehensive documentation

### 🔄 Recommended Next Steps

- [ ] Add session expiry validation to auth decorators
- [ ] Implement session refresh warnings in UI
- [ ] Add session analytics and monitoring
- [ ] Create session management admin interface
- [ ] Add session security audit logging

## Configuration Management

### Environment-Based Duration

For production environments, consider making durations configurable via environment variables:

```typescript
const SESSION_DURATION = {
  DEFAULT: Number(process.env.SESSION_DURATION_HOURS || 24) * 60 * 60 * 1000,
  // ... other durations
};
```

### Security Hardening

1. **Shorter durations for sensitive operations**
2. **Automatic session invalidation on suspicious activity**
3. **Device-based session management**
4. **IP-based session validation**

This centralized approach ensures consistency, security, and maintainability across the entire application.
