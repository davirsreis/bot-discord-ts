import { Command, Component, Modal } from "@/discord/base";
import { settings } from "@/settings";
import { brBuilder, createEmbedAuthor, createModalInput, createRow, hexToRgb } from "@magicyan/discord";
import { ApplicationCommandOptionType, ApplicationCommandType, Attachment, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, Collection, ComponentType, EmbedBuilder, ModalBuilder, TextChannel, TextInputStyle, codeBlock } from "discord.js";

interface MessageProps {
  channelId: string,
}

const members: Collection<string, MessageProps> = new Collection();
const buttonDataMap = new Map();

new Command({
  name: "anunciar",
  description: "Comando de anúncios",
  dmPermission: false,
  type: ApplicationCommandType.ChatInput,
  async run(interaction) {
    const { member } = interaction;

    members.set(member.id, {
      channelId: "1207357832916369488",
    });

    await interaction.showModal(new ModalBuilder({
      customId: "announcement-modal",
      title: "Fazer um anúncio",
      components: [
        createModalInput({
          customId: "announcement-title-input",
          label: "Título",
          placeholder: "Insira o título",
          style: TextInputStyle.Short,
          maxLength: 256,
        }),
        createModalInput({
          customId: "announcement-valor-input",
          label: "Preço",
          placeholder: "Insira o Preço",
          style: TextInputStyle.Short,
          maxLength: 256,
        }),
        createModalInput({
          customId: "announcement-stock-input",
          label: "Stock",
          placeholder: "Insira o Stock",
          style: TextInputStyle.Short,
          maxLength: 256,
        }),
        createModalInput({
          customId: "announcement-min-input",
          label: "Mínimo",
          placeholder: "Insira o mínimo",
          style: TextInputStyle.Short,
          maxLength: 256,
          required: false
        })
      ]
    }));
  },
})

new Modal({
  customId: "announcement-modal", cache: "cached",
  async run(interaction) {
    const { user } = interaction;
    const { fields, guild, member } = interaction;

    const messageProps = members.get(member.id);
    if (!messageProps) {
      interaction.reply({
        ephemeral,
        content: "Não foi possível obter os dados iniciais! Utilize o comando novamente"
      });
      return;
    }

    const title = fields.getTextInputValue("announcement-title-input")
    const valor = fields.getTextInputValue("announcement-valor-input")
    const stock = fields.getTextInputValue("announcement-stock-input")
    const min = fields.getTextInputValue("announcement-min-input")

    const embed = new EmbedBuilder({
      author: createEmbedAuthor({ user, prefix: "Vendedor: " }),
      title,
      fields: [{ name: "Valor", value: valor }, { name: "Stock", value: stock }, { name: "Mínimo", value: min }],
      color: hexToRgb(settings.colors.theme.default),
    });

    await interaction.deferReply({ephemeral, fetchReply});

    const message = await interaction.editReply({
      embeds: [embed],
      components: [
        createRow(
          new ButtonBuilder({
            customId: "announcement-confirm-button", style: ButtonStyle.Success,
            label: "Confirmar"
          }),
          new ButtonBuilder({
            customId: "announcement-cancel-button", style: ButtonStyle.Danger,
            label: "Cancelar"
          }),
        )
      ]
    })

    const collector = message.createMessageComponentCollector();
    collector.on("collect", async (subInteraction) => {
      const { customId } = subInteraction;
      
      collector.stop();

      if (customId === "announcement-cancel-button") {
        subInteraction.update({
          embeds, components, files: [],
          content: "Ação cancelada!"
        });
        return;
      }
      await subInteraction.deferUpdate();

      const channel = guild.channels.cache.get(messageProps.channelId) as TextChannel;

      const rowWithButton = createRow(
        new ButtonBuilder({
          customId: "buy-component-button", style: ButtonStyle.Success,
          label: "Comprar"
        })
      );

      buttonDataMap.set("buy-component-button", { sellerId: user });

      channel.send({ embeds: [embed], components: [rowWithButton] })
        .then(msg => {
          interaction.editReply({
            components, embeds,
            content: `Mensagem enviada com sucesso! Confira: ${msg.url}`
          })
        })
        .catch(err => {
          interaction.editReply({
            components, embeds,
            content: brBuilder("Não foi possível enviar a mensagem", codeBlock("bash", err))
          });
        });
      members.delete(member.id);
    });

  }
});

export default buttonDataMap;