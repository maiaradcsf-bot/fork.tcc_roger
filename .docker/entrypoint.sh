#!/bin/sh
# Container start: pending migrations, then the idempotent seed (it never changes existing
# users or data), then the server. RUN_MIGRATIONS=0 / RUN_SEED=0 skip a step.
set -e

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
    attempt=0
    until flask --app wsgi:app db upgrade; do
        attempt=$((attempt + 1))
        if [ "$attempt" -ge 10 ]; then
            echo "Banco de dados indisponível: migrações não aplicadas" >&2
            exit 1
        fi
        echo "Aguardando o banco de dados (tentativa $attempt)..."
        sleep 3
    done
fi

if [ "${RUN_SEED:-1}" = "1" ]; then
    python seeds/seed_data.py
fi

exec "$@"
