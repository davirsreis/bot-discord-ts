import { Component } from "@/discord/base";
import { ChannelType, ComponentType } from "discord.js";
import buttonDataMap from "../commands/public/announcement";
import { MercadoPagoConfig, Payment } from 'mercadopago';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { loopVerificacao, loopAtivo } from "@/functions/auxPending";

const paymentDataFilePath = path.resolve(__dirname, '../db/pending.json');

let paymentDataArray: any[] = [];

if (fs.existsSync(paymentDataFilePath)) {
    try {

        const data = fs.readFileSync(paymentDataFilePath, 'utf8');
        console.log('Conteúdo do arquivo:', data);

        if (data.trim() !== '') {

            const parsedData = JSON.parse(data);
            if (Array.isArray(parsedData)) {
                paymentDataArray = parsedData;
            } else {
                console.error('O conteúdo do arquivo não é um array.');
            }
        }
    } catch (error) {
        console.error('Erro ao ler o arquivo:', error);
    }
}

new Component({
    customId: "buy-component-button",
    type: ComponentType.Button, cache: "cached",
    async run(interaction) {
        interaction.reply({ ephemeral, content: "Comprando" });

        const accessToken = process.env.ACCESS_TOKEN || 'token';
        const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000, idempotencyKey: 'zmxnczmnxcmnzxmcnzxncmzxnnnn' } });
        const payment = new Payment(client);

        const body = {
            transaction_amount: 0.1,
            description: 'Produto discord',
            payment_method_id: 'pix',
            payer: {
                email: 'comprador@example.com'
            },
        };

        payment.create({ body }).then(async (response) => {

            const qrCodeData = response.point_of_interaction?.transaction_data?.qr_code; // Supondo que 'qr_code' contenha o URI PIX

            if (!qrCodeData) {
                console.error("URI PIX não encontrado na resposta.");
                return;
            }

            const qrCodeImageBuffer = await qrcode.toBuffer(qrCodeData);

            const buttonId = interaction.customId;
            const additionalData = buttonDataMap.get(buttonId);

            if (!additionalData) {
                console.error("Dados adicionais não encontrados para o botão com o ID:", buttonId);
                return;
            }
            const sellerId = additionalData.sellerId;

            // Criando um novo canal privado
            const guild = interaction.guild;
            const channel = await guild.channels.create({
                name: 'private-channel',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: ['ViewChannel']
                    },
                    {
                        id: sellerId.id,
                        allow: ['ViewChannel']
                    },
                    {
                        id: interaction.user.id,
                        allow: ['ViewChannel']
                    }
                ]
            });

            // Enviando a mensagem e o QR code para o canal privado
            await channel.send({
                content: 'Hello, this is a private channel!',
                files: [{ attachment: qrCodeImageBuffer, name: 'qr_code.png' }]
            });

            // Adicione um novo pagamento ao array
            const currentTime = new Date().toISOString();
            const newPaymentData = {
                paymentId: response.id,
                channelId: channel.id,
                time: currentTime
            };

            paymentDataArray.push(newPaymentData);

            fs.writeFileSync(paymentDataFilePath, JSON.stringify(paymentDataArray));

            // Verificar da atividade do loop
            if (!loopAtivo) {
                console.log("O loop de verificação não está ativo. Ativando agora...");
                loopVerificacao();
            } else {
                console.log("O loop de verificação já está ativo.");
            }

            async function pagamentoAprovado(channelId: number | string) {
                await channel.send({
                    content: 'Hello, this is a private channel!'
                });
            }
        }).catch(console.log);

    },
});
