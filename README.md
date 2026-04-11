# HyperMart 🛒

A multi-vendor hyperlocal grocery marketplace connecting neighborhood shops with local customers.

[![Frontend](https://img.shields.io/badge/Frontend-Live-brightgreen)](https://frontend-phi-five-15.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Live-blue)](https://hypermart-ukg0.onrender.com)
[![API Docs](https://img.shields.io/badge/API-Swagger-orange)](https://hypermart-ukg0.onrender.com/docs)

---

## 🌐 Deployed Applications

| Service | URL | Status |
|---------|-----|--------|
| **Frontend (Web)** | [frontend-phi-five-15.vercel.app](https://frontend-phi-five-15.vercel.app) | ✅ Live on Vercel |
| **Backend (API)** | [hypermart-ukg0.onrender.com](https://hypermart-ukg0.onrender.com) | ✅ Live on Render |
| **API Documentation** | [hypermart-ukg0.onrender.com/docs](https://hypermart-ukg0.onrender.com/docs) | 📖 Swagger UI |
| **Android App** | EAS Build (Internal Distribution) | 🚧 In Development |

---

## 📚 Documentation

### Product & Technical Specifications

| Document | Description | Link |
|----------|-------------|------|
| **Product Requirements (PRD)** | Complete product specification, features, user flows, and acceptance criteria | [Docs/PRD.md](Docs/PRD.md) |
| **Implementation Guide** | Architecture, API reference, database schema, order pipeline | [Docs/Imp.md](Docs/Imp.md) |
| **Claude Code Guide** | AI assistant instructions for development workflow | [CLAUDE.md](CLAUDE.md) |
| **Environment Variables** | Complete env vars reference for all services | [ENV_GUIDE.md](ENV_GUIDE.md) |
| **Deployment Configuration** | Render, Vercel, and EAS deployment setup | [DEPLOYMENT_CONFIG.md](DEPLOYMENT_CONFIG.md) |
| **PostgreSQL Migration** | SQLite to PostgreSQL migration notes | [POSTGRES_MIGRATION.md](POSTGRES_MIGRATION.md) |

---

## 🚀 Tech Stack

### Frontend (Web)
- **React 18** with Vite 6
- **Tailwind CSS 4** for styling
- **React Router** (HashRouter)
- **React-Leaflet** for maps
- **Axios** for API calls
- **i18n** (English, Hindi, Telugu)

### Backend (Python)
- **FastAPI 0.115** (async REST API)
- **SQLAlchemy 2.0** ORM
- **PostgreSQL** (production) / SQLite (dev)
- **JWT Authentication** (python-jose)
- **Google Gemini 2.0 Flash** AI integration
- **Cloudinary** for image storage

### Backend (Node.js Alternative)
- **Express 4**
- **sql.js** (WASM SQLite)
- Drop-in replacement for Python backend

### Mobile (Android)
- **Expo SDK 52** with React Native 0.76.9
- **EAS Build** for CI/CD
- React Navigation, Expo Image Picker, Expo Location

---

## 🎯 Key Features

### For Customers
- 📍 **Location-based shop discovery** with map view
- 🛍️ **Browse products** from nearby shops
- 🛒 **Shopping cart** with multi-shop support
- 📦 **Order tracking** with status updates
- 🗣️ **Multi-language support** (EN, HI, TE)

### For Shop Owners
- 🏪 **Digital storefront** management
- 📦 **Inventory control** with stock tracking
- 📊 **Sales analytics** dashboard
- 🤖 **AI product suggestions** and descriptions (Gemini)
- 💰 **Discount management** (product & order level)
- 📈 **Sales forecasting** (AI-powered)
- 🚚 **Supply chain** management

### For Admins
- 👥 **User management** with role assignments
- ✅ **Shop approval** workflow
- 📊 **Platform analytics**
- 🔧 **System configuration**

---

## 🧑‍💻 Local Development

### Prerequisites
- **Node.js** 20+ (frontend)
- **Python 3.12+** (backend)
- **npm** or **pnpm**

### Frontend Setup
```bash
cd frontend
npm install
npm run dev  # http://localhost:5173
```

### Backend Setup (Python)
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload  # http://localhost:8000
python seed.py --reset  # Seed demo data
```

### Backend Setup (Node.js)
```bash
cd backend-node
npm install
npm run dev  # http://localhost:8000
npm run seed:reset  # Seed demo data
```

### Android Development
```bash
cd frontend_android
npm install
npx expo start --android
```

---

## 🔑 Demo Credentials

After seeding the database:

| Role | Email | Password |
|------|-------|----------|
| **Customer** | ravi@example.com | Customer@123 |
| **Shop Owner** | anand@example.com | Owner@123 |
| **Admin** | senamallas@gmail.com | Admin@123 |

---

## 🗄️ Database

### Production (PostgreSQL)
- **Host:** Render (dpg-d7dbcdt7vvec738i9d70-a.oregon-postgres.render.com)
- **Database:** hypermart
- **Migration:** See [POSTGRES_MIGRATION.md](POSTGRES_MIGRATION.md)

### Development (SQLite)
- **File:** `backend/hypermart.db` or `backend-node/hypermart.db`
- **Seed Script:** `seed.py` (Python) or `seed.js` (Node.js)

---

## 🤖 AI Features

Powered by **Google Gemini 2.0 Flash**:
- 💬 **AI Chat Assistant** for product recommendations
- 🏷️ **Auto-generate** product descriptions
- 📊 **Sales forecasting** based on historical data
- ⚠️ **Low stock insights** and inventory alerts

---

## 🌍 Internationalization

Three languages supported out-of-the-box:
- 🇬🇧 **English** (en)
- 🇮🇳 **Hindi** (hi)
- 🇮🇳 **Telugu** (te)

Translation files: `frontend/public/locales/{lang}/translation.json`

---

## 📱 Mobile App (Android)

- **Platform:** Expo managed workflow
- **Build Service:** EAS Build
- **Distribution:** Internal (preview APK)
- **GitHub Actions:** Automated builds on tag push (`v*`)

---

## 🔐 Environment Variables

See [ENV_GUIDE.md](ENV_GUIDE.md) for complete reference.

### Required (Backend)
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-secret-key
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
GEMINI_API_KEY=your-gemini-key  # Optional for AI features
```

### Required (Frontend)
```bash
VITE_API_URL=http://localhost:8000
```

---

## 📦 Deployment

### Frontend (Vercel)
- **Auto-deploy** on push to `main`
- **Build command:** `npm run build`
- **Output directory:** `dist/`

### Backend (Render)
- **Service:** Python Web Service
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Android (EAS + GitHub Actions)
- **Trigger:** Push tags `v*` or manual workflow dispatch
- **Output:** APK (preview) or AAB (production)
- **Artifacts:** GitHub Releases

---

## 🧪 Testing

```bash
# Backend API test
python test-api.ps1

# PostgreSQL verification
python verify-postgres.ps1
```

---

## 📖 API Documentation

Interactive API docs available at:
- **Local:** http://localhost:8000/docs
- **Production:** https://hypermart-ukg0.onrender.com/docs

All endpoints documented with Swagger UI (FastAPI auto-generated).

---

## 🛠️ Development Workflow

1. **Feature Development:** Work on feature branches
2. **Code Review:** Claude Code assistant for guidance ([CLAUDE.md](CLAUDE.md))
3. **Testing:** Local smoke tests before push
4. **Commit:** Conventional commits (`feat:`, `fix:`, `ci:`, etc.)
5. **Deploy:** Auto-deploy to Vercel (frontend) and Render (backend)

---

## 📄 License

This project is private and proprietary.

---

## 👥 Contributors

- **Lead Developer:** @peddapetavenkatesh
- **GitHub:** [@senamallas-pixel](https://github.com/senamallas-pixel)

---

## 🐛 Issues & Support

For bugs or feature requests, please open an issue on the [GitHub repository](https://github.com/senamallas-pixel/hypermart/issues).

---

**Last Updated:** April 12, 2026  
**Version:** 2.0.0
