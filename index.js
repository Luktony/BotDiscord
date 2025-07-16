require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');

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

client.once('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const args = message.content.trim().split(' ');
  const command = args.shift().toLowerCase();

  if (command === '!tocar') {
    const query = args.join(' ');
    if (!query) return message.reply('❗ Você precisa digitar um link ou nome da música.');

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

    let url;
    if (ytdl.validateURL(query)) {
      url = query;
    } else {
      const searchResults = await ytSearch(query);
      const videos = searchResults.videos.slice(0, 5);

      if (videos.length === 0) {
        return message.reply('❌ Nenhum vídeo encontrado.');
      }

      let response = '**Escolha uma música digitando o número (1 a 5):**\n\n';
      videos.forEach((video, index) => {
        response += `${index + 1}. ${video.title} (${video.timestamp})\n`;
      });

      await message.reply(response);

      const filter = msg => msg.author.id === message.author.id && /^[1-5]$/.test(msg.content.trim());
      try {
        const collected = await message.channel.awaitMessages({ filter, max: 1, time: 15000, errors: ['time'] });
        const choice = parseInt(collected.first().content.trim(), 10);
        url = videos[choice - 1].url;
      } catch {
        return message.reply('⏱️ Tempo esgotado ou escolha inválida. Cancelando.');
      }
    }

    queue.push(url);
    if (player.state.status !== AudioPlayerStatus.Playing) {
      tocarProximaMusica(message);
    } else {
      message.reply('✅ Música adicionada à fila.');
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
- \`!tocar [nome ou link]\` → Toca uma música
- \`!pular\` → Pula a música atual
- \`!pausar\` → Pausa a música
- \`!voltar\` → Retoma a música pausada
- \`!parar\` → Para tudo e sai do canal de voz
- \`!comandos\` → Lista os comandos disponíveis
    `);
  }
});

function tocarProximaMusica(message) {
  if (queue.length === 0) {
    message.channel.send('📭 Fila vazia. Encerrando...');
    if (connection) {
      connection.destroy();
      connection = null;
    }
    return;
  }

  const url = queue.shift();
  const stream = ytdl(url, { filter: 'audioonly' });
  const resource = createAudioResource(stream);

  player.play(resource);
  message.channel.send(`🎶 Tocando agora: ${url}`);
}

client.login(process.env.DISCORD_TOKEN);
