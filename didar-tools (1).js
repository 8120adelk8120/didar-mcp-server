/**
 * ابزارهای اتصال به CRM دیدار (نسخه‌ی نهایی و تست‌شده)
 * ---------------------------------------------------------
 * الگوی API دیدار: https://app.didar.me/api/{entity}/{method}?apikey=API_KEY
 *
 * نکات کشف‌شده از تست واقعی:
 * - ثبت معامله (Deal) نیاز به یک مخاطب (Contact/Person) داره؛ پس اول Contact
 *   ساخته می‌شه و شناسه‌اش (Id) به‌عنوان PersonId به Deal داده می‌شه.
 * - فیلد مرتبط‌کننده در Deal.Save اسمش "PersonId" است (نه "ContactId").
 * - Deal.Save نیاز به "PipelineStageId" داره؛ چون هنوز کاریز/مرحله‌ی
 *   مشخصی تعریف نشده، از یک مقدار پیش‌فرض استفاده می‌کنیم (قابل تغییر).
 * - فیلد "Description" برای متن ساختاریافته (نوع/دسته‌بندی/استان/شهر/شرح)
 *   استفاده می‌شه — دقیقاً مثل COMMENTS در بیتریکس۲۴.
 */
import fetch from "node-fetch";

const BASE_URL = "https://app.didar.me/api";

// مقدار پیش‌فرض PipelineStageId — چون در این حساب هنوز کاریز مشخصی تعریف نشده
// از یک GUID placeholder استفاده می‌شود. اگر بعداً کاریز واقعی ساختید،
// این مقدار را با شناسه‌ی واقعی مرحله جایگزین کنید.
const DEFAULT_PIPELINE_STAGE_ID = "11111111-1111-1111-1111-111111111111";

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
      throw new Error(`پاسخ غیرمنتظره از دیدار (status ${res.status}): ${text.slice(0, 300)}`);
    }
    if (data.Error) {
      throw new Error(`خطای دیدار: ${data.Error}`);
    }
    return data.Response !== undefined ? data.Response : data;
  }

  const TOOLS = [
    {
      name: "didar_raw_call",
      description:
        "یک درخواست خام و آزمایشی به هر entity/method دلخواه در API دیدار می‌فرسته. برای کشف ساختار فیلدهای جدید استفاده می‌شه.",
      inputSchema: {
        type: "object",
        properties: {
          entity: { type: "string", description: "مثلاً deal, contact, company" },
          method: { type: "string", description: "مثلاً save, search" },
          payload: { type: "object", description: "بدنه‌ی JSON درخواست" },
        },
        required: ["entity", "method"],
      },
    },
    {
      name: "create_lead_didar",
      description:
        "ثبت یک معامله (Deal) جدید در دیدار به‌عنوان لید (اعلام/درخواست ظرفیت). خودش اول مخاطب می‌سازه و بعد معامله رو بهش وصل می‌کنه.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "عنوان معامله، مثلاً: درخواست ظرفیت - حمل و نقل - تهران" },
          name: { type: "string", description: "نام مخاطب" },
          lastname: { type: "string", description: "نام خانوادگی مخاطب (اگه نبود، از name استفاده می‌شه)" },
          phone: { type: "string", description: "شماره موبایل مخاطب" },
          email: { type: "string", description: "ایمیل مخاطب (اختیاری)" },
          comments: { type: "string", description: "توضیحات ساختاریافته: نوع/دسته‌بندی/استان/شهر/شرح" },
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
        const url = `${BASE_URL}/${args.entity}/${args.method}?apikey=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args.payload || {}),
        });
        const text = await res.text();
        return { content: [{ type: "text", text }] };
      }

      case "create_lead_didar": {
        // قدم ۱: ساخت مخاطب
        const contact = await callDidar("contact", "save", {
          Contact: {
            FirstName: args.name || "لید سایت",
            Lastname: args.lastname || args.name || "زرفیت خالی",
            MobilePhone: args.phone || "",
            Email: args.email || "",
          },
        });

        // قدم ۲: ساخت معامله و وصل‌کردنش به همون مخاطب
        const deal = await callDidar("deal", "save", {
          Deal: {
            Title: args.title,
            PersonId: contact.Id,
            PipelineStageId: DEFAULT_PIPELINE_STAGE_ID,
            Description: args.comments || "",
          },
        });

        return {
          content: [
            {
              type: "text",
              text: `مخاطب (${contact.Id}) و معامله (${deal.Id}) با موفقیت در دیدار ثبت شدند.`,
            },
          ],
        };
      }

      case "list_leads_didar": {
        const result = await callDidar("deal", "search", {
          Criteria: {},
          From: 0,
          Limit: args.limit || 30,
        });
        const simplified = (result.List || []).map((d) => ({
          Id: d.Id,
          Title: d.Title,
          Description: d.Description,
          Status: d.Status,
          RegisterTime: d.RegisterTime,
          Person: d.Person ? d.Person.DisplayName : null,
          Phone: d.Person ? d.Person.MobilePhone : null,
        }));
        return { content: [{ type: "text", text: JSON.stringify(simplified, null, 2) }] };
      }

      default:
        throw new Error(`ابزار ناشناخته: ${name}`);
    }
  }

  return { TOOLS, callTool };
}
