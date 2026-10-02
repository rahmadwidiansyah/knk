/** Template workflow sederhana — dikembalikan sebagai json_config siap simpan. */

export interface Template {
  id: string;
  icon: string;
  title: string;
  desc: string;
  steps: string[];
  make: (connectorName?: string) => any;
}

export const TEMPLATES: Template[] = [
  {
    id: "tg-notif",
    icon: "telegram",
    title: "Notifikasi Telegram",
    desc: "Webhook → Cek → Telegram",
    steps: ["Webhook", "Condition", "Telegram"],
    make: (connectorName = "tg_main") => ({
      name: "Notifikasi Telegram",
      description: "Kirim pesan ketika webhook masuk dan lolos cek",
      trigger: { type: "webhook", config: {} },
      nodes: [
        {
          id: "cek",
          type: "condition",
          name: "Cek penting",
          config: { expression: "{{trigger.penting}} === true" },
          next_true: "kirim",
          next_false: "step_end",
        },
        {
          id: "kirim",
          type: "send_telegram",
          name: "Kirim ke admin",
          config: {
            connector_id: `{{connector.${connectorName}}}`,
            chat_id: "{{trigger.chat_id}}",
            text: "Ada kabar baru: {{trigger.text}}",
          },
          next: "step_end",
        },
      ],
    }),
  },
  {
    id: "sched-http",
    icon: "globe",
    title: "HTTP Terjadwal",
    desc: "Schedule → HTTP → Log",
    steps: ["Schedule", "HTTP", "Log"],
    make: () => ({
      name: "Cek API Pagi",
      description: "Panggil API tiap pagi lalu catat",
      trigger: { type: "schedule", config: { cron: "0 7 * * *", timezone: "Asia/Jakarta" } },
      nodes: [
        {
          id: "panggil",
          type: "http_request",
          name: "Panggil API",
          config: { url: "https://api.example.com/status", method: "GET", headers: {} },
          next: "catat",
        },
        {
          id: "catat",
          type: "log",
          name: "Catat hasil",
          config: { message: "Status: {{panggil.body}}" },
          next: "step_end",
        },
      ],
    }),
  },
  {
    id: "wa-daily",
    icon: "whatsapp",
    title: "Pengingat WA Harian",
    desc: "Schedule → WhatsApp",
    steps: ["Schedule", "WhatsApp"],
    make: (connectorName = "waha_main") => ({
      name: "Pengingat Pagi",
      description: "Kirim WA tiap jam 7 pagi",
      trigger: { type: "schedule", config: { cron: "0 7 * * *", timezone: "Asia/Jakarta" } },
      nodes: [
        {
          id: "kirim",
          type: "send_waha",
          name: "Kirim pengingat",
          config: {
            connector_id: `{{connector.${connectorName}}}`,
            to: "62812@c.us",
            text: "Selamat pagi! Jangan lupa hari ini",
          },
          next: "step_end",
        },
      ],
    }),
  },
];
