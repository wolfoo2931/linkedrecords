import { expect } from 'chai';
import assert from 'assert';
import Session from '../helpers/session';
import PaddlePaymentProvider from '../../src/server/payment_provider/paddle';

const paddleProvider = new PaddlePaymentProvider();

function sendPaymentNotification(body, sig?: string) {
  return fetch(`${process.env['SERVER_BASE_URL']}/payment_events/paddle`, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      'Paddle-Signature': sig || paddleProvider.getSignature(body),
    },
  });
}

function getSubscriptionCreatedBody(nodeId: string, storageAfterUpgrade: number): string {
  return `{"data":{"id":"sub_01jq68bfdbptwfsmffgkts2vmp","items":[{"price":{"id":"pri_01jnk9wfg57x3j5199xa1eng7d","name":"Beta version price per year","type":"standard","status":"active","quantity":{"maximum":1,"minimum":1},"tax_mode":"account_setting","seller_id":"28314","created_at":"2025-03-05T14:03:21.477051Z","product_id":"pro_01jnk9p7p2gekwkcayg833ec0p","unit_price":{"amount":"1900","currency_code":"USD"},"updated_at":"2025-03-05T14:03:21.477052Z","custom_data":null,"description":"Beta version price per year","import_meta":null,"trial_period":null,"billing_cycle":{"interval":"year","frequency":1},"unit_price_overrides":[]},"status":"active","product":{"id":"pro_01jnk9p7p2gekwkcayg833ec0p","name":"MonsterWriter 500MB Cloud","type":"standard","status":"active","image_url":"https://www.monsterwriter.com/logo-no-writing.png","seller_id":"28314","created_at":"2025-03-05T13:59:56.866Z","updated_at":"2025-03-05T14:15:43.272Z","custom_data":{"total_storage_available":"${storageAfterUpgrade}"},"description":"Use MonsterWriter in the browser across your devices. Store all your documents in the MonsterWriter cloud.","tax_category":"standard"},"quantity":1,"recurring":true,"created_at":"2025-03-25T08:57:51.787Z","updated_at":"2025-03-25T08:57:51.787Z","trial_dates":null,"next_billed_at":"2026-03-25T08:57:50.7553Z","previously_billed_at":"2025-03-25T08:57:50.7553Z"}],"status":"active","discount":null,"paused_at":null,"address_id":"add_01jq68anq1nj82x13b78y4kyng","created_at":"2025-03-25T08:57:51.787Z","started_at":"2025-03-25T08:57:50.7553Z","updated_at":"2025-03-25T08:57:51.787Z","business_id":null,"canceled_at":null,"custom_data":{"nodeId":"${nodeId}"},"customer_id":"ctm_01jq4sr7x7tkb7k8gyhe2g224j","import_meta":null,"billing_cycle":{"interval":"year","frequency":1},"currency_code":"USD","next_billed_at":"2026-03-25T08:57:50.7553Z","transaction_id":"txn_01jq68aj5dmcg6zdbyqp8fhebt","billing_details":null,"collection_mode":"automatic","first_billed_at":"2025-03-25T08:57:50.7553Z","scheduled_change":null,"current_billing_period":{"ends_at":"2026-03-25T08:57:50.7553Z","starts_at":"2025-03-25T08:57:50.7553Z"}},"event_id":"evt_01jq68bg50983xa91342baw5mk","event_type":"subscription.created","occurred_at":"2025-03-25T08:57:52.544309Z","notification_id":"ntf_01jq68bg8wvr2c6c4wefzsmw28"}`;
}

