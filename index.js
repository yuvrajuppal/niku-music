import { Client, GatewayIntentBits, REST, Routes, ActivityType } from 'discord.js';
import dotenv from 'dotenv';
import { play, skip, stop, queue, pause, resume, nowplaying } from './musicPlayer.js';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commands = [
  {
    name: 'play',
    description: 'Play a song from YouTube by URL or search query',
    options: [{
      name: 'query',
      type: 3,
      description: 'YouTube URL or search query',
      required: true,
    }],
  },
  {
    name: 'skip',
    description: 'Skip the current song',
  },
  {
    name: 'stop',
    description: 'Stop playing and leave the voice channel',
  },
  {
    name: 'queue',
    description: 'View the current song queue',
  },
  {
    name: 'pause',
    description: 'Pause playback',
  },
  {
    name: 'resume',
    description: 'Resume playback',
  },
  {
    name: 'nowplaying',
    description: 'Show the currently playing song',
  },
];

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: 'music | /play', type: ActivityType.Listening }],
    status: 'online',
  });

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered.');
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  switch (interaction.commandName) {
    case 'play':    return play(interaction);
    case 'skip':    return skip(interaction);
    case 'stop':    return stop(interaction);
    case 'queue':   return queue(interaction);
    case 'pause':   return pause(interaction);
    case 'resume':  return resume(interaction);
    case 'nowplaying': return nowplaying(interaction);
  }
});

client.login(process.env.TOKEN);
