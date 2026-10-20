# Instagram API & Instagram Login Setup Runbook

> **Live Meta connection: not verified**
> Production testing is performed against `MockInstagram` with fault injection. The live Meta connection requires Meta App Review and is not active in this sandbox environment.

---

## 1. Meta Developer App Configuration

To configure live Instagram Login (Business Login) for the Package Engine:

1. **Create Meta App**:
   - Go to [developers.facebook.com](https://developers.facebook.com/).
   - Select **Create App** $\rightarrow$ **Other** $\rightarrow$ **Business**.
   - Add the **Instagram** product to your app.

2. **Add Roles & Tester Accounts**:
   - Under **App Roles** $\rightarrow$ **Roles**, add Instagram accounts as **Instagram Testers**.
   - On the Instagram mobile app or web under Settings $\rightarrow$ Apps and Websites $\rightarrow$ Tester Invites, accept the invite.

3. **Configure Redirect URIs**:
   - Under **Instagram Platform** $\rightarrow$ **Basic Display** or **Instagram API with Instagram Login**:
     - Client OAuth Settings: set **Valid OAuth Redirect URIs** to:
       `https://<YOUR_DOMAIN>/connections/instagram/callback`
     - Deauthorize Callback URL:
       `https://<YOUR_DOMAIN>/connections/instagram/deauthorize`
     - Data Deletion Request URL:
       `https://<YOUR_DOMAIN>/connections/instagram/data-deletion`

---

## 2. Environment Variables

Configure the following environment placeholders in `.env`:

```env
# Meta / Instagram Graph API Configuration
INSTAGRAM_APP_ID="REPLACE_ME_APP_ID"
INSTAGRAM_APP_SECRET="REPLACE_ME_APP_SECRET"
INSTAGRAM_REDIRECT_URI="http://localhost:3000/connections/instagram/callback"

# Feature Flag: Keeps live Meta calls disabled by default
SOURCE_INSTAGRAM_ENABLED="false"
```

---

## 3. Official Meta API Specifications

### 3.1 OAuth Authorization URL
- **URL**: `https://www.instagram.com/oauth/authorize`
- **Method**: GET (Browser redirect)
- **Parameters**:
  - `enable_fb_login=0`
  - `force_authentication=1`
  - `client_id`: Instagram App ID
  - `redirect_uri`: Configured redirect URI
  - `response_type=code`
  - `scope=instagram_business_basic`
  - `state`: Cryptographically random single-use state bound to user ID (10 minute expiry)

### 3.2 Token Exchange (Short-Lived)
- **URL**: `https://api.instagram.com/oauth/access_token`
- **Method**: POST
- **Parameters**:
  - `client_id`: Instagram App ID
  - `client_secret`: Instagram App Secret
  - `grant_type`: `authorization_code`
  - `redirect_uri`: Configured redirect URI
  - `code`: Code received in callback
- **Response**: `{ access_token: string, user_id: string }`

### 3.3 Exchange for Long-Lived Token (60 Days)
- **URL**: `https://graph.instagram.com/access_token`
- **Method**: GET
- **Parameters**:
  - `grant_type`: `ig_exchange_token`
  - `client_secret`: Instagram App Secret
  - `access_token`: Short-lived access token
- **Response**: `{ access_token: string, token_type: "bearer", expires_in: 5184000 }`

### 3.4 Token Refresh
- **URL**: `https://graph.instagram.com/refresh_access_token`
- **Method**: GET
- **Parameters**:
  - `grant_type`: `ig_refresh_token`
  - `access_token`: Long-lived token (must be $\ge 24\text{ hours old}$ and unexpired)
- **Response**: `{ access_token: string, token_type: "bearer", expires_in: 5184000 }`

### 3.5 User Profile Endpoint
- **URL**: `https://graph.instagram.com/v21.0/me`
- **Method**: GET
- **Parameters**: `fields=id,username,account_type&access_token={token}`
- **Account Types**: `BUSINESS`, `MEDIA_CREATOR`, `PERSONAL`.
- *Note: Only `BUSINESS` and `MEDIA_CREATOR` accounts are accepted. Non-professional (`PERSONAL`) accounts are rejected.*

### 3.6 Media Polling Endpoint
- **URL**: `https://graph.instagram.com/v21.0/me/media`
- **Method**: GET
- **Parameters**: `fields=id,caption,media_type,permalink,timestamp&limit=10&access_token={token}`
- *Note: Posts with `timestamp <= baselineAt` are filtered out as BASELINE and never processed.*

### 3.7 Error Codes
- **`190`**: Invalid / expired OAuth 2.0 access token (triggers `NEEDS_RECONNECT`)
- **`4`**: Application request limit reached (HTTP 429 backoff)
- **`10`**: User denied consent or permissions
- **`24`**: Unsupported account type (e.g. personal account)
- **`100`**: Invalid code or parameter

---

## 4. End-to-End Verification with One Tester Account

1. Navigate to customer portal $\rightarrow$ Growth Packages.
2. If `SOURCE_INSTAGRAM_ENABLED=false`, manual trigger box is active: paste any valid Instagram post or reel link (`https://instagram.com/p/...`).
3. If testing OAuth in mock mode:
   - Click "Authorize Account"
   - Enter tester handle `@tester_brand`
   - Complete single-use state authorization
   - Connection record saved with `baselineAt = now()`
