const SMS_TEST_PURCHASE_IPC_PREFIX = /^Error invoking remote method 'sms:testPurchase': Error:\s*/;

export function formatSmsTestPurchaseError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = rawMessage.replace(SMS_TEST_PURCHASE_IPC_PREFIX, '').trim();
  if (message.includes('NO_NUMBERS')) {
    return '当前候选国家暂无可购买号码。请更换候选国家、提高最高购买价格，或稍后重试。';
  }
  return message || '测试购买号码失败';
}
