.PHONY: test test-backend test-frontend build-frontend

test: test-backend test-frontend

test-backend:
	cd backend && cargo test

test-frontend:
	cd frontend && yarn test

build-frontend:
	cd frontend && yarn build