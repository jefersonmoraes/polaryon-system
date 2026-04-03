# Polaryon System - Security Policy for AI Assistants

This document contains mandatory security rules for any AI working on the Polaryon project. These rules are designed to prevent data leaks and infrastructure vulnerabilities.

## 1. Network & Firewall (UFW)
- **Port 5432 (PostgreSQL)**: MUST remain blocked to external traffic. Only local connections (`127.0.0.1`) or SSH tunneling are allowed.
- **Port 3000 (Backend)**: MUST remain blocked (`ufw deny 3000`). Access is only through the Nginx reverse proxy.
- **Port 22 (SSH)**: The only management port allowed.

## 2. Backend Security (Express/Node.js)
- **CORS**: Always restrict to `https://polaryon.com.br` and `https://www.polaryon.com.br` in production. Never use `*`.
- **Rate Limiting**: Mandatory for all `/api/` routes using `express-rate-limit`.
- **Headers**: 
    - `helmet` must be used and configured strictly.
    - `X-Powered-By` must be disabled (`app.disable('x-powered-by')`).
- **Input Validation**: Use `hpp` and `xss-clean` middlewares.

## 3. File Management
- **Test Scripts**: Files named `test_*.js` or similar debug scripts MUST NOT exist in the production web root (`/var/www/polaryon/`).
- **Safe Archiving**: Any necessary test scripts must be stored in `/root/polaryon_backup_tests/`.

## 4. Audit & Logging
- Every new API route or significant logic change MUST incorporate the audit logging system located in `src/audit.ts`.
- Prisma operations should be logged where sensitive data is involved.

## 5. Google Integration
- Do not modify CORS or Security Headers in a way that breaks Google OAuth or Google Calendar redirect URIs. Always test these integrations after security changes.

**Failure to follow these rules constitutes a critical security regression.**
