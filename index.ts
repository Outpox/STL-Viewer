import * as Discord from 'discord.js';
import { Command, ChannelType } from "./src/lib/command";
import { handleQuery } from "./src/bot";
import config from 'config';

const client = new Discord.Client();

const commandBag = [
  new Command({
    prefix: '!stlview',
    func: (ctx, args) => handleQuery(ctx, client, args),
    args: ['link'],
    requiredArgs: false,
    allowedChannels: [ChannelType.TextChannel],
  })
]

client.on('ready', async () => {
  console.log('Bot ready!')
})

client.on('message', message => {
  commandBag.map(cmd => {
    cmd.execute(message)
  })
})

client.login(config.get('token'));