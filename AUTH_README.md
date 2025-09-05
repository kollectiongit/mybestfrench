# Next.js + Better Auth Authentication

This project demonstrates a complete authentication system using Next.js and Better Auth, featuring both email/password and social authentication.

## Features

- ✅ Email and password authentication
- ✅ Google OAuth integration
- ✅ User registration and login
- ✅ Email verification
- ✅ Session management
- ✅ Protected routes
- ✅ Modern UI with shadcn/ui components

## Pages

- `/login` - User login page
- `/signup` - User registration page
- `/dashboard` - Protected dashboard (requires authentication)
- `/welcome` - Welcome page for new social auth users

## Setup

### 1. Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="your-database-url"

# Google OAuth (optional - for social login)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 2. Database Setup

Run the following commands to set up your database:

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev
```

### 3. Google OAuth Setup (Optional)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to Credentials and create an OAuth 2.0 Client ID
5. Add your domain to authorized origins
6. Add redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (for development)
   - `https://yourdomain.com/api/auth/callback/google` (for production)

### 4. Start Development Server

```bash
npm run dev
```

## Usage

### Email/Password Authentication

Users can register with email and password. By default, users are automatically signed in after successful registration. Email verification is required.

### Social Authentication

Users can sign in with Google. New users will be redirected to the welcome page, while existing users go directly to the dashboard.

### Session Management

The app uses Better Auth's session management with automatic session persistence and real-time updates.

## API Routes

Better Auth automatically creates the following API routes:

- `/api/auth/signup/email` - Email registration
- `/api/auth/signin/email` - Email login
- `/api/auth/signin/social` - Social login
- `/api/auth/signout` - Sign out
- `/api/auth/session` - Get session
- `/api/auth/callback/*` - OAuth callbacks

## Components

- `LoginForm` - Email and social login form
- `SignupForm` - Email and social registration form
- UI components from shadcn/ui

## Styling

The project uses Tailwind CSS with shadcn/ui components for a modern, accessible design.
