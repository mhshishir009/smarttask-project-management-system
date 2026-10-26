# SmartTask frontend

React 19 + TypeScript + Vite 8, with React Router, Tailwind CSS, scoped auth styling, Axios and Lucide React.

See the [root README](../README.md) for full application, backend/database setup, first-login password change and submission documentation.

From this frontend directory:

```bash
npm ci
npm run dev
npm run lint
npm run build
```

Keep the root backend running with npm start from the repository root. The development proxy forwards /api to http://localhost:5000; it is not part of the production bundle.

[VITE_API_BASE_URL configuration](.env.example) and [deployment requirements](../docs/DEPLOYMENT.md) describe production API routing. Never place backend secrets in browser environment variables.

Build output is frontend/dist/. From the repository root use npm --prefix frontend run <script>; from this directory use plain npm run <script>.
