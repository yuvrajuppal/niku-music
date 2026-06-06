# Niku-Music

A Discord music bot that plays audio from YouTube in voice channels.

## Features

- `/play <query>` — Play a song by URL or search query
- `/skip` — Skip the current song
- `/stop` — Stop playing and leave the voice channel
- `/queue` — Show the upcoming song queue
- `/pause` / `/resume` — Pause / resume playback
- `/nowplaying` — Show currently playing song with details

Queue auto-advances, and the bot leaves the voice channel after 5 minutes of inactivity.

## Requirements

- [Node.js](https://nodejs.org/) 18+
- A [Discord bot application](https://discord.com/developers/applications) with:
  - **Gateway Intents**: `Guilds`, `GuildVoiceStates`, `GuildMessages`, `MessageContent`

## Setup

```bash
# 1. Clone and install dependencies
npm install

# 2. Configure your bot token
#    Edit `.env` and set:
TOKEN=your_discord_bot_token_here

# 3. Start the bot
npm start
```

On first startup the bot automatically registers its slash commands. Invite the bot to a server with the `applications.commands` scope.

## Dependencies

- `discord.js` — Discord API
- `@discordjs/voice` — Voice connection & audio playback
- `youtube-dl-exec` — YouTube search & audio streaming (via yt-dlp)
- `ffmpeg-static` — Audio transcoding
- `opusscript` — Opus audio encoding (pure JS, no native build required)
