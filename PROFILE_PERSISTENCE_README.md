# Profile Persistence System

This document explains how the persistent profile selection system works in the application.

## Overview

The profile persistence system allows users to have multiple profiles and maintains their current profile selection across pages and browser sessions using secure, signed HttpOnly cookies.

## Architecture

### Core Components

1. **Cookie Management** (`lib/profile-cookies.ts`)
   - Signs and verifies profile IDs using HMAC-SHA256
   - Sets HttpOnly cookies with 180-day expiration
   - Handles cookie clearing and verification

2. **API Routes** (`app/api/current-profile/route.ts`)
   - `POST /api/current-profile` - Set current profile (with validation)
   - `GET /api/current-profile` - Get current profile (with fallback)
   - `DELETE /api/current-profile` - Clear current profile

3. **Server-Side Utilities** (`lib/current-profile.ts`)
   - `getCurrentProfile()` - Get current profile in SSR/Server Components
   - `getUserProfiles()` - Get all user profiles in SSR

4. **React Context** (`src/contexts/profile-context.tsx`)
   - `ProfileProvider` - Provides profile state to the entire app
   - `useProfile()` - Main hook for profile management
   - `useCurrentProfile()` - Lightweight hook for current profile only

5. **Middleware** (`middleware.ts`)
   - Extracts profile ID from cookies and adds to request headers
   - Makes profile ID available for SSR

### Security Features

- **Signed Cookies**: Profile IDs are signed using BETTER_AUTH_SECRET
- **Server Validation**: Always verifies profile ownership before setting
- **HttpOnly**: Cookies cannot be accessed via JavaScript
- **Secure**: Uses secure cookies in production
- **SameSite**: Configured as 'lax' for CSRF protection

## Usage

### Setting Up

The system is automatically initialized in the root layout (`app/layout.tsx`):

```tsx
export default async function RootLayout({ children }) {
  const [currentProfile, allProfiles] = await Promise.all([
    getCurrentProfile(),
    getUserProfiles(),
  ]);

  return (
    <ProfileProvider
      initialProfile={currentProfile}
      initialProfiles={allProfiles}
    >
      {children}
    </ProfileProvider>
  );
}
```

### Using in Components

#### Get Current Profile

```tsx
import { useCurrentProfile } from "@/contexts/profile-context";

function MyComponent() {
  const { currentProfile, isLoading, error } = useCurrentProfile();

  if (isLoading) return <div>Chargement...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!currentProfile) return <div>No profile selected</div>;

  return <div>Current: {currentProfile.first_name}</div>;
}
```

#### Profile Switching

```tsx
import { useProfile } from "@/contexts/profile-context";

function ProfileSwitcher() {
  const { allProfiles, setCurrentProfile, currentProfile } = useProfile();

  return (
    <select
      value={currentProfile?.id || ""}
      onChange={(e) => setCurrentProfile(e.target.value)}
    >
      {allProfiles.map((profile) => (
        <option key={profile.id} value={profile.id}>
          {profile.first_name}
        </option>
      ))}
    </select>
  );
}
```

#### Server-Side Usage

```tsx
import { getCurrentProfile } from "@/lib/current-profile";

export default async function DashboardPage() {
  const currentProfile = await getCurrentProfile();

  if (!currentProfile) {
    return <div>Please select a profile</div>;
  }

  return (
    <div>
      <h1>Dashboard for {currentProfile.first_name}</h1>
      {/* Your component content */}
    </div>
  );
}
```

### Setting Current Profile

To set a profile as current (e.g., when user selects one):

```tsx
const { setCurrentProfile } = useProfile();

// Set profile as current
await setCurrentProfile(profileId);
```

This will:

1. Validate the profile belongs to the user
2. Set the signed cookie
3. Update the React context
4. Persist across page navigations

### Fallback Behavior

If no profile is selected or the cookie is invalid:

- The system automatically selects the most recently created profile
- If no profiles exist, `currentProfile` will be `null`
- The fallback profile is automatically set as current with a cookie

## API Reference

### Cookie Functions

```tsx
// Set current profile cookie (server-side)
setCurrentProfileCookie(response: NextResponse, profileId: string): void

// Get current profile from cookie (server-side)
getCurrentProfileFromCookie(request: NextRequest): string | null

// Clear current profile cookie (server-side)
clearCurrentProfileCookie(response: NextResponse): void
```

### Context Hooks

```tsx
// Main profile hook
const {
  currentProfile, // Current profile object or null
  allProfiles, // Array of all user profiles
  isLoading, // Loading state
  error, // Error message or null
  setCurrentProfile, // Function to set current profile
  refreshProfiles, // Function to refresh profile data
  clearCurrentProfile, // Function to clear current profile
} = useProfile();

// Lightweight current profile hook
const { currentProfile, isLoading, error } = useCurrentProfile();
```

### Server Functions

```tsx
// Get current profile in SSR
const profile = await getCurrentProfile();

// Get all user profiles in SSR
const profiles = await getUserProfiles();
```

## Cookie Details

- **Name**: `current_profile`
- **Value**: Signed profile ID (format: `profileId.signature`)
- **Max Age**: 180 days (15,552,000 seconds)
- **HttpOnly**: true
- **Secure**: true (in production)
- **SameSite**: lax
- **Path**: /

## Error Handling

The system gracefully handles various error scenarios:

- **Invalid cookie signature**: Falls back to most recent profile
- **Profile doesn't exist**: Falls back to most recent profile
- **Profile doesn't belong to user**: Returns error, no fallback
- **No profiles exist**: Returns null, shows create profile prompt

## Environment Variables

Required environment variable:

- `BETTER_AUTH_SECRET`: Used for signing cookies (same as BetterAuth secret)

## Security Considerations

1. **Never trust client-side data**: Always validate profile ownership on the server
2. **Signed cookies**: Prevents tampering with profile IDs
3. **HttpOnly cookies**: Prevents XSS attacks from accessing profile data
4. **Server-side validation**: Every profile operation validates user ownership
5. **Secure cookies**: Uses secure flag in production environments

## Integration with BetterAuth

The system integrates seamlessly with BetterAuth:

- Uses the same secret for cookie signing
- Leverages BetterAuth session management
- Respects BetterAuth authentication flow
- Clears profile cookies on logout
