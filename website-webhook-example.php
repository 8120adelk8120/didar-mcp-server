<?php
/**
 * نمونه کد ارسال لید از سایت zarfiatekhali.ir به بیتریکس۲۴
 * ---------------------------------------------------------
 * این کد رو باید توی همون قسمتی از سایت که فرم «اعلام ظرفیت»
 * یا «درخواست ظرفیت» رو ثبت می‌کنه (بعد از ذخیره موفق در دیتابیس سایت) صدا بزنید.
 *
 * اگه سایت وردپرسی‌ست، این تابع رو می‌تونید داخل functions.php
 * یا پلاگین سفارشی سایت قرار بدید و بعد از موفقیت‌آمیز بودن ثبت آگهی
 * فراخوانی‌اش کنید: send_lead_to_bitrix24(...)
 */

function send_lead_to_bitrix24(string $title, string $name, string $phone, string $email = '', string $comments = ''): void
{
    // لینک وبهوک ورودی که از پنل بیتریکس۲۴ گرفتید (crm.lead.add باید مجاز باشه)
    $webhookUrl = 'https://yourcompany.bitrix24.com/rest/1/xxxxxxxxxxxxxxx/crm.lead.add.json';

    $fields = [
        'TITLE'    => $title,
        'NAME'     => $name,
        'COMMENTS' => $comments,
    ];

    if (!empty($phone)) {
        $fields['PHONE'] = [['VALUE' => $phone, 'VALUE_TYPE' => 'WORK']];
    }
    if (!empty($email)) {
        $fields['EMAIL'] = [['VALUE' => $email, 'VALUE_TYPE' => 'WORK']];
    }

    $payload = json_encode(['fields' => $fields]);

    $ch = curl_init($webhookUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8); // اگه بیتریکس کند بود، سایت رو معطل نکنه

    $response = curl_exec($ch);
    curl_close($ch);

    // پیشنهاد: نتیجه رو لاگ کنید تا اگه ارسال به بیتریکس ناموفق بود متوجه بشید
    error_log('Bitrix24 lead sync response: ' . $response);
}

/**
 * نمونه‌ی استفاده — جایی که فرم «درخواست ظرفیت خالی» با موفقیت ثبت می‌شود:
 *
 * send_lead_to_bitrix24(
 *     'درخواست ظرفیت - حمل و نقل - اصفهان',
 *     $_POST['full_name'],
 *     $_POST['phone'],
 *     $_POST['email'] ?? '',
 *     'دسته‌بندی: حمل و نقل | استان: اصفهان'
 * );
 */
