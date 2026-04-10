@echo off
set PORT=3001
set DATABASE_URL=postgresql://nominas:nominas_local_pw_2026@localhost:55432/nominas_db?schema=public
set POSTGRES_PORT=55432
set REDIS_PORT=6381
cd /d C:\Users\PC\Desktop\RRHH\backend
npm run dev
