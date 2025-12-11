#!/bin/bash

# Cloud Development Environment - Startup Script
# Starts frontend, backend, and optionally Azurite

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_PORT=5174
BACKEND_PORT=3000
AZURITE_PORT=10000

# Parse command line arguments
START_AZURITE=false
if [[ "$1" == "--azurite" ]] || [[ "$1" == "-a" ]]; then
  START_AZURITE=true
fi

# Function to print colored messages
print_info() {
  echo -e "${CYAN}[INFO]${NC} $1"
}

print_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if port is in use
check_port() {
  local port=$1
  local service=$2

  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_warning "$service (port $port) is already running"
    return 1
  fi
  return 0
}

# Function to check prerequisites
check_prerequisites() {
  print_info "Checking prerequisites..."

  # Check Node.js
  if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
  fi

  # Check pnpm
  if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Install with: npm install -g pnpm"
    exit 1
  fi

  # Check if backend/.env exists
  if [ ! -f "backend/.env" ]; then
    print_error "backend/.env not found. Please create it from backend/.env.example"
    print_info "Run: cp backend/.env.example backend/.env"
    print_info "Then edit backend/.env with your E2B_API_KEY"
    exit 1
  fi

  # Check if E2B_API_KEY is set
  if ! grep -q "E2B_API_KEY=.\+" backend/.env; then
    print_error "E2B_API_KEY not set in backend/.env"
    print_info "Get your API key from: https://e2b.dev/dashboard"
    exit 1
  fi

  # Check Azurite if needed
  if [ "$START_AZURITE" = true ]; then
    if ! command -v azurite &> /dev/null; then
      print_error "Azurite is not installed"
      print_info "Install with: npm install -g azurite"
      exit 1
    fi
  fi

  print_success "All prerequisites met"
}

# Function to install dependencies if needed
install_dependencies() {
  print_info "Checking dependencies..."

  # Frontend dependencies
  if [ ! -d "node_modules" ]; then
    print_info "Installing frontend dependencies..."
    pnpm install
  fi

  # Backend dependencies
  if [ ! -d "backend/node_modules" ]; then
    print_info "Installing backend dependencies..."
    cd backend && pnpm install && cd ..
  fi

  print_success "Dependencies ready"
}

# Cleanup function
cleanup() {
  print_info "Shutting down services..."

  # Kill all background jobs
  jobs -p | xargs -r kill 2>/dev/null || true

  # Give processes time to clean up
  sleep 1

  print_success "All services stopped"
  exit 0
}

# Trap Ctrl+C and other signals
trap cleanup SIGINT SIGTERM

# Main execution
main() {
  echo ""
  echo -e "${CYAN}╔═══════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║   Cloud Development Environment - Starting...    ║${NC}"
  echo -e "${CYAN}╚═══════════════════════════════════════════════════╝${NC}"
  echo ""

  check_prerequisites
  install_dependencies

  echo ""
  print_info "Starting services..."
  echo ""

  # Start Azurite if requested
  if [ "$START_AZURITE" = true ]; then
    if check_port $AZURITE_PORT "Azurite"; then
      print_info "Starting Azurite (Azure Storage Emulator)..."
      azurite --silent --location /tmp/azurite &
      sleep 2
      print_success "Azurite started on port $AZURITE_PORT"
    fi
  fi

  # Start Backend
  if check_port $BACKEND_PORT "Backend"; then
    print_info "Starting Backend..."
    cd backend && pnpm dev &
    cd ..
    sleep 3
    print_success "Backend started on port $BACKEND_PORT"
  fi

  # Start Frontend
  if check_port $FRONTEND_PORT "Frontend"; then
    print_info "Starting Frontend..."
    pnpm dev &
    sleep 2
    print_success "Frontend started on port $FRONTEND_PORT"
  fi

  echo ""
  echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║            All Services Running!                  ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${CYAN}Frontend:${NC}  http://localhost:$FRONTEND_PORT"
  echo -e "${CYAN}Backend:${NC}   http://localhost:$BACKEND_PORT"
  if [ "$START_AZURITE" = true ]; then
    echo -e "${CYAN}Azurite:${NC}   http://localhost:$AZURITE_PORT"
  fi
  echo ""
  echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
  echo ""

  # Wait for background jobs
  wait
}

# Show usage if --help
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
  echo "Cloud Development Environment - Startup Script"
  echo ""
  echo "Usage: ./start-dev.sh [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  -a, --azurite    Start Azurite (Azure Storage Emulator)"
  echo "  -h, --help       Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./start-dev.sh              # Start frontend + backend only"
  echo "  ./start-dev.sh --azurite    # Start all including Azurite"
  echo ""
  exit 0
fi

# Run main function
main
