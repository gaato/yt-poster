.PHONY: install run build clean test check

# Install dependencies
install:
	uv sync

# Run the application locally
run:
	uv run python src/main.py

# Run using the convenience script
dev:
	uv run python run.py

# Build Docker image
build:
	docker-compose build

# Start with Docker
start:
	docker-compose up

# Start with Docker in background
start-bg:
	docker-compose up -d

# Stop Docker containers
stop:
	docker-compose down

# Clean up
clean:
	docker-compose down --rmi all --volumes
	rm -rf .uv_cache

# Check code syntax
check:
	uv run python -m py_compile src/*.py

# Show logs
logs:
	docker-compose logs -f

# Update dependencies
update:
	uv lock --upgrade
