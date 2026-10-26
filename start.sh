#!/bin/sh
# Sobe todo o ambiente: o MySQL fica saudável, o app aplica migrações e dados iniciais e inicia
docker compose up -d --build
