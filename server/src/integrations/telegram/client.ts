import axios from "axios";

const TG = "https://api.telegram.org";

export async function tgGetMe(botToken: string): Promise<{ ok: boolean; username?: string; raw: any }> {
  const res = await axios.get(`${TG}/bot${botToken}/getMe`, { timeout: 15000, validateStatus: () => true });
  if (!res.data?.ok) {
    throw Object.assign(new Error(`Telegram getMe gagal: ${JSON.stringify(res.data).slice(0, 300)}`), {
      status: 502,
    });
  }
  return { ok: true, username: res.data.result?.username, raw: res.data.result };
}

export async function tgSendMessage(
  botToken: string,
  chatId: string | number,
  text: string,
  parseMode?: string
): Promise<any> {
  const body: Record<string, any> = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;
  const res = await axios.post(`${TG}/bot${botToken}/sendMessage`, body, {
    timeout: 15000,
    validateStatus: () => true,
  });
  if (!res.data?.ok) {
    throw Object.assign(new Error(`Telegram sendMessage gagal: ${JSON.stringify(res.data).slice(0, 500)}`), {
      status: 502,
    });
  }
  return res.data.result;
}
