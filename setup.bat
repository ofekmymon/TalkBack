@echo off

echo Starting backend server and database...
docker-compose up -d

echo ------------------------------------------------
echo The backend server is running at localhost:3000
echo The database is available at localhost:5432
echo ------------------------------------------------

echo To run TalkBack please start dist\TalkBack-win32-x64\TalkBack.exe
echo ------------------------------------------------
echo To Close the server please open CMD inside TalkBack's main folder and type docker compose down
echo Thank you for trying my app <3
pause