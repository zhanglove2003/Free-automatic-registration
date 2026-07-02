const SMS_TEST_PURCHASE_IPC_PREFIX = /^Error invoking remote method 'sms:testPurchase': Error:\s*/;

const HERO_SMS_ERROR_MESSAGES: Record<string, string> = {
  NO_NUMBERS: '当前候选国家暂无可购买号码。请更换候选国家、提高最高购买价格，或稍后重试。',
  BAD_KEY: 'SmsHero API Key 无效，请检查设置后重试。',
  NO_BALANCE: 'SmsHero 余额不足，请充值后重试。',
  WRONG_SERVICE: 'SmsHero 服务配置错误，请联系技术支持检查服务代码。',
};

export function formatSmsTestPurchaseError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = rawMessage.replace(SMS_TEST_PURCHASE_IPC_PREFIX, '').trim();
  for (const [code, friendlyMessage] of Object.entries(HERO_SMS_ERROR_MESSAGES)) {
    if (message.includes(code)) {
      return friendlyMessage;
    }
  }
  return message || '测试购买号码失败';
}
