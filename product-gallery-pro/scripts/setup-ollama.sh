#!/bin/bash

# setup-ollama.sh
# Installs Ollama and downloads LLaVA model for Product Gallery Pro

set -euo pipefail

echo "🚀 Setting up Ollama + LLaVA for Product Gallery Pro"
echo "=================================================="

OS="$(uname -s)"

echo "📦 Installing Ollama..."
case "$OS" in
  Darwin)
    if command -v brew >/dev/null 2>&1; then
      brew install --cask ollama-app || brew install ollama || true
    else
      curl -fsSL https://ollama.com/install.sh | sh
    fi
    ;;
  Linux)
    curl -fsSL https://ollama.com/install.sh | sh
    ;;
  *)
    echo "❌ Unsupported OS. Please install Ollama manually from https://ollama.com"
    exit 1
    ;;
esac

echo "🔧 Starting Ollama service..."
if ! pgrep -x "ollama" >/dev/null 2>&1; then
  ollama serve >/dev/null 2>&1 &
  sleep 5
fi

echo "📥 Downloading LLaVA model (this may take a few minutes)..."
ollama pull llava:7b

echo "✅ Verifying installation..."
ollama list

echo ""
echo "=================================================="
echo "✨ Setup complete!"
echo ""
echo "Ollama is running at: http://localhost:11434"
echo "Model installed: llava:7b"
echo ""
echo "To test, run:"
echo "  curl http://localhost:11434/api/generate -d '{\"model\": \"llava:7b\", \"prompt\": \"Hello!\"}'"
echo ""

