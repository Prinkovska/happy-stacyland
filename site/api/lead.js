/* =========================================================
   Happy Stacyland — приймач заявок з форм сайту (Vercel Serverless Function)
   Пересилає анкету майбутнього власника і запити на чек-лист у Telegram.

   ЗАПРАЦЮЄ ЛИШЕ НА VERCEL. Щоб увімкнути:
   1. У Telegram напишіть @BotFather → /newbot → отримайте токен бота.
   2. Напишіть своєму боту будь-яке повідомлення, потім відкрийте
      https://api.telegram.org/bot<ТОКЕН>/getUpdates — там буде ваш chat id.
   3. У Vercel → Project → Settings → Environment Variables додайте:
        TELEGRAM_BOT_TOKEN = токен бота
        TELEGRAM_CHAT_ID   = ваш chat id
   4. У site/js/main.js встановіть SITE.formEndpoint = '/api/lead'.
   Токен ніколи не потрапляє в код сайту — лише в налаштування Vercel.
   ========================================================= */

const FORM_TITLES = {
  anketa: '🐾 Нова анкета — лист очікування',
  guide: '📋 Запит на чек-лист'
};

const LABELS = {
  name: "Ім'я", city: 'Місто', phone: 'Телефон', email: 'Email', contact: 'Контакт',
  messenger: 'Месенджер', sex: 'Стать', color: 'Окрас', purpose: 'Для чого', when: 'Коли',
  home: 'Житло', kids: 'Діти', experience: 'Досвід', alone: 'Сама на день', pets: 'Інші тварини',
  why: 'Чому цвергпінчер', questions: 'Питання', source: 'Звідки дізнались'
};

function escapeHtml(value) {
  return String(value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    res.status(500).json({ ok: false, error: 'Telegram не налаштовано' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const data = body.data || {};
  if (data.website) { res.status(200).json({ ok: true }); return; }  /* спам-бот */

  const lines = [`<b>${escapeHtml(FORM_TITLES[body.form] || 'Заявка з сайту')}</b>`, ''];
  Object.keys(data).forEach((key) => {
    if (key === 'consent' || key === 'website' || !data[key]) return;
    lines.push(`<b>${escapeHtml(LABELS[key] || key)}:</b> ${escapeHtml(String(data[key]).slice(0, 1000))}`);
  });

  const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: lines.join('\n'), parse_mode: 'HTML' })
  });

  res.status(tg.ok ? 200 : 502).json({ ok: tg.ok });
};
