#!/bin/bash
cd /var/www/polaryon/backend
echo "--- Starting Prisma Push ---"
npx prisma db push --accept-data-loss
echo "--- Starting Prisma Generate ---"
npx prisma generate
echo "--- Restarting Backend ---"
pm2 restart polaryon-backend
echo "--- Done ---"
