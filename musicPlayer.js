import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';
import ytdl from 'youtube-dl-exec';
import https from 'https';

const queues = new Map();

function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      songs: [],
      player: createAudioPlayer(),
      connection: null,
      currentSong: null,
      timeout: null,
    });
  }
  return queues.get(guildId);
}

function fetchStream(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => resolve(r));
        return;
      }
      resolve(res);
    }).on('error', reject);
  });
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export async function play(interaction) {
  const member = interaction.member;
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
  }

  const query = interaction.options.getString('query');
  await interaction.deferReply();

  try {
    const data = await ytdl(`ytsearch1:${query}`, {
      dumpSingleJson: true,
      format: 'bestaudio/best',
      noWarnings: true,
      noCheckCertificate: true,
      ignoreErrors: true,
    });

    const entry = data.entries?.[0] || data;
    if (!entry || !entry.url) {
      return interaction.editReply('No results found.');
    }

    const song = {
      title: entry.title || 'Unknown',
      url: entry.webpage_url || entry.url,
      streamUrl: entry.url,
      duration: entry.duration || 0,
      thumbnail: entry.thumbnail || null,
      requestedBy: interaction.user.tag,
    };

    const queue = getQueue(interaction.guildId);

    if (!queue.connection) {
      queue.connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });

      queue.connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(queue.connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(queue.connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch {
          destroyQueue(interaction.guildId);
        }
      });
    }

    queue.songs.push(song);

    if (queue.player.state.status !== AudioPlayerStatus.Playing) {
      playSong(interaction.guildId);
    }

    return interaction.editReply(`Added **${song.title}** to the queue.`);
  } catch (error) {
    console.error('Play error:', error);
    return interaction.editReply('An error occurred while trying to play that track.');
  }
}

async function playSong(guildId) {
  const queue = getQueue(guildId);
  if (queue.songs.length === 0) return;

  if (queue.timeout) {
    clearTimeout(queue.timeout);
    queue.timeout = null;
  }

  const song = queue.songs[0];
  if (!song || !song.streamUrl) {
    queue.songs.shift();
    if (queue.songs.length > 0) playSong(guildId);
    return;
  }
  queue.currentSong = song;

  try {
    const stream = await fetchStream(song.streamUrl);

    const resource = createAudioResource(stream, {
      inputType: 'arbitrary',
      inlineVolume: true,
    });

    queue.player.play(resource);
    queue.connection.subscribe(queue.player);

    queue.player.once(AudioPlayerStatus.Idle, () => {
      queue.songs.shift();
      if (queue.songs.length > 0) {
        playSong(guildId);
      } else {
        queue.currentSong = null;
        startInactivityTimeout(guildId);
      }
    });

    queue.player.once('error', (error) => {
      console.error('Player error:', error);
      queue.songs.shift();
      if (queue.songs.length > 0) {
        playSong(guildId);
      }
    });
  } catch (error) {
    console.error('Stream error:', error);
    queue.songs.shift();
    if (queue.songs.length > 0) {
      playSong(guildId);
    }
  }
}

function startInactivityTimeout(guildId) {
  const queue = getQueue(guildId);
  queue.timeout = setTimeout(() => {
    const q = queues.get(guildId);
    if (q && q.songs.length === 0) {
      destroyQueue(guildId);
    }
  }, 5 * 60 * 1000);
}

function destroyQueue(guildId) {
  const queue = queues.get(guildId);
  if (queue) {
    if (queue.timeout) clearTimeout(queue.timeout);
    queue.player.stop();
    if (queue.connection) queue.connection.destroy();
    queues.delete(guildId);
  }
}

export async function skip(interaction) {
  const queue = getQueue(interaction.guildId);
  if (!queue.connection || queue.songs.length === 0) {
    return interaction.reply('Nothing is currently playing.');
  }
  queue.player.stop();
  return interaction.reply('Skipped the current song.');
}

export async function stop(interaction) {
  const queue = getQueue(interaction.guildId);
  if (!queue.connection) {
    return interaction.reply('Not connected to a voice channel.');
  }
  queue.songs.length = 0;
  queue.player.stop();
  destroyQueue(interaction.guildId);
  return interaction.reply('Stopped playing and left the voice channel.');
}

export async function queue(interaction) {
  const queue = getQueue(interaction.guildId);
  if (queue.songs.length === 0) {
    return interaction.reply('The queue is empty.');
  }

  const songList = queue.songs
    .map((s, i) => `${i === 0 ? '**Now Playing:**' : `${i}.`} [${s.title}](${s.url}) — requested by ${s.requestedBy}`)
    .join('\n');

  return interaction.reply({
    content: `**Queue (${queue.songs.length} songs):**\n${songList}`,
    allowedMentions: { parse: [] },
  });
}

export async function pause(interaction) {
  const queue = getQueue(interaction.guildId);
  if (!queue.connection || queue.player.state.status !== AudioPlayerStatus.Playing) {
    return interaction.reply('Nothing is currently playing.');
  }
  queue.player.pause();
  return interaction.reply('Paused playback.');
}

export async function resume(interaction) {
  const queue = getQueue(interaction.guildId);
  if (!queue.connection || queue.player.state.status !== AudioPlayerStatus.Paused) {
    return interaction.reply('Playback is not paused.');
  }
  queue.player.unpause();
  return interaction.reply('Resumed playback.');
}

export async function nowplaying(interaction) {
  const queue = getQueue(interaction.guildId);
  if (!queue.currentSong) {
    return interaction.reply('Nothing is currently playing.');
  }
  const s = queue.currentSong;
  return interaction.reply({
    embeds: [{
      color: 0x5865F2,
      title: s.title,
      url: s.url,
      thumbnail: s.thumbnail ? { url: s.thumbnail } : undefined,
      fields: [
        { name: 'Duration', value: formatDuration(s.duration), inline: true },
        { name: 'Requested by', value: s.requestedBy, inline: true },
      ],
    }],
  });
}
