# Password Reset System

This project includes a complete password reset system using Better Auth. Here's how it works:

## 🔄 Password Reset Flow

### 1. Request Password Reset

- **URL**: `/request-password-reset`
- **Purpose**: User enters their email to request a password reset
- **Process**:
  - User enters email address
  - System sends reset link to email (currently logs to console)
  - User receives confirmation message

### 2. Reset Password

- **URL**: `/reset-password?token=RESET_TOKEN`
- **Purpose**: User sets a new password using the token from email
- **Process**:
  - Token is validated from URL parameters
  - User enters new password twice for confirmation
  - Password is updated in database
  - User is redirected to login page

## 🛠️ Technical Implementation

### Server Configuration (`lib/auth.ts`)

```typescript
emailAndPassword: {
  enabled: true,
  requireEmailVerification: false,
  sendResetPassword: async ({ user, url, token: _token }, _request) => {
    await sendEmail({
      to: user.email,
      subject: "Reset your password",
      text: `Click the link to reset your password: ${url}`,
    });
  },
  onPasswordReset: async ({ user }, _request) => {
    console.log(`Password for user ${user.email} has been reset.`);
  },
}
```

### Client Functions

- `authClient.requestPasswordReset({ email, redirectTo })` - Request reset
- `authClient.resetPassword({ newPassword, token })` - Reset password

## 📧 Email Configuration

Currently, the system logs email content to the console. In production, replace the `sendEmail` function in `lib/auth.ts` with your preferred email service:

```typescript
// Example with SendGrid
import sgMail from "@sendgrid/mail";

const sendEmail = async ({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) => {
  await sgMail.send({
    to,
    from: "noreply@yourdomain.com",
    subject,
    text,
  });
};
```

## 🔗 Integration Points

- **Login Form**: "Forgot your password?" link points to `/request-password-reset`
- **Request Form**: "Sign in" link points back to `/login`
- **Reset Form**: "Sign in" button redirects to `/login` after successful reset

## 🧪 Testing the Flow

1. **Start the server**: `npm run dev`
2. **Visit**: `http://localhost:3000/login`
3. **Click**: "Forgot your password?" link
4. **Enter**: An existing user's email address
5. **Check**: Console logs for the reset link
6. **Visit**: The reset link from console
7. **Enter**: New password and confirm
8. **Test**: Login with new password

## 🔒 Security Features

- **Token Validation**: Reset tokens are validated before allowing password changes
- **Token Expiration**: Tokens expire automatically for security
- **Password Confirmation**: Users must enter password twice to prevent typos
- **Error Handling**: Comprehensive error messages for invalid tokens, expired links, etc.

## 📱 User Experience

- **Loading States**: Visual feedback during API calls
- **Error Messages**: Clear error messages for all failure scenarios
- **Success States**: Confirmation messages after successful actions
- **Responsive Design**: Works on all screen sizes
- **Accessibility**: Proper labels and semantic HTML
