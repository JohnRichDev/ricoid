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

- **Natural Language Interface**: Communicate naturally via mentions or DMs
- **AI Function Calling**: Google Gemini AI with 60+ Discord operations as callable functions
- **Server Management**: Channels, categories, roles, permissions, voice controls, and bulk operations
- **Message Operations**: Send, edit, delete, clear, purge, embeds, polls, pins, reactions, and threads
- **Moderation**: Kick, ban, timeout, role management, audit logs, and user info
- **Advanced Features**: Forum channels, webhooks, invites, events, custom commands, and event logging
- **Utilities**: Code execution (VM sandbox), web scraping, search, reminders, games, and calculator
- **Configurable**: Access control, channel restrictions, custom AI prompts, and confirmation system
- **Modern Stack**: TypeScript, Discord.js v14, Gemini AI, modular file-based event system

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

**Interact naturally**: Mention the bot (`@Ricoid`) or DM it with requests like "create a moderator role" or "organize these channels into categories."

**Configure settings** with `/settings`:

- `access` - Control who can use the bot (users, roles, or everyone)
- `channel` - Restrict bot responses to specific channels
- `prompt` - Customize AI personality and behavior
- `confirmations` - Toggle safety confirmations for dangerous operations
- `custom-command` - Create/delete custom text commands

## Development

**Scripts:**

- `npm run build` - Compile TypeScript
- `npm run deploy` - Deploy commands to Discord
- `npm run lint` - Check code quality
- `npm run format` - Format and fix code

**Key directories:**

- `src/commands/` - Slash command handlers (`/settings`)
- `src/events/` - Discord event handlers (messageCreate, guildCreate, etc.)
- `src/ai/` - AI config, function declarations, search integration
- `src/handlers/` - Message processing, AI response generation, function call routing
- `src/discord/operations/` - Discord API operations organized by domain
- `src/util/` - Confirmation system, settings store, loaders, helpers
- `data/` - Runtime data (settings.json, conversations.json)
- `logs/events/` - Daily event logs (all Discord events in JSON format)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a Pull Request

## License

MIT License. See [LICENSE](LICENSE) for details.
