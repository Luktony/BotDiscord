import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits } from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior
} from '@discordjs/voice';

import playdl from 'play-dl';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
let queue = [];
let connection = null;
let currentVoiceChannel = null;

client.once('ready', async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);


  await playdl.setToken({
    soundcloud: {
      client_id: process.env.SC_CLIENT_ID
    }
  });
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const args = message.content.trim().split(' ');
  const command = args.shift().toLowerCase();

  if (command === '!tocar') {
    const query = args.join(' ');
    if (!query) return message.reply('❗ Você precisa digitar o nome da música.');

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply('❗ Você precisa estar em um canal de voz.');

    currentVoiceChannel = voiceChannel;

    if (!connection) {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator
      });
      connection.subscribe(player);
    }

    try {
      const results = await playdl.search(query, { source: { soundcloud: true } });

      if (!results || results.length === 0) {
        return message.reply('❌ Nenhuma música encontrada no SoundCloud.');
      }

      const track = results[0];
      queue.push(track.url);

      if (player.state.status !== AudioPlayerStatus.Playing) {
        tocarProximaMusica(message);
      } else {
        message.reply(`✅ Música adicionada à fila: ${track.title}`);
      }
    } catch (err) {
      console.error('Erro ao buscar:', err);
      message.reply('❌ Erro ao buscar música no SoundCloud.');
    }
  }

  else if (command === '!pular') {
    if (queue.length === 0) return message.reply('📭 A fila está vazia.');
    player.stop();
    message.reply('⏭️ Música pulada.');
  }

  else if (command === '!parar') {
    queue = [];
    player.stop();
    if (connection) {
      connection.destroy();
      connection = null;
    }
    message.reply('🛑 Música parada e desconectado.');
  }

  else if (command === '!pausar') {
    player.pause();
    message.reply('⏸️ Música pausada.');
  }

  else if (command === '!voltar') {
    player.unpause();
    message.reply('▶️ Música retomada.');
  }

  else if (command === '!comandos') {
    message.reply(`
📜 **Comandos disponíveis:**
- \`!tocar [nome ou link]\` → Toca uma música do SoundCloud
- \`!pular\` → Pula a música atual
- \`!pausar\` → Pausa a música
- \`!voltar\` → Retoma a música pausada
- \`!parar\` → Para tudo e sai do canal de voz
- \`!comandos\` → Lista os comandos disponíveis
    `);
  }
});

async function tocarProximaMusica(message) {
  if (queue.length === 0) {
    message.channel.send('📭 Fila vazia. Encerrando...');
    if (connection) {
      connection.destroy();
      connection = null;
    }
    return;
  }

  const url = queue.shift();
  try {
    const stream = await playdl.stream(url);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type
    });

    player.play(resource);
    message.channel.send(`🎶 Tocando agora: ${url}`);
  } catch (err) {
    console.error('Erro ao tocar:', err);
    message.channel.send('❌ Erro ao tentar tocar a música. Pulando...');
    tocarProximaMusica(message);
  }
}

client.login(process.env.DISCORD_TOKEN);
