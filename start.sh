mkdir ./.docker/mysql
docker compose up mysql -d
sleep 60
docker compose up -d
sleep 60
docker compose exec app flask db upgrade
docker compose exec app python seeds/seed_data.py