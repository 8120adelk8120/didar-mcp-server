/**
 * منطق مشترک ابزارهای بیتریکس۲۴ — هم توسط index.js (لوکال/Stdio)
 * و هم توسط server-http.js (آنلاین/Render) استفاده می‌شه.
 */
import fetch from "node-fetch";

export function makeBitrixTools(webhookUrl) {
  async function callBitrix(method, params = {}) {
    const url = `${webhookUrl.replace(/\/$/, "")}/${method}.json`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (data.error) {
      throw new Error(`Bitrix24 error: ${data.error} - ${data.error_description || ""}`);
    }
    return data.result;
  }

  const TOOLS = [
    {
      name: "create_lead",
      description:
        "ثبت یک لید جدید در بیتریکس24 (مثلاً یک درخواست یا اعلام ظرفیت از سایت ظرفیت خالی).",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "عنوان لید، مثلاً: درخواست ظرفیت - حمل و نقل" },
          name: { type: "string", description: "نام مخاطب" },
          phone: { type: "string", description: "شماره تماس" },
          email: { type: "string", description: "ایمیل (اختیاری)" },
          comments: { type: "string", description: "توضیحات، دسته‌بندی یا استان (اختیاری)" },
        },
        required: ["title"],
      },
    },
    {
      name: "list_leads",
      description: "گرفتن لیست آخرین لیدهای ثبت‌شده در بیتریکس24.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "تعداد لیدها (پیش‌فرض ۲۰)" },
        },
      },
    },
    {
      name: "get_lead",
      description: "گرفتن جزئیات یک لید مشخص با شناسه آن.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "number", description: "شناسه (ID) لید" } },
        required: ["id"],
      },
    },
    {
      name: "update_lead_status",
      description: "تغییر وضعیت (Status) یک لید.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number", description: "شناسه لید" },
          status: { type: "string", description: "کد وضعیت بیتریکس24، مثلاً NEW, IN_PROCESS, CONVERTED, JUNK" },
        },
        required: ["id", "status"],
      },
    },
  ];

  async function callTool(name, args) {
    switch (name) {
      case "create_lead": {
        const fields = {
          TITLE: args.title,
          NAME: args.name || "",
          COMMENTS: args.comments || "",
        };
        if (args.phone) fields.PHONE = [{ VALUE: args.phone, VALUE_TYPE: "WORK" }];
        if (args.email) fields.EMAIL = [{ VALUE: args.email, VALUE_TYPE: "WORK" }];
        const result = await callBitrix("crm.lead.add", { fields });
        return { content: [{ type: "text", text: `لید با شناسه ${result} با موفقیت ثبت شد.` }] };
      }
      case "list_leads": {
        const result = await callBitrix("crm.lead.list", {
          order: { ID: "DESC" },
          select: ["ID", "TITLE", "NAME", "PHONE", "EMAIL", "STATUS_ID", "DATE_CREATE"],
          start: 0,
        });
        const limited = result.slice(0, args.limit || 20);
        return { content: [{ type: "text", text: JSON.stringify(limited, null, 2) }] };
      }
      case "get_lead": {
        const result = await callBitrix("crm.lead.get", { id: args.id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "update_lead_status": {
        await callBitrix("crm.lead.update", { id: args.id, fields: { STATUS_ID: args.status } });
        return { content: [{ type: "text", text: `وضعیت لید ${args.id} به ${args.status} تغییر کرد.` }] };
      }
      default:
        throw new Error(`ابزار ناشناخته: ${name}`);
    }
  }

  return { TOOLS, callTool };
}
