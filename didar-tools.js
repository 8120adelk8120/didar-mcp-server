/**
 * ابزارهای اتصال به CRM دیدار
 * ---------------------------------------------------------
 * الگوی API دیدار: https://app.didar.me/api/{entity}/{method}?apikey=API_KEY
 * (مثلاً: app.didar.me/api/contact/save?apikey=...)
 *
 * چون مستندات دقیق فیلدهای «معامله» (Deal) در دسترس نبود، این ماژول یه
 * ابزار «تست خام» (raw_call) هم داره تا بتونیم entity/method درست رو
 * به‌صورت آزمایشی پیدا کنیم — دقیقاً مثل کاری که با Request Builder
 * بیتریکس۲۴ انجام دادیم.
 */
import fetch from "node-fetch";

const BASE_URL = "https://app.didar.me/api";

export function makeDidarTools(apiKey) {
  async function callDidar(entity, method, payload = {}) {
    const url = `${BASE_URL}/${entity}/${method}?apikey=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // اگه پاسخ JSON نبود (مثلاً یه صفحه‌ی خطای HTML)، متن خام رو برگردون
      throw new Error(`پاسخ غیرمنتظره از دیدار (status ${res.status}): ${text.slice(0, 300)}`);
    }
    return data;
  }

  const TOOLS = [
    {
      name: "didar_raw_call",
      description:
        "یک درخواست خام و آزمایشی به هر entity/method دلخواه در API دیدار می‌فرسته. برای کشف ساختار درست فیلدها (چون مستندات کامل در دسترس نیست) استفاده می‌شه. مثال: entity='deal', method='save', payload={Title:'تست'}",
      inputSchema: {
        type: "object",
        properties: {
          entity: { type: "string", description: "مثلاً deal, contact, company" },
          method: { type: "string", description: "مثلاً save, search, load" },
          payload: { type: "object", description: "بدنه‌ی JSON درخواست" },
        },
        required: ["entity", "method"],
      },
    },
    {
      name: "create_lead_didar",
      description:
        "ثبت یک معامله (Deal) جدید در دیدار به‌عنوان لید (اعلام/درخواست ظرفیت). این یک حدس اولیه از ساختار فیلدهاست و ممکنه نیاز به اصلاح داشته باشه.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "عنوان معامله" },
          description: { type: "string", description: "توضیحات ساختاریافته (نوع/دسته‌بندی/استان/شهر/شرح)" },
        },
        required: ["title"],
      },
    },
    {
      name: "list_leads_didar",
      description: "جستجوی معاملات (Deal) ثبت‌شده در دیدار.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "تعداد نتایج (پیش‌فرض ۳۰)" },
        },
      },
    },
  ];

  async function callTool(name, args) {
    switch (name) {
      case "didar_raw_call": {
        const result = await callDidar(args.entity, args.method, args.payload || {});
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "create_lead_didar": {
        const result = await callDidar("deal", "save", {
          Title: args.title,
          Description: args.description || "",
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "list_leads_didar": {
        const result = await callDidar("deal", "search", {
          Criteria: {},
          From: 0,
          Limit: args.limit || 30,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      default:
        throw new Error(`ابزار ناشناخته: ${name}`);
    }
  }

  return { TOOLS, callTool };
}
