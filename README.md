# Ricoid

A modular Discord bot with administrative permissions that you can talk to like a normal person. It understands natural language and performs tasks with minimal human intervention.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Development](#development)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

## Overview

Ricoid is a modular Discord bot designed to act as an intelligent assistant with administrative permissions. You can communicate with it using natural language, just like talking to a person. The bot understands your requests and executes them autonomously with little to no human intervention required. Built with modern TypeScript and Discord.js, it provides a flexible foundation that can be customized and extended to meet your server's specific needs.

## Features

- **Natural Language Processing**: Talk to the bot like a normal person using everyday language
- **Administrative Permissions**: Configurable admin-level permissions for server management
- **Autonomous Operation**: Performs tasks with minimal human intervention
- **Modular Architecture**: Easily customizable and extendable command system
- **AI-Powered Intelligence**: Advanced AI integration for understanding and executing requests
- **Modern TypeScript**: Built with strict type checking and professional code standards
- **Discord.js v14**: Latest Discord API integration for reliable performance
- **Event-Driven System**: Responsive to server events and user interactions
- **Settings Management**: Flexible configuration system for different server needs
- **Confirmation System**: Smart confirmation prompts for critical operations
- **Comprehensive Error Handling**: Robust error management and recovery

## Prerequisites

Before setting up Ricoid, ensure you have the following installed:

- **Node.js**: Version 22.12.0 or higher
- **npm**: Latest version (comes with Node.js)
- **Discord Application**: A Discord application with bot token

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

1. **Create environment file**

   Create a `.env` file in the root directory with the following variables:

   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   GOOGLE_API_KEY=your_google_ai_api_key_here
   ```

2. **Discord Bot Setup**

   a. Visit the [Discord Developer Portal](https://discord.com/developers/applications)

   b. Create a new application or select an existing one

   c. Navigate to the "Bot" section

   d. Copy the bot token and add it to your `.env` file

   e. Configure bot permissions and intents as needed

3. **Google AI Setup**

   a. Visit the [Google AI Studio](https://makersuite.google.com/app/apikey)

   b. Generate an API key

   c. Add the API key to your `.env` file

4. **Deploy Commands**

   Deploy the bot commands to Discord:

   ```bash
   npm run deploy
   ```

## Usage

1. **Start the bot**

   ```bash
   npm start
   ```

2. **Talk to the bot**

   Once the bot is running in your Discord server, you can interact with it naturally:
   - Send direct messages or mention the bot in channels
   - Use everyday language to make requests
   - The bot will understand and execute tasks autonomously
   - Administrative permissions allow it to manage server settings, users, and channels

3. **Examples of natural interactions**
   - "Can you help me organize this channel?"
   - "Set up a welcome message for new members"
   - "Clean up the spam in this channel"
   - "Create a new role for moderators"

4. **Development mode**

   For development with auto-compilation:

   ```bash
   npm run build && npm start
   ```

5. **Code formatting and linting**
   ```bash
   npm run format  # Format and fix code
   npm run lint    # Check code quality
   ```

## Development

### Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Start the bot
- `npm run deploy` - Deploy commands to Discord
- `npm run lint` - Check code with ESLint and Prettier
- `npm run format` - Format code and fix linting issues

### Adding New Features

1. **Commands**: Add new commands in the `src/commands` directory
2. **Events**: Add new event handlers in the `src/events` directory
3. **Utilities**: Add utility functions in the `src/util` directory
4. **Configuration**: Modify settings in the `src/config` directory

## Project Structure

```
ricoid/
├── data/                   # Data storage files
│   ├── conversations.json  # Conversation history
│   └── settings.json      # Bot settings
├── src/                   # Source code
│   ├── ai/               # AI integration modules
│   ├── commands/         # Command handlers
│   ├── config/           # Configuration files
│   ├── discord/          # Discord client setup
│   ├── events/           # Event handlers
│   ├── handlers/         # Message and interaction handlers
│   ├── types/            # TypeScript type definitions
│   └── util/             # Utility functions
├── package.json          # Project dependencies
├── tsconfig.json         # TypeScript configuration
└── .env                  # Environment variables (not tracked)
```

## Contributing

We welcome contributions to Ricoid. Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code follows the existing style and includes appropriate tests.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Support

For support, please:

1. Check the documentation above
2. Review existing issues on GitHub
3. Create a new issue if your problem is not covered

When reporting issues, please include:

- Node.js version
- Operating system
- Error messages or logs
- Steps to reproduce the issue
