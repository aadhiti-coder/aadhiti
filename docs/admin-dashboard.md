# Separate repositories

The dashboard and admin API have moved out of this repository:

- Public website: https://github.com/aadhiti-coder/aadhiti (this repository)
- Dashboard: https://github.com/shubham5555555/aadhiti-dashboard
- Admin API: https://github.com/shubham5555555/aadhiti-api

Local sibling directories are `../aadhiti-dashboard` and `../aadhiti-api`.
Each repository has its own package manifest, lockfile, environment template and deployment instructions.
See `docs/operations.md` in the dashboard or API repository for the staff workflow, permissions, consent, retention and webhook-event setup.

The public Next.js server routes remain here: login/OTP, AI chat, calls, customer storage, WATI webhook and reminders. The separate API serves `/api/admin/*`. This split separates repositories and deployments; it does not migrate the public server routes.

All three applications must use the same intended MongoDB database. The default database is `aadhi_ti`; set MONGODB_DB explicitly in the website and API deployments. Only the website and API hold database/provider credentials. The dashboard holds only ADMIN_API_URL.

Deploy the updated public webhook together with the API for receipt tracking and cross-channel linking. Creating repositories does not create Vercel projects or deploy changes.
