import { Message, Client, MessageEmbed } from "discord.js";
import { parseLink, ParserError, validateLink, clear } from './parser';
import config from 'config';

const HISTORY_LIMIT: number = config.get('historyLimit');

export async function handleQuery(ctx: Message, client: Client, args?: Map<string, string>) {
  const link = args?.get('link');
  // If no link is provided search in the last 50 messages for an attachment.
  if (!link) {
    ctx.channel.messages.fetch({ limit: HISTORY_LIMIT })
      .then(async messages => {
        const firsMessageWithAttachment = messages.find(message => {
          if (message.attachments.size === 0) return false;
          try {
            validateLink(message.attachments.first()!.attachment.toString());
          } catch (err) {
            return false;
          }
          return true;
        });
        if (firsMessageWithAttachment) {
          const attachmentObject = firsMessageWithAttachment.attachments!.first()!;
          parseLink(attachmentObject.attachment.toString())
            .then(async picturePath => {
              await ctx.channel.send(
                new MessageEmbed()
                  .setDescription(`${attachmentObject.name} shared by ${firsMessageWithAttachment.member?.displayName}`)
                  .attachFiles([picturePath]));
              clear(picturePath);
            })
            .catch(async (err: ParserError) => {
              await ctx.channel.send(err.message);
            })
        } else {
          await ctx.channel.send(`Could not find a valid file in the last ${HISTORY_LIMIT} messages.`);
        }
      })
  } else {
    parseLink(link)
      .then(async picturePath => {
        await ctx.channel.send(new MessageEmbed().attachFiles([picturePath]));
        clear(picturePath);
      })
      .catch(async (err: ParserError) => {
        await ctx.channel.send(err.message);
      })
  }
}
