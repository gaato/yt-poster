#!/usr/bin/env python3
"""
Development runner script for yt-poster
"""
import sys
import os

# Add src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# Import and run main
from main import bot
import dotenv

if __name__ == "__main__":
    dotenv.load_dotenv()
    bot.run(os.environ["DISCORD_BOT_TOKEN"])
