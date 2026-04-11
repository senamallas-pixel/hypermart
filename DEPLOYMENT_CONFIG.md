# HyperMart Deployment Configuration Guide

## ✅ Deployment Status

- **Frontend (Vercel)**: https://frontend-phi-five-15.vercel.app
- **Backend (Render)**: https://hypermart-ukg0.onrender.com
- **Android (EAS)**: Build in progress

---

## 🔧 GitHub Secrets Required

Go to: https://github.com/senamallas-pixel/hypermart/settings/secrets/actions

Add these 4 secrets:

### 1. VERCEL_ORG_ID
```
team_e7y4doVbGOuIQPKsby7mRec8
```

### 2. VERCEL_PROJECT_ID
```
prj_RM8l2VZU2tB94Fu8BpLGNl9ClGrp
```

### 3. VERCEL_TOKEN
**Get from**: https://vercel.com/account/tokens
- Click "Create Token"
- Name: "GitHub Actions"
- Scope: Full Account
- Copy the token (shown only once!)
- Paste as secret value

### 4. RENDER_DEPLOY_HOOK_URL
**Get from**: Render Dashboard → hypermart-api → Settings
- Scroll to "Deploy Hook" section
- Click "Create Deploy Hook"
- Name: "GitHub Actions"
- Copy the webhook URL
- Paste as secret value

---

## 🌐 Render Environment Variables

Go to: Render Dashboard → hypermart-api → Environment

Add these variables:

### Critical (Required for Security)
| Variable | Value | Notes |
|---|---|---|
| `JWT_SECRET` | Generate with: `openssl rand -hex 32` | **CRITICAL** - Use unique secret, not default |

### Optional (For Features)
| Variable | Value | Notes |
|---|---|---|
| `OPENAI_API_KEY` | Your OpenAI API key | Required for AI chat, suggestions, forecasts |
| `OPENAI_MODEL` | `gpt-4o-mini` | Default model for AI features |
| `RAZORPAY_KEY_ID` | `rzp_test_ScGuDdSnrFFMy2` | For Razorpay payment gateway |
| `RAZORPAY_KEY_SECRET` | Your Razorpay secret | From Razorpay dashboard |

### Auto-Configured (No action needed)
| Variable | Default Value | Notes |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./hypermart.db` | SQLite DB (resets on redeploy) |
| `MAX_UPLOAD_MB` | `10` | Max file upload size |
| `SQL_ECHO` | `false` | SQL query logging |

---

## 🎯 Vercel Environment Variables

Go to: Vercel Dashboard → Your Project → Settings → Environment Variables

Add this variable:

| Variable | Value | Environment |
|---|---|---|
| `VITE_API_URL` | `https://hypermart-ukg0.onrender.com` | Production, Preview, Development |

---

## 📋 Quick Setup Checklist

### GitHub (CI/CD)
- [ ] Add `VERCEL_ORG_ID` secret
- [ ] Add `VERCEL_PROJECT_ID` secret
- [ ] Add `VERCEL_TOKEN` secret (from Vercel dashboard)
- [ ] Add `RENDER_DEPLOY_HOOK_URL` secret (from Render dashboard)

### Render (Backend)
- [ ] Add `JWT_SECRET` env var (generate secure value)
- [ ] Add `OPENAI_API_KEY` env var (if using AI features)
- [ ] Add `RAZORPAY_KEY_ID` env var (if using Razorpay)
- [ ] Add `RAZORPAY_KEY_SECRET` env var (if using Razorpay)

### Vercel (Frontend)
- [ ] Add `VITE_API_URL` env var = `https://hypermart-ukg0.onrender.com`
- [ ] Redeploy frontend after adding env var

---

## ✅ Testing

After configuring all secrets and environment variables:

1. **Test Backend API**: Run `.\test-api.ps1` (already tested ✅)
2. **Test Frontend**: Visit https://frontend-phi-five-15.vercel.app
3. **Test CI/CD**: Push a commit to trigger workflows
4. **Test Android Build**: Check EAS build status

---

## 🚀 Deployment URLs

- **Frontend**: https://frontend-phi-five-15.vercel.app
- **Backend**: https://hypermart-ukg0.onrender.com
- **API Docs**: https://hypermart-ukg0.onrender.com/docs
- **GitHub Actions**: https://github.com/senamallas-pixel/hypermart/actions
- **EAS Builds**: https://expo.dev/accounts/peddapetavenkatesh/projects/hypermart/builds

---

## 📝 Notes

- **Database**: SQLite on Render is ephemeral (resets on redeploy). For persistent data, upgrade to PostgreSQL.
- **JWT Secret**: Never use the default value in production. Generate a secure random string.
- **Vercel Token**: Keep it secure. It has full access to your Vercel account.
- **Render Deploy Hook**: Anyone with this URL can trigger deployments. Keep it secret.

---

**Last Updated**: April 12, 2026
