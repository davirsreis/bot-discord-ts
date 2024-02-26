import MercadoPagoConfig, { Payment } from "mercadopago";
import fs from 'fs';
import path from 'path';
import { Client, TextChannel } from 'discord.js';

const dbFilePath = path.resolve(__dirname, '../discord/db/pending.json');
const accessToken = process.env.ACCESS_TOKEN || 'token';
const client = new Client({
  intents: ['Guilds', 'GuildMessages'],
});
const paymentClient = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
const payment = new Payment(paymentClient);

client.login(process.env.BOT_TOKEN);

function readPendingData() {
  try {
    const data = fs.readFileSync(dbFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler o arquivo pending.json:', error);
    return [];
  }
}

// Cancelar
async function cancelarSolicitacao(paymentId: number | string) {

  if (!paymentId) return;

  payment.cancel({ id: paymentId });
  console.log("Transação cancelada!");
}

// Verificar o status
async function verificarStatus(paymentId: number | string) {

  const paymentInfo = await payment.get({ id: paymentId });

  if (!paymentInfo) return;

  if (paymentInfo.status === 'approved') {

    return true;
  } else {

    return false;
  }
}

function readDbData() {
  try {
    const data = fs.readFileSync(dbFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler o arquivo db.json:', error);
    return [];
  }
}

// Escrever os dados no arquivo
function writeDbData(data: any) {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Erro ao escrever no arquivo db.json:', error);
  }
}

// Remover um pagamento
function removerPagamentoPendente(paymentId: number | string) {
  const dbData = readDbData();
  const updatedData = dbData.filter((payment: { paymentId: string | number; }) => payment.paymentId !== paymentId);
  writeDbData(updatedData);
}

export let loopAtivo = false;

export function loopVerificacao() {

  const pendingData = readPendingData();

  if (pendingData.length === 0) {
    console.log("Não há pagamentos pendentes. O loop de verificação será desativado.");
    loopAtivo = false
    return;
  }

  loopAtivo = true;

  setTimeout(() => {
    const pendingData = readPendingData();
    const currentTime = new Date().getTime();

    pendingData.forEach(async (payment: { time: string | number | Date; paymentId: string | number; channelId: string }) => {
      const paymentTime = new Date(payment.time).getTime();
      const elapsedTime = currentTime - paymentTime;

      // Verificando se passou 1 hora desde o pagamento
      if (elapsedTime >= 3600000) { // 1 hora

        console.log(`O pagamento com ID ${payment.paymentId} excedeu o prazo e será cancelado.`);

        removerPagamentoPendente(payment.paymentId);
        cancelarSolicitacao(payment.paymentId)
        return;
      }

      if (await verificarStatus(payment.paymentId)) {
        console.log(`O pagamento com ID ${payment.paymentId} foi aprovado!`);
        removerPagamentoPendente(payment.paymentId);

        // Enviando mensagem de aprovação para o canal
        const channel = await client.channels.fetch(payment.channelId) as TextChannel;

        if (channel) {
          channel.send("Pagamento aprovado!");
        } else {
          console.error(`Canal com ID ${payment.channelId} não encontrado.`);
        }
        return;
      }

    });
    console.log("Esperando mudança");
    loopVerificacao();
  }, 60000); // 1 minuto
}