describe('paddle notification events', () => {
  beforeEach(Session.truncateDB);
  afterEach(Session.afterEach);
  after(Session.deleteBrowsers);

  describe('getSignature helper', () => {
    it('creates the correct signature', () => {
      const body = '{"data":{"id":"sub_01jq68bfdbptwfsmffgkts2vmp","items":[{"price":{"id":"pri_01jnk9wfg57x3j5199xa1eng7d","name":"Beta version price per year","type":"standard","status":"active","quantity":{"maximum":1,"minimum":1},"tax_mode":"account_setting","seller_id":"28314","created_at":"2025-03-05T14:03:21.477051Z","product_id":"pro_01jnk9p7p2gekwkcayg833ec0p","unit_price":{"amount":"1900","currency_code":"USD"},"updated_at":"2025-03-05T14:03:21.477052Z","custom_data":null,"description":"Beta version price per year","import_meta":null,"trial_period":null,"billing_cycle":{"interval":"year","frequency":1},"unit_price_overrides":[]},"status":"active","product":{"id":"pro_01jnk9p7p2gekwkcayg833ec0p","name":"MonsterWriter 500MB Cloud","type":"standard","status":"active","image_url":"https://www.monsterwriter.com/logo-no-writing.png","seller_id":"28314","created_at":"2025-03-05T13:59:56.866Z","updated_at":"2025-03-05T14:15:43.272Z","custom_data":{"total_storage_available":"524288000"},"description":"Use MonsterWriter in the browser across your devices. Store all your documents in the MonsterWriter cloud.","tax_category":"standard"},"quantity":1,"recurring":true,"created_at":"2025-03-25T08:57:51.787Z","updated_at":"2025-03-25T08:57:51.787Z","trial_dates":null,"next_billed_at":null,"previously_billed_at":"2025-03-25T08:57:50.7553Z"}],"status":"active","discount":null,"paused_at":null,"address_id":"add_01jq68anq1nj82x13b78y4kyng","created_at":"2025-03-25T08:57:51.787Z","started_at":"2025-03-25T08:57:50.7553Z","updated_at":"2025-03-26T13:20:12.113Z","business_id":null,"canceled_at":null,"custom_data":{"nodeId":"foo"},"customer_id":"ctm_01jq4sr7x7tkb7k8gyhe2g224j","import_meta":null,"billing_cycle":{"interval":"year","frequency":1},"currency_code":"USD","next_billed_at":null,"billing_details":null,"collection_mode":"automatic","first_billed_at":"2025-03-25T08:57:50.7553Z","scheduled_change":{"action":"cancel","resume_at":null,"effective_at":"2026-03-25T08:57:50.7553Z"},"current_billing_period":{"ends_at":"2026-03-25T08:57:50.7553Z","starts_at":"2025-03-25T08:57:50.7553Z"}},"event_id":"evt_01jq99rk84410detjk7twbvsve","event_type":"subscription.updated","occurred_at":"2025-03-26T13:20:13.572901Z","notification_id":"ntf_01jq99rkpnvcywrk4bt62karcz"}';
      const sig = paddleProvider.getSignature(body, '1742995214');
      expect(sig).to.be.eql('ts=1742995214;h1=d37394383373019744fb7848944f87cccf327c7ab8a22eef8a2aa19cfcce6fad');
    });
  });

  it('is possible to send a payment event in order to upgrade a quota for an user', async () => {
    const client = await Session.getOneSession();
    const nodeId = await client.getActorId();
    const storageBeforeUpgrade = 524288000;
    const storageAfterUpgrade = 5242880000;
    assert(nodeId);

    let quota = await client.getQuota(nodeId);
    expect(quota.totalStorageAvailable).to.eql(storageBeforeUpgrade);

    const body = getSubscriptionCreatedBody(nodeId, storageAfterUpgrade);
    const response = await sendPaymentNotification(body);
    const quotaEvent = await response.json();

    expect(response.status).to.eql(200);
    expect(quotaEvent.totalStorageAvailable).to.eql(storageAfterUpgrade);
    expect(quotaEvent.nodeId).to.eql(nodeId);

    quota = await client.getQuota(nodeId);
    expect(quota.totalStorageAvailable).to.eql(storageAfterUpgrade);
  });

  it('will reject the request when the signature is incorrect', async () => {
    const client = await Session.getOneSession();
    const nodeId = await client.getActorId();
    const storageBeforeUpgrade = 524288000;
    const storageAfterUpgrade = 5242880000;

    let quota = await client.getQuota(nodeId);

    expect(quota.totalStorageAvailable).to.eql(storageBeforeUpgrade);

    const body = getSubscriptionCreatedBody(nodeId, storageAfterUpgrade);

    let response = await sendPaymentNotification(body, 'ts=1742995214;h1=d37394383373019744fb7848944f87cccf327c7ab8a22eef8a2aa19cfcce6fax');
    expect(response.status).to.eql(422);

    response = await sendPaymentNotification(body, 'ts=1742995214;h1=d37394383373019744fb7848944f87cccf327c7ab8a22eef8a2aa19cfcce6faxx');
    expect(response.status).to.eql(422);

    quota = await client.getQuota(nodeId);
    expect(quota.totalStorageAvailable).to.eql(524288000);
  });

  it('is possible to send a payment event in order to upgrade a quota for an attribute id', async () => {
    const client = await Session.getOneSession();
    const org = await client.Attribute.createKeyValue({ x: 'x' });
    const nodeId = org.id;
    const storageBeforeUpgrade = 0;
    const storageAfterUpgrade = 5242880000;

    assert(nodeId);

    let quota = await client.getQuota(nodeId);
    expect(quota.totalStorageAvailable).to.eql(storageBeforeUpgrade);

    const body = getSubscriptionCreatedBody(nodeId, storageAfterUpgrade);
    const response = await sendPaymentNotification(body);
    const quotaEvent = await response.json();

    expect(response.status).to.eql(200);
    expect(quotaEvent.totalStorageAvailable).to.eql(storageAfterUpgrade);
    expect(quotaEvent.nodeId).to.eql(nodeId);

    quota = await client.getQuota(nodeId);
    expect(quota.totalStorageAvailable).to.eql(storageAfterUpgrade);
  });

  it('handles subscription cancel events for user nodes', async () => {
    const client = await Session.getOneSession();
    const nodeId = await client.getActorId();
    const storageBeforeUpgrade = 524288000;
    const storageAfterUpgrade = 5242880000;
    assert(nodeId);

    let quota = await client.getQuota(nodeId);
    expect(quota.totalStorageAvailable).to.eql(storageBeforeUpgrade);

    const body = getSubscriptionCreatedBody(nodeId, storageAfterUpgrade);
    const response = await sendPaymentNotification(body);
    const quotaEvent = await response.json();

    expect(response.status).to.eql(200);
    expect(quotaEvent.totalStorageAvailable).to.eql(storageAfterUpgrade);
    expect(quotaEvent.nodeId).to.eql(nodeId);

    quota = await client.getQuota(nodeId);
    expect(quota.totalStorageAvailable).to.eql(storageAfterUpgrade);

    const cancellationEvent = `{"data":{"id":"sub_01jq68bfdbptwfsmffgkts2vmp","items":[{"price":{"id":"pri_01jnk9wfg57x3j5199xa1eng7d","name":"Beta version price per year","type":"standard","status":"active","quantity":{"maximum":1,"minimum":1},"tax_mode":"account_setting","seller_id":"28314","created_at":"2025-03-05T14:03:21.477051Z","product_id":"pro_01jnk9p7p2gekwkcayg833ec0p","unit_price":{"amount":"1900","currency_code":"USD"},"updated_at":"2025-03-05T14:03:21.477052Z","custom_data":null,"description":"Beta version price per year","import_meta":null,"trial_period":null,"billing_cycle":{"interval":"year","frequency":1},"unit_price_overrides":[]},"status":"active","product":{"id":"pro_01jnk9p7p2gekwkcayg833ec0p","name":"MonsterWriter 500MB Cloud","type":"standard","status":"active","image_url":"https://www.monsterwriter.com/logo-no-writing.png","seller_id":"28314","created_at":"2025-03-05T13:59:56.866Z","updated_at":"2025-03-05T14:15:43.272Z","custom_data":{"total_storage_available":"524288000"},"description":"Use MonsterWriter in the browser across your devices. Store all your documents in the MonsterWriter cloud.","tax_category":"standard"},"quantity":1,"recurring":true,"created_at":"2025-03-25T08:57:51.787Z","updated_at":"2025-03-25T08:57:51.787Z","trial_dates":null,"next_billed_at":null,"previously_billed_at":"2025-03-25T08:57:50.7553Z"}],"status":"active","discount":null,"paused_at":null,"address_id":"add_01jq68anq1nj82x13b78y4kyng","created_at":"2025-03-25T08:57:51.787Z","started_at":"2025-03-25T08:57:50.7553Z","updated_at":"2025-03-26T13:20:12.113Z","business_id":null,"canceled_at":null,"custom_data":{"nodeId":"${nodeId}"},"customer_id":"ctm_01jq4sr7x7tkb7k8gyhe2g224j","import_meta":null,"billing_cycle":{"interval":"year","frequency":1},"currency_code":"USD","next_billed_at":null,"billing_details":null,"collection_mode":"automatic","first_billed_at":"2025-03-25T08:57:50.7553Z","scheduled_change":{"action":"cancel","resume_at":null,"effective_at":"2026-03-25T08:57:50.7553Z"},"current_billing_period":{"ends_at":"2026-03-25T08:57:50.7553Z","starts_at":"2025-03-25T08:57:50.7553Z"}},"event_id":"evt_01jq99rk84410detjk7twbvsve","event_type":"subscription.updated","occurred_at":"2025-03-26T13:20:13.572901Z","notification_id":"ntf_01jq99rkpnvcywrk4bt62karcz"}`;
    await sendPaymentNotification(cancellationEvent);

    quota = await client.getQuota(nodeId);
    expect(quota.totalStorageAvailable).to.eql(storageBeforeUpgrade);
  });

  it('handles subscription cancel events for attribute nodes', async () => {
    const client = await Session.getOneSession();
    const org = await client.Attribute.createKeyValue({ x: 'x' });
    const nodeId = org.id;
    const storageBeforeUpgrade = 0;
    const storageAfterUpgrade = 5242880000;

    assert(nodeId);

    let quota = await client.getQuota(nodeId);
    expect(quota.totalStorageAvailable).to.eql(storageBeforeUpgrade);

    const body = getSubscriptionCreatedBody(nodeId, storageAfterUpgrade);
    const response = await sendPaymentNotification(body);
    const quotaEvent = await response.json();

    expect(response.status).to.eql(200);
    expect(quotaEvent.totalStorageAvailable).to.eql(storageAfterUpgrade);
    expect(quotaEvent.nodeId).to.eql(nodeId);

    quota = await client.getQuota(nodeId);
    expect(quota.totalStorageAvailable).to.eql(storageAfterUpgrade);

    const cancellationEvent = `{"data":{"id":"sub_01jq68bfdbptwfsmffgkts2vmp","items":[{"price":{"id":"pri_01jnk9wfg57x3j5199xa1eng7d","name":"Beta version price per year","type":"standard","status":"active","quantity":{"maximum":1,"minimum":1},"tax_mode":"account_setting","seller_id":"28314","created_at":"2025-03-05T14:03:21.477051Z","product_id":"pro_01jnk9p7p2gekwkcayg833ec0p","unit_price":{"amount":"1900","currency_code":"USD"},"updated_at":"2025-03-05T14:03:21.477052Z","custom_data":null,"description":"Beta version price per year","import_meta":null,"trial_period":null,"billing_cycle":{"interval":"year","frequency":1},"unit_price_overrides":[]},"status":"active","product":{"id":"pro_01jnk9p7p2gekwkcayg833ec0p","name":"MonsterWriter 500MB Cloud","type":"standard","status":"active","image_url":"https://www.monsterwriter.com/logo-no-writing.png","seller_id":"28314","created_at":"2025-03-05T13:59:56.866Z","updated_at":"2025-03-05T14:15:43.272Z","custom_data":{"total_storage_available":"524288000"},"description":"Use MonsterWriter in the browser across your devices. Store all your documents in the MonsterWriter cloud.","tax_category":"standard"},"quantity":1,"recurring":true,"created_at":"2025-03-25T08:57:51.787Z","updated_at":"2025-03-25T08:57:51.787Z","trial_dates":null,"next_billed_at":null,"previously_billed_at":"2025-03-25T08:57:50.7553Z"}],"status":"active","discount":null,"paused_at":null,"address_id":"add_01jq68anq1nj82x13b78y4kyng","created_at":"2025-03-25T08:57:51.787Z","started_at":"2025-03-25T08:57:50.7553Z","updated_at":"2025-03-26T13:20:12.113Z","business_id":null,"canceled_at":null,"custom_data":{"nodeId":"${nodeId}"},"customer_id":"ctm_01jq4sr7x7tkb7k8gyhe2g224j","import_meta":null,"billing_cycle":{"interval":"year","frequency":1},"currency_code":"USD","next_billed_at":null,"billing_details":null,"collection_mode":"automatic","first_billed_at":"2025-03-25T08:57:50.7553Z","scheduled_change":{"action":"cancel","resume_at":null,"effective_at":"2026-03-25T08:57:50.7553Z"},"current_billing_period":{"ends_at":"2026-03-25T08:57:50.7553Z","starts_at":"2025-03-25T08:57:50.7553Z"}},"event_id":"evt_01jq99rk84410detjk7twbvsve","event_type":"subscription.updated","occurred_at":"2025-03-26T13:20:13.572901Z","notification_id":"ntf_01jq99rkpnvcywrk4bt62karcz"}`;
    await sendPaymentNotification(cancellationEvent);

    quota = await client.getQuota(nodeId);
    expect(quota.totalStorageAvailable).to.eql(storageBeforeUpgrade);
  });

  // {"data":{"id":"sub_01jq68bfdbptwfsmffgkts2vmp","items":[{"price":{"id":"pri_01jnk9wfg57x3j5199xa1eng7d","name":"Beta version price per year","type":"standard","status":"active","quantity":{"maximum":1,"minimum":1},"tax_mode":"account_setting","seller_id":"28314","created_at":"2025-03-05T14:03:21.477051Z","product_id":"pro_01jnk9p7p2gekwkcayg833ec0p","unit_price":{"amount":"1900","currency_code":"USD"},"updated_at":"2025-03-05T14:03:21.477052Z","custom_data":null,"description":"Beta version price per year","import_meta":null,"trial_period":null,"billing_cycle":{"interval":"year","frequency":1},"unit_price_overrides":[]},"status":"active","product":{"id":"pro_01jnk9p7p2gekwkcayg833ec0p","name":"MonsterWriter 500MB Cloud","type":"standard","status":"active","image_url":"https://www.monsterwriter.com/logo-no-writing.png","seller_id":"28314","created_at":"2025-03-05T13:59:56.866Z","updated_at":"2025-03-05T14:15:43.272Z","custom_data":{"total_storage_available":"524288000"},"description":"Use MonsterWriter in the browser across your devices. Store all your documents in the MonsterWriter cloud.","tax_category":"standard"},"quantity":1,"recurring":true,"created_at":"2025-03-25T08:57:51.787Z","updated_at":"2025-03-25T08:57:51.787Z","trial_dates":null,"next_billed_at":"2026-03-25T08:57:50.7553Z","previously_billed_at":"2025-03-25T08:57:50.7553Z"}],"status":"active","discount":null,"paused_at":null,"address_id":"add_01jq68anq1nj82x13b78y4kyng","created_at":"2025-03-25T08:57:51.787Z","started_at":"2025-03-25T08:57:50.7553Z","updated_at":"2025-03-26T13:23:46.348Z","business_id":null,"canceled_at":null,"custom_data":{"nodeId":"foo"},"customer_id":"ctm_01jq4sr7x7tkb7k8gyhe2g224j","import_meta":null,"billing_cycle":{"interval":"year","frequency":1},"currency_code":"USD","next_billed_at":"2026-03-25T08:57:50.7553Z","billing_details":null,"collection_mode":"automatic","first_billed_at":"2025-03-25T08:57:50.7553Z","scheduled_change":null,"current_billing_period":{"ends_at":"2026-03-25T08:57:50.7553Z","starts_at":"2025-03-25T08:57:50.7553Z"}},"event_id":"evt_01jq99z3k842jze55js0mq7a58","event_type":"subscription.updated","occurred_at":"2025-03-26T13:23:46.920492Z","notification_id":"ntf_01jq99z3qv5ewehths90a7ab63"}
  it('handles the cancellation of an cancellation');

  // {"data":{"id":"txn_01jq9bf0ybvawcy18tz0fnmxyg","items":[{"price":{"id":"pri_01jq9ajyveaawxazcm1ya9z0r4","name":"Beta version price per month","type":"standard","status":"active","quantity":{"maximum":999999,"minimum":1},"tax_mode":"account_setting","created_at":"2025-03-26T13:34:37.422088Z","product_id":"pro_01jnk9p7p2gekwkcayg833ec0p","unit_price":{"amount":"500","currency_code":"USD"},"updated_at":"2025-03-26T13:34:37.422088Z","custom_data":{"total_storage_available":"524288000"},"description":"Beta version price per month","trial_period":null,"billing_cycle":{"interval":"month","frequency":1},"unit_price_overrides":[]},"price_id":"pri_01jq9ajyveaawxazcm1ya9z0r4","quantity":1,"proration":null},{"price":{"id":"pri_01jnk9wfg57x3j5199xa1eng7d","name":"Beta version price per year","type":"standard","status":"active","quantity":{"maximum":1,"minimum":1},"tax_mode":"account_setting","created_at":"2025-03-05T14:03:21.477051Z","product_id":"pro_01jnk9p7p2gekwkcayg833ec0p","unit_price":{"amount":"1900","currency_code":"USD"},"updated_at":"2025-03-05T14:03:21.477052Z","custom_data":null,"description":"Beta version price per year","trial_period":null,"billing_cycle":{"interval":"year","frequency":1},"unit_price_overrides":[]},"price_id":"pri_01jnk9wfg57x3j5199xa1eng7d","quantity":-1,"proration":{"rate":"0.9967","billing_period":{"ends_at":"2026-03-25T08:57:50.7553Z","starts_at":"2025-03-26T13:49:56.735Z"}}}],"origin":"subscription_update","status":"paid","details":{"totals":{"fee":null,"tax":"-223","total":"-1394","credit":"0","balance":"0","discount":"0","earnings":null,"subtotal":"-1171","grand_total":"0","currency_code":"USD","credit_to_balance":"1394"},"line_items":[{"id":"txnitm_01jq9bf0z217c7h6nan6ftp844","totals":{"tax":"80","total":"500","discount":"0","subtotal":"420"},"item_id":null,"product":{"id":"pro_01jnk9p7p2gekwkcayg833ec0p","name":"MonsterWriter 500MB Cloud","type":"standard","status":"active","image_url":"https://www.monsterwriter.com/logo-no-writing.png","created_at":"2025-03-05T13:59:56.866Z","updated_at":"2025-03-05T14:15:43.272Z","custom_data":{"total_storage_available":"524288000"},"description":"Use MonsterWriter in the browser across your devices. Store all your documents in the MonsterWriter cloud.","tax_category":"standard"},"price_id":"pri_01jq9ajyveaawxazcm1ya9z0r4","quantity":1,"tax_rate":"0.19","unit_totals":{"tax":"80","total":"500","discount":"0","subtotal":"420"},"is_tax_exempt":false,"revised_tax_exempted":false},{"id":"txnitm_01jq9bf0z6jzpt8x7ceqwgj33k","totals":{"tax":"-303","total":"-1894","discount":"0","subtotal":"-1591"},"item_id":"txnitm_01jq68ap12nswtktdxhhqwb2cy","product":{"id":"pro_01jnk9p7p2gekwkcayg833ec0p","name":"MonsterWriter 500MB Cloud","type":"standard","status":"active","image_url":"https://www.monsterwriter.com/logo-no-writing.png","created_at":"2025-03-05T13:59:56.866Z","updated_at":"2025-03-05T14:15:43.272Z","custom_data":{"total_storage_available":"524288000"},"description":"Use MonsterWriter in the browser across your devices. Store all your documents in the MonsterWriter cloud.","tax_category":"standard"},"price_id":"pri_01jnk9wfg57x3j5199xa1eng7d","quantity":-1,"tax_rate":"0.19","proration":{"rate":"0.9967","billing_period":{"ends_at":"2026-03-25T08:57:50.7553Z","starts_at":"2025-03-26T13:49:56.735Z"}},"unit_totals":{"tax":"303","total":"1894","discount":"0","subtotal":"1591"},"is_tax_exempt":false,"revised_tax_exempted":false}],"payout_totals":null,"tax_rates_used":[{"totals":{"tax":"-223","total":"-1394","discount":"0","subtotal":"-1171"},"tax_rate":"0.19"}],"adjusted_totals":{"fee":null,"tax":"-223","total":"-1394","earnings":null,"subtotal":"-1171","grand_total":"0","currency_code":"USD"}},"checkout":{"url":"https://app.monsterwriter.com?_ptxn=txn_01jq9bf0ybvawcy18tz0fnmxyg"},"payments":[],"billed_at":"2025-03-26T13:49:57.067505663Z","address_id":"add_01jq68anq1nj82x13b78y4kyng","created_at":"2025-03-26T13:49:57.119181199Z","invoice_id":null,"revised_at":null,"updated_at":"2025-03-26T13:49:57.138729835Z","business_id":null,"custom_data":{"nodeId":"foo"},"customer_id":"ctm_01jq4sr7x7tkb7k8gyhe2g224j","discount_id":null,"receipt_data":null,"currency_code":"USD","billing_period":{"ends_at":"2025-04-26T13:49:56.723Z","starts_at":"2025-03-26T13:49:56.723Z"},"invoice_number":null,"billing_details":null,"collection_mode":"automatic","subscription_id":"sub_01jq68bfdbptwfsmffgkts2vmp"},"event_id":"evt_01jq9bf17da128pmht7zb6w0s6","event_type":"transaction.updated","occurred_at":"2025-03-26T13:49:57.357195Z","notification_id":"ntf_01jq9bf1c1pvkh6j8a2y1md1h6"}
  it('is handles the subscription upgrade events');

  describe('details for accountee', () => {
    describe('when the given node is a user id');

    describe('when the user is accountable for the given node', () => {
      it('is possible to retrieve a cancel subscription link');

      it('is possible to trigger the upgrade of a subscription');
    });

    describe('when one user creates a subscription to two orgs, the other accountee of the other orgs should only see the subscriptions managed by them');
  });
});
