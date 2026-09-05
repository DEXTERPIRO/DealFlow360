.PHONY: dev start seed migrate upgrade

dev:
	uvicorn app.main:socket_app --reload --port 5000

start:
	uvicorn app.main:socket_app --port 5000

seed:
	python seed.py

migrate:
	alembic revision --autogenerate -m "update"

upgrade:
	alembic upgrade head
