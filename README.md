# Ricoid

An AI-powered Discord bot with administrative permissions. Communicate using natural language—it understands and executes tasks autonomously.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Development](#development)
- [License](#license)

## Features

- **Natural Language Interface**: Communicate naturally—no complex commands
- **AI-Powered**: Advanced AI for understanding and executing requests
- **Server Management**: Channels, roles, users, moderation, and permissions
- **Communication Tools**: Message management, polls, pins, and reactions
- **Utilities**: Reminders, calculator, games, and conversation tracking
- **Configurable**: Access control, channel restrictions, custom prompts, and safety confirmations
- **Modern Stack**: TypeScript, Discord.js v14, modular architecture

## Prerequisites

- Node.js 22.12.0 or higher
- Discord bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- Google AI API key ([Google AI Studio](https://makersuite.google.com/app/apikey))

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/JohnRichDev/ricoid.git
   cd ricoid
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

## Configuration

1. Create a `.env` file in the root directory:

   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   GOOGLE_API_KEY=your_google_ai_api_key_here
   ```

2. Deploy commands to Discord:

   ```bash
   npm run deploy
   ```

## Usage

Start the bot:

```bash
npm start
```

**Interact naturally**: Mention the bot or DM it with requests like "create a moderator role" or "clean up spam in this channel."

**Configure settings** with `/settings`:

- `access` - Control who can use the bot
- `channel` - Restrict bot to specific channels
- `prompt` - Customize bot personality
- `confirmations` - Manage safety prompts

## Development

**Scripts:**

- `npm run build` - Compile TypeScript
- `npm run deploy` - Deploy commands to Discord
- `npm run lint` - Check code quality
- `npm run format` - Format and fix code

**Key directories:**

- `src/commands/` - Command handlers
- `src/events/` - Event handlers
- `src/ai/` - AI tools and function declarations
- `src/util/` - Utilities and helpers

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a Pull Request

## License

MIT License. See [LICENSE](LICENSE) for details.
