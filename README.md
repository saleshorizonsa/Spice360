# MatrixSales

MatrixSales is an ERP-style React application for sales, finance, inventory, manufacturing, HR, assets, reporting, approvals, and administration.

## Local Setup

Install dependencies:

```bash
npm install
```

Create a `.env.local` file with the required environment variables:

```bash
VITE_MATRIXSALES_APP_ID=your_app_id
VITE_MATRIXSALES_APP_BASE_URL=your_backend_url
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APP_URL=http://localhost:5173
VITE_SUPABASE_AUTH_REDIRECT_URL=http://localhost:5173/auth/confirm
```

For production, set `VITE_APP_URL` and `VITE_SUPABASE_AUTH_REDIRECT_URL` to the deployed site URL, for example:

```bash
VITE_APP_URL=https://matrixsales-peach.vercel.app
VITE_SUPABASE_AUTH_REDIRECT_URL=https://matrixsales-peach.vercel.app/auth/confirm
```

In Supabase Auth URL configuration, add these allowed redirect URLs:

```text
http://localhost:5173/auth/confirm
https://matrixsales-peach.vercel.app/auth/confirm
https://matrixsales-peach.vercel.app/auth/callback
https://matrixsales-peach.vercel.app/verify-email
```

The application handles `/auth/confirm`, `/auth/callback`, and `/verify-email` so confirmation links do not land on a missing route.

Run the app:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```
